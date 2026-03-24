/**
 * Socket.IO Initializer
 * Wires up the Socket.IO server and delegates events to
 * modular per-role handlers.
 *
 * Room conventions:
 *   admin_room        — all connected admins (for broadcast notifications)
 *   chat_<sessionId>  — per-session room (customer + assigned admin)
 */

const { Server }              = require('socket.io');
const registerCustomerHandlers = require('./handlers/customerHandler');
const registerAdminHandlers    = require('./handlers/adminHandler');

/**
 * Attach Socket.IO to the HTTP server.
 *
 * @param   {import('http').Server} httpServer
 * @param   {string[]}              allowedOrigins
 * @returns {import('socket.io').Server}
 */
function initSocket(httpServer, allowedOrigins) {
  const io = new Server(httpServer, {
    cors: {
      origin:      allowedOrigins.length ? allowedOrigins : '*',
      methods:     ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout:  60_000,
    pingInterval: 25_000,
    // Allow transports to fall back gracefully
    transports: ['websocket', 'polling'],
  });

  // ── Connection ─────────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    console.log(`🔌 [Socket] Connected  id=${socket.id}  ip=${ip}`);

    // Mount per-role event handlers
    registerCustomerHandlers(socket, io);
    registerAdminHandlers(socket, io);

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      const role    = socket._isAdmin       ? 'admin'
                    : socket._sessionId     ? `customer(${socket._sessionId})`
                    : 'unknown';
      console.log(`🔌 [Socket] Disconnected  id=${socket.id}  role=${role}  reason=${reason}`);
    });

    // ── Unhandled errors ─────────────────────────────────────────────────────
    socket.on('error', (err) => {
      console.error(`⚠️  [Socket] Error  id=${socket.id}:`, err.message);
    });
  });

  // Log room joins for debugging (remove in production if noisy)
  if (process.env.NODE_ENV !== 'production') {
    io.of('/').adapter.on('join-room', (room, id) => {
      if (room !== id) console.log(`   📦 [Room] ${id} joined  room=${room}`);
    });
    io.of('/').adapter.on('leave-room', (room, id) => {
      if (room !== id) console.log(`   📦 [Room] ${id} left    room=${room}`);
    });
  }

  return io;
}

module.exports = initSocket;
