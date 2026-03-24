/**
 * Admin Socket Handler
 * Handles all socket events emitted by the admin dashboard.
 *
 * Events handled:
 *   admin_join_chat     — Admin authenticates and subscribes to all new chat events
 *   admin_send_message  — Admin sends a message inside a specific session
 *   admin_typing        — Admin typing indicator
 *   admin_assign_chat   — Admin assigns a session to themselves
 *   message_read        — Admin marks messages in a session as read
 *
 * Events emitted:
 *   receive_message     — Broadcast to the session room
 *   typing_indicator    — Broadcast to the session room
 *   chat_status_update  — Broadcast to the session room + admin room
 *   admin_join_chat     — Confirmation sent back to admin
 *   message_read        — Broadcast to session room
 */

const jwt  = require('jsonwebtoken');
const Chat = require('../../models/Chat');
const { sanitize } = require('../../utils/chatUtils');

/**
 * Register all admin-related socket events on the given socket.
 *
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server}  io
 */
module.exports = function registerAdminHandlers(socket, io) {

  // ── admin_join_chat ────────────────────────────────────────────────────────
  // Admin authenticates via JWT and joins the global admin room.
  // Optionally also joins a specific session room to see that conversation.
  socket.on('admin_join_chat', async (payload) => {
    try {
      const { token, sessionId } = payload || {};

      if (!token) {
        return socket.emit('admin_join_chat', { success: false, error: 'Token required.' });
      }

      // Verify JWT
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return socket.emit('admin_join_chat', { success: false, error: 'Invalid or expired token.' });
      }

      // Tag socket with admin identity
      socket._adminId   = decoded.id;
      socket._adminName = decoded.name || 'Admin';  // real name for admin UI
      socket._displayName = 'Support Agent';          // customer-facing name
      socket._isAdmin   = true;

      // Join the broadcast room all admins share
      socket.join('admin_room');

      // If a specific sessionId was provided, also join that session room
      let chatHistory = null;
      if (sessionId) {
        socket.join(`chat_${sessionId}`);
        socket._currentSession = sessionId;
        const chat = await Chat.findOne({ sessionId }).lean();
        if (chat) chatHistory = chat;
      }

      socket.emit('admin_join_chat', {
        success:     true,
        adminId:     decoded.id,
        adminName:   socket._adminName,
        chatHistory,
      });

    } catch (err) {
      console.error('[admin_join_chat] Error:', err.message);
      socket.emit('admin_join_chat', { success: false, error: 'Failed to join.' });
    }
  });


  // ── admin_send_message ─────────────────────────────────────────────────────
  socket.on('admin_send_message', async (payload) => {
    try {
      if (!socket._isAdmin) return;

      const { sessionId, message, type, imageData, fileName } = payload || {};
      if (!sessionId) return;

      const isImage = type === 'image' && imageData;

      // Validate
      if (!isImage && (!message || !message.trim())) return;
      if (isImage && imageData.length > 7_000_000) return; // ~5MB max

      const text = isImage ? sanitize(fileName || 'image') : sanitize(message.trim());
      if (!isImage && !text) return;

      const newMessage = {
        senderId:   socket._adminId,
        senderName: socket._displayName || 'Support Agent',
        senderRole: 'admin',
        message:    text,
        type:       isImage ? 'image' : 'text',
        imageData:  isImage ? imageData : undefined,
        fileName:   isImage ? sanitize(fileName || 'image') : undefined,
        timestamp:  new Date(),
        read:       false,
      };

      // Persist and flip status to 'active'
      const chat = await Chat.findOneAndUpdate(
        { sessionId },
        {
          $push: { messages: newMessage },
          $inc:  { unreadByCustomer: 1 },
          $set:  { lastMessageAt: new Date(), status: 'active' },
        },
        { new: true }
      );

      if (!chat) {
        console.warn(`[admin_send_message] No chat found for session: ${sessionId}`);
        return;
      }

      const savedMsg = chat.messages[chat.messages.length - 1];

      // Broadcast to everyone in the room
      // Build broadcast message — include imageData for real-time delivery
      const broadcastMsg = {
        ...savedMsg.toObject ? savedMsg.toObject() : savedMsg,
        type:      isImage ? 'image' : 'text',
        imageData: isImage ? imageData : undefined,
        fileName:  isImage ? sanitize(fileName || 'image') : undefined,
      };

      io.to(`chat_${sessionId}`).emit('receive_message', {
        sessionId,
        message: broadcastMsg,
      });

      // Update admin sidebar
      io.to('admin_room').emit('chat_status_update', {
        type:          'new_message',
        sessionId,
        senderRole:    'admin',
        lastMessage:   text,
        lastMessageAt: chat.lastMessageAt,
        status:        chat.status,
        unreadByAdmin: chat.unreadByAdmin,
      });

    } catch (err) {
      console.error('[admin_send_message] Error:', err.message);
    }
  });


  // ── admin_typing ───────────────────────────────────────────────────────────
  socket.on('admin_typing', (payload) => {
    if (!socket._isAdmin) return;
    const { sessionId, isTyping } = payload || {};
    if (!sessionId) return;

    socket.to(`chat_${sessionId}`).emit('typing_indicator', {
      sessionId,
      senderRole: 'admin',
      senderName: socket._displayName || 'Support Agent',
      isTyping:   !!isTyping,
    });
  });


  // ── admin_assign_chat ──────────────────────────────────────────────────────
  socket.on('admin_assign_chat', async (payload) => {
    try {
      if (!socket._isAdmin) return;

      const { sessionId } = payload || {};
      if (!sessionId) return;

      const chat = await Chat.findOneAndUpdate(
        { sessionId },
        {
          $set: {
            'assignedAdmin.adminId':   socket._adminId,
            'assignedAdmin.adminName': socket._adminName,
            status: 'active',
          },
        },
        { new: true }
      );

      if (!chat) return;

      // Join the session room if not already in it
      socket.join(`chat_${sessionId}`);
      socket._currentSession = sessionId;

      // Confirm to the assigning admin
      socket.emit('admin_assign_chat', {
        success:       true,
        sessionId,
        assignedAdmin: chat.assignedAdmin,
        status:        chat.status,
      });

      // Broadcast status change to the session room (customer sees "Agent joined")
      io.to(`chat_${sessionId}`).emit('chat_status_update', {
        type:          'assigned',
        sessionId,
        assignedAdmin: chat.assignedAdmin,
        status:        'active',
      });

      // Update all admins' sidebars
      io.to('admin_room').emit('chat_status_update', {
        type:          'assigned',
        sessionId,
        assignedAdmin: chat.assignedAdmin,
        status:        'active',
        lastMessageAt: chat.lastMessageAt,
      });

    } catch (err) {
      console.error('[admin_assign_chat] Error:', err.message);
    }
  });


  // ── message_read ───────────────────────────────────────────────────────────
  // Admin opens a chat → mark all customer messages as read
  socket.on('message_read', async (payload) => {
    try {
      if (!socket._isAdmin) return;

      const { sessionId } = payload || {};
      if (!sessionId) return;

      // Zero out admin unread count
      await Chat.findOneAndUpdate(
        { sessionId },
        { $set: { unreadByAdmin: 0, 'messages.$[el].read': true } },
        { arrayFilters: [{ 'el.senderRole': 'customer', 'el.read': false }] }
      );

      // Tell the session room so customer widget can show ticks
      io.to(`chat_${sessionId}`).emit('message_read', {
        sessionId,
        readBy: 'admin',
      });

      // Update sidebar badge to 0
      io.to('admin_room').emit('chat_status_update', {
        type:          'read',
        sessionId,
        unreadByAdmin: 0,
      });

    } catch (err) {
      console.error('[message_read] Error:', err.message);
    }
  });


  // ── admin_close_chat ───────────────────────────────────────────────────────
  socket.on('admin_close_chat', async (payload) => {
    try {
      if (!socket._isAdmin) return;

      const { sessionId } = payload || {};
      if (!sessionId) return;

      await Chat.findOneAndUpdate({ sessionId }, { $set: { status: 'closed' } });

      io.to(`chat_${sessionId}`).emit('chat_status_update', {
        type:      'closed',
        sessionId,
        status:    'closed',
        message:   'This conversation has been closed. Thank you for contacting GCSC Support.',
      });

      io.to('admin_room').emit('chat_status_update', {
        type:      'closed',
        sessionId,
        status:    'closed',
      });

    } catch (err) {
      console.error('[admin_close_chat] Error:', err.message);
    }
  });


  // ── admin_reopen_chat ──────────────────────────────────────────────────────
  socket.on('admin_reopen_chat', async (payload) => {
    try {
      if (!socket._isAdmin) return;

      const { sessionId } = payload || {};
      if (!sessionId) return;

      await Chat.findOneAndUpdate({ sessionId }, { $set: { status: 'waiting' } });

      io.to('admin_room').emit('chat_status_update', {
        type: 'reopened', sessionId, status: 'waiting',
      });

    } catch (err) {
      console.error('[admin_reopen_chat] Error:', err.message);
    }
  });

};
