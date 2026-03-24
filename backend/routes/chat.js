/**
 * Chat REST Routes
 * All routes require a valid admin JWT (enforced by authMiddleware).
 *
 * GET    /api/chats            — List sessions (optional ?status= filter)
 * GET    /api/chats/stats      — Quick stat counters
 * GET    /api/chats/:sessionId — Single session + full history
 * PATCH  /api/chats/:sessionId/status  — Update status
 * PATCH  /api/chats/:sessionId/assign  — Assign to current admin
 * DELETE /api/chats/:sessionId         — Delete closed session
 */

const express        = require('express');
const authMiddleware = require('../middleware/auth');
const {
  listChats,
  getChat,
  updateStatus,
  assignChat,
  deleteChat,
  getChatStats,
} = require('../controllers/chatController');

const router = express.Router();

// Protect every route in this file
router.use(authMiddleware);

router.get('/stats',          getChatStats);
router.get('/',               listChats);
router.get('/:sessionId',     getChat);
router.patch('/:sessionId/status', updateStatus);
router.patch('/:sessionId/assign', assignChat);
router.delete('/:sessionId',  deleteChat);

module.exports = router;
