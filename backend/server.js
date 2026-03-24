/**
 * Global Cargo Shipping Company (GCSC)
 * Main Server — Express + Socket.IO (Production Grade v5.0)
 *
 * Architecture:
 *   ├── REST API (Express)
 *   │     ├── /api/auth       → Authentication
 *   │     ├── /api/shipments  → Shipment tracking
 *   │     ├── /api/admin      → Admin management
 *   │     └── /api/chats      → Chat session management
 *   │
 *   └── Real-Time (Socket.IO)
 *         └── /socket/index.js → Delegates to per-role handlers
 */

require('dotenv').config();

// ── Environment guards ─────────────────────────────────────────────────────────
['JWT_SECRET', 'MONGODB_URI'].forEach((key) => {
  if (!process.env[key]) {
    console.error(`FATAL: Environment variable "${key}" is not set. Exiting.`);
    process.exit(1);
  }
});

const http    = require('http');
const express = require('express');
const cors    = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt  = require('bcryptjs');

const connectDB     = require('./config/database');
const initSocket    = require('./socket/index');
const authRoutes    = require('./routes/auth');
const shipmentRoutes = require('./routes/shipments');
const adminRoutes   = require('./routes/admin');
const chatRoutes    = require('./routes/chat');

// ── Express App ────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

// ── CORS ───────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // Server-to-server / curl
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials:    true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting ──────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 200,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please slow down.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts.' },
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

// ── REST Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/chats',     chatRoutes);

// ── Health Check ───────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    success:   true,
    service:   'GCSC API',
    version:   '5.0.0',
    status:    'online',
    timestamp: new Date().toISOString(),
  });
});

// ── 404 & Error Handlers ───────────────────────────────────────────────────────
app.use('*', (_req, res) => res.status(404).json({ success: false, message: 'Route not found.' }));
app.use((err, _req, res, _next) => {
  console.error('[Express Error]', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ── Socket.IO ──────────────────────────────────────────────────────────────────
// Attaches Socket.IO to the HTTP server and mounts all handlers.
initSocket(server, allowedOrigins);

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  await seedAdmin();
  await migrateOldChats();   // ← auto-migrate v4 → v5 schema on startup

  server.listen(PORT, () => {
    console.log('\n🚀 GCSC API v5.0 is live!');
    console.log(`   ➜  REST API   : http://localhost:${PORT}/api`);
    console.log(`   ➜  Health     : http://localhost:${PORT}/health`);
    console.log(`   ➜  Socket.IO  : ws://localhost:${PORT}\n`);
  });
})();

// ── Auto-migrate v4 Chat docs → v5 schema ────────────────────────────────────
// Safe to run every startup — skips docs that are already migrated.
async function migrateOldChats() {
  try {
    const db         = require('mongoose').connection.db;
    const collection = db.collection('chats');
    const oldDocs    = await collection.find({ customerName: { $exists: true } }).toArray();

    if (oldDocs.length === 0) return; // nothing to do

    console.log(`⚙️  Migrating ${oldDocs.length} old Chat document(s) to v5 schema…`);

    for (const doc of oldDocs) {
      const customerName  = doc.customerName  || 'Guest';
      const customerEmail = doc.customerEmail || '';
      const lastMessageAt = doc.lastMessage   || doc.createdAt || new Date();

      const migratedMessages = (doc.messages || []).map(msg => ({
        _id:        msg._id,
        senderId:   msg.sender === 'admin' ? 'admin' : doc.sessionId,
        senderName: msg.sender === 'admin' ? 'Support Agent' : customerName,
        senderRole: msg.sender === 'admin' ? 'admin' : 'customer',
        message:    msg.text || '',
        timestamp:  msg.timestamp || new Date(),
        read:       false,
      }));

      await collection.updateOne(
        { _id: doc._id },
        {
          $set:   { 'customer.name': customerName, 'customer.email': customerEmail,
                    'assignedAdmin.adminId': null, 'assignedAdmin.adminName': null,
                    lastMessageAt, unreadByCustomer: 0, messages: migratedMessages },
          $unset: { customerName: '', customerEmail: '', trackingNumber: '', lastMessage: '' },
        }
      );
    }

    console.log(`✅ Migrated ${oldDocs.length} Chat document(s) successfully.`);
  } catch (err) {
    console.error('⚠️  Chat migration error (non-fatal):', err.message);
  }
}

// ── Seed default admin ─────────────────────────────────────────────────────────
async function seedAdmin() {
  const Admin = require('./models/Admin');
  const email = process.env.ADMIN_EMAIL;
  const pass  = process.env.ADMIN_PASSWORD;
  if (!email || !pass) return;

  const exists = await Admin.findOne({ email });
  if (!exists) {
    const hashed = await bcrypt.hash(pass, 12);
    await Admin.create({ email, password: hashed, name: 'Super Admin' });
    console.log(`✅ Default admin seeded: ${email}`);
  }
}
