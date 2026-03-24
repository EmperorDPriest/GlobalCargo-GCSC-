/**
 * Customer Socket Handler
 * Handles all socket events emitted by the customer (chat widget).
 *
 * Events handled:
 *   customer_join_chat    — Customer joins or resumes a session
 *   customer_send_message — Customer sends a message
 *   customer_typing       — Customer typing indicator
 *
 * Events emitted:
 *   receive_message       — Broadcast to the session room
 *   typing_indicator      — Broadcast to the session room
 *   chat_status_update    — Broadcast to the session room + admin room
 *   message_read          — Sent to customer on read receipt
 */

const Chat = require('../../models/Chat');
const { sanitize, generateSessionId } = require('../../utils/chatUtils');
const { notifyNewChat, notifyNewMessage } = require('../../utils/emailService');

/**
 * Register all customer-related socket events on the given socket.
 *
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server}  io
 */
module.exports = function registerCustomerHandlers(socket, io) {

  // ── customer_join_chat ─────────────────────────────────────────────────────
  socket.on('customer_join_chat', async (payload) => {
    try {
      const { sessionId, name, email } = payload || {};

      // Reuse existing sessionId or create a fresh one
      const sid       = (sessionId && sessionId.trim()) || generateSessionId();
      const cleanName  = sanitize(name)  || 'Guest';
      const cleanEmail = sanitize(email) || '';

      // Join the session room
      socket.join(`chat_${sid}`);
      socket._sessionId    = sid;
      socket._customerName = cleanName;

      let chat = await Chat.findOne({ sessionId: sid });

      if (!chat) {
        // ── Brand-new session ──────────────────────────────────────────────
        chat = await Chat.create({
          sessionId: sid,
          customer:  { name: cleanName, email: cleanEmail },
          status:    'waiting',
        });

        // Email notification (non-blocking)
        notifyNewChat({
          sessionId: sid,
          customerName:  cleanName,
          customerEmail: cleanEmail,
        }).catch(() => {});

        // Notify all admins about the new chat
        io.to('admin_room').emit('chat_status_update', {
          type:      'new_chat',
          sessionId: sid,
          chat: {
            sessionId:     sid,
            customer:      chat.customer,
            assignedAdmin: chat.assignedAdmin,
            status:        'waiting',
            unreadByAdmin: 0,
            lastMessageAt: chat.lastMessageAt,
            createdAt:     chat.createdAt,
          },
        });

      } else {
        // ── Returning customer — update info if provided ───────────────────
        if (cleanName !== 'Guest') chat.customer.name  = cleanName;
        if (cleanEmail)            chat.customer.email = cleanEmail;
        await chat.save();
      }

      // Confirm join — send back history so widget can render previous messages
      socket.emit('customer_join_chat', {
        success:   true,
        sessionId: sid,
        status:    chat.status,
        messages:  chat.messages,
        customer:  chat.customer,
      });

    } catch (err) {
      console.error('[customer_join_chat] Error:', err.message);
      socket.emit('customer_join_chat', { success: false, error: 'Failed to join chat.' });
    }
  });


  // ── customer_send_message ──────────────────────────────────────────────────
  socket.on('customer_send_message', async (payload) => {
    try {
      const { sessionId, message, type, imageData, fileName } = payload || {};

      if (!sessionId) return;

      const isImage = type === 'image' && imageData;

      // Validate text message
      if (!isImage && (!message || !message.trim())) return;

      // For images: validate base64 size (max ~5MB base64 = ~6.7MB string)
      if (isImage && imageData.length > 7_000_000) return;

      const text = isImage ? sanitize(fileName || 'image') : sanitize(message.trim());
      if (!isImage && !text) return;

      const newMessage = {
        senderId:   sessionId,
        senderName: socket._customerName || 'Guest',
        senderRole: 'customer',
        message:    text,
        type:       isImage ? 'image' : 'text',
        imageData:  isImage ? imageData : undefined,
        fileName:   isImage ? sanitize(fileName || 'image') : undefined,
        timestamp:  new Date(),
        read:       false,
      };

      // Persist to DB
      const chat = await Chat.findOneAndUpdate(
        { sessionId },
        {
          $push:  { messages: newMessage },
          $inc:   { unreadByAdmin: 1 },
          $set:   { lastMessageAt: new Date(), status: 'waiting' },
        },
        { new: true }
      );

      if (!chat) {
        console.warn(`[customer_send_message] No chat found for session: ${sessionId}`);
        return;
      }

      // The saved message (with _id from Mongo)
      const savedMsg = chat.messages[chat.messages.length - 1];

      // Build full broadcast message — include imageData from original payload
      // (savedMsg from DB is correct since schema now has imageData field)
      const broadcastMsg = {
        ...savedMsg.toObject ? savedMsg.toObject() : savedMsg,
        // Ensure imageData is included (DB doc should have it, but be safe)
        type:      isImage ? 'image' : 'text',
        imageData: isImage ? imageData : undefined,
        fileName:  isImage ? sanitize(fileName || 'image') : undefined,
      };

      // Broadcast to everyone in the room (customer + assigned admin)
      io.to(`chat_${sessionId}`).emit('receive_message', {
        sessionId,
        message: broadcastMsg,
      });

      // Email notification if no admin is actively in the session room
      // (check by seeing if room has anyone besides the customer)
      const room = io.sockets.adapter.rooms.get(`chat_${sessionId}`);
      const roomSize = room ? room.size : 0;
      if (roomSize <= 1) {
        // Only customer in room — no admin responding
        notifyNewMessage({
          sessionId,
          customerName: chat.customer?.name || 'Guest',
          message:      text,
        }).catch(() => {});
      }

      // Notify admin room with sidebar badge update
      io.to('admin_room').emit('chat_status_update', {
        type:          'new_message',
        sessionId,
        senderRole:    'customer',
        customerName:  chat.customer.name,
        lastMessage:   text,
        lastMessageAt: chat.lastMessageAt,
        unreadByAdmin: chat.unreadByAdmin,
        status:        chat.status,
      });

    } catch (err) {
      console.error('[customer_send_message] Error:', err.message);
    }
  });


  // ── customer_typing ────────────────────────────────────────────────────────
  socket.on('customer_typing', (payload) => {
    const { sessionId, isTyping } = payload || {};
    if (!sessionId) return;

    // Only send to the room (admins in that room will receive it)
    socket.to(`chat_${sessionId}`).emit('typing_indicator', {
      sessionId,
      senderRole: 'customer',
      senderName: socket._customerName || 'Guest',
      isTyping:   !!isTyping,
    });
  });

};
