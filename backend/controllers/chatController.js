/**
 * Chat Controller — v5.1
 * Handles REST operations for admin-side chat management.
 * Backward-compatible: works with both old (v4) and new (v5) MongoDB documents.
 */

const Chat = require('../models/Chat');

// ── Normalise a lean chat document ─────────────────────────────────────────────
// Handles old-schema docs (customerName / lastMessage) transparently.
function normaliseChat(doc) {
  if (!doc) return doc;

  // Old docs stored name/email at root level
  if (!doc.customer || (!doc.customer.name && doc.customerName)) {
    doc.customer = {
      name:  doc.customerName  || 'Guest',
      email: doc.customerEmail || '',
    };
  }

  // Normalise lastMessageAt ← could be stored as lastMessage in old docs
  if (!doc.lastMessageAt && doc.lastMessage) {
    doc.lastMessageAt = doc.lastMessage;
  }

  // Normalise messages array for old-format messages
  if (doc.messages && doc.messages.length > 0) {
    doc.messages = doc.messages.map(msg => {
      if (!msg.senderRole && msg.sender) {
        return {
          ...msg,
          senderRole: msg.sender,                              // 'customer' or 'admin'
          senderName: msg.sender === 'admin'
            ? (msg.senderName || 'Support Agent')
            : (msg.senderName || doc.customer?.name || 'Guest'),
          senderId:   msg.senderId || (msg.sender === 'admin' ? 'admin' : doc.sessionId),
          message:    msg.message  || msg.text || '',
        };
      }
      return msg;
    });
  }

  return doc;
}

// ── GET /api/chats ─────────────────────────────────────────────────────────────
async function listChats(req, res) {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && ['waiting', 'active', 'closed'].includes(status)) {
      filter.status = status;
    }

    // Sort by lastMessageAt first, fall back to lastMessage (old field) then createdAt
    const chats = await Chat.find(filter)
      .sort({ lastMessageAt: -1, lastMessage: -1, createdAt: -1 })
      .select('-messages')
      .lean();

    const normalised = chats.map(c => normaliseChat(c));
    res.json({ success: true, count: normalised.length, chats: normalised });
  } catch (err) {
    console.error('[listChats]', err.message);
    res.status(500).json({ success: false, message: 'Failed to load chats.' });
  }
}

// ── GET /api/chats/stats ───────────────────────────────────────────────────────
async function getChatStats(req, res) {
  try {
    const [waiting, active, closed] = await Promise.all([
      Chat.countDocuments({ status: 'waiting' }),
      Chat.countDocuments({ status: 'active' }),
      Chat.countDocuments({ status: 'closed' }),
    ]);
    res.json({ success: true, stats: { waiting, active, closed, total: waiting + active + closed } });
  } catch (err) {
    console.error('[getChatStats]', err.message);
    res.status(500).json({ success: false, message: 'Failed to load stats.' });
  }
}

// ── GET /api/chats/:sessionId ──────────────────────────────────────────────────
async function getChat(req, res) {
  try {
    const doc = await Chat.findOne({ sessionId: req.params.sessionId }).lean();
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Chat session not found.' });
    }
    res.json({ success: true, chat: normaliseChat(doc) });
  } catch (err) {
    console.error('[getChat]', err.message);
    res.status(500).json({ success: false, message: 'Failed to load chat.' });
  }
}

// ── PATCH /api/chats/:sessionId/status ────────────────────────────────────────
async function updateStatus(req, res) {
  try {
    const VALID = ['waiting', 'active', 'closed'];
    const { status } = req.body;
    if (!status || !VALID.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${VALID.join(', ')}` });
    }
    const chat = await Chat.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      { $set: { status } },
      { new: true }
    ).select('-messages').lean();
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found.' });
    res.json({ success: true, chat: normaliseChat(chat) });
  } catch (err) {
    console.error('[updateStatus]', err.message);
    res.status(500).json({ success: false, message: 'Failed to update status.' });
  }
}

// ── PATCH /api/chats/:sessionId/assign ────────────────────────────────────────
async function assignChat(req, res) {
  try {
    const admin = req.admin;
    const chat  = await Chat.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      { $set: { 'assignedAdmin.adminId': admin._id.toString(), 'assignedAdmin.adminName': admin.name, status: 'active' } },
      { new: true }
    ).select('-messages').lean();
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found.' });
    res.json({ success: true, chat: normaliseChat(chat) });
  } catch (err) {
    console.error('[assignChat]', err.message);
    res.status(500).json({ success: false, message: 'Failed to assign chat.' });
  }
}

// ── DELETE /api/chats/:sessionId ──────────────────────────────────────────────
async function deleteChat(req, res) {
  try {
    const chat = await Chat.findOne({ sessionId: req.params.sessionId });
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found.' });
    // Admin can delete any chat (not restricted to closed only)
    await chat.deleteOne();
    res.json({ success: true, message: 'Chat deleted.' });
  } catch (err) {
    console.error('[deleteChat]', err.message);
    res.status(500).json({ success: false, message: 'Failed to delete chat.' });
  }
}

module.exports = { listChats, getChat, updateStatus, assignChat, deleteChat, getChatStats };
