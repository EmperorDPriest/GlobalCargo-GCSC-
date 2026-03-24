/**
 * migrateChats.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ONE-TIME migration: converts old Chat documents (v4 schema) to new format (v5).
 *
 * Old field  →  New field
 *  customerName        →  customer.name
 *  customerEmail       →  customer.email
 *  trackingNumber      →  (dropped — not in new schema)
 *  messages[].sender   →  messages[].senderRole
 *  messages[].text     →  messages[].message
 *  messages[].senderId →  (added: set to sessionId for customers, 'admin' for admins)
 *  messages[].senderName → (added: set to customerName / 'Support Agent')
 *  lastMessage         →  lastMessageAt
 *
 * Usage:
 *   node utils/migrateChats.js
 *
 * Safe to run multiple times — it only processes docs that still have old fields.
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function migrate() {
  console.log('\n🔄  GCSC Chat Migration — v4 → v5\n');

  // ── Connect ──────────────────────────────────────────────────────────────
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅  MongoDB connected');

  const db = mongoose.connection.db;
  const collection = db.collection('chats');

  // ── Find old-format documents (have customerName but NOT customer.name) ──
  const oldDocs = await collection.find({
    customerName: { $exists: true },
  }).toArray();

  console.log(`📊  Found ${oldDocs.length} old-format document(s) to migrate\n`);

  if (oldDocs.length === 0) {
    console.log('✅  Nothing to migrate — collection is already in v5 format.\n');
    await mongoose.disconnect();
    return;
  }

  let success = 0, failed = 0;

  for (const doc of oldDocs) {
    try {
      const customerName  = doc.customerName  || 'Guest';
      const customerEmail = doc.customerEmail || '';
      const lastMessageAt = doc.lastMessage   || doc.createdAt || new Date();

      // Migrate messages array
      const migratedMessages = (doc.messages || []).map(msg => ({
        senderId:   msg.sender === 'admin' ? 'admin' : doc.sessionId,
        senderName: msg.sender === 'admin' ? 'Support Agent' : customerName,
        senderRole: msg.sender === 'admin' ? 'admin' : 'customer',
        message:    msg.text || '',
        timestamp:  msg.timestamp || new Date(),
        read:       msg.sender === 'admin' ? false : true,
        // Keep original _id
        _id:        msg._id,
      }));

      await collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            'customer.name':         customerName,
            'customer.email':        customerEmail,
            'assignedAdmin.adminId':   null,
            'assignedAdmin.adminName': null,
            lastMessageAt:           lastMessageAt,
            unreadByCustomer:        0,
            messages:                migratedMessages,
          },
          $unset: {
            customerName:   '',
            customerEmail:  '',
            trackingNumber: '',
            lastMessage:    '',
          },
        }
      );

      console.log(`  ✓ Migrated: ${doc.sessionId} (${customerName})`);
      success++;
    } catch (err) {
      console.error(`  ✗ Failed:  ${doc.sessionId} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n📊  Migration complete: ${success} migrated, ${failed} failed`);
  await mongoose.disconnect();
  console.log('✅  Done.\n');
}

migrate().catch(err => {
  console.error('Migration crashed:', err);
  process.exit(1);
});
