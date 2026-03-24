/**
 * Chat Model — Production Grade
 * GCSC Live Support Chat System
 *
 * Stores full chat sessions between customers and GCSC support admins.
 * Each session lives in a unique Socket.IO room: chat_<sessionId>
 */

const mongoose = require('mongoose');

// ── Message Sub-Schema ─────────────────────────────────────────────────────────
const messageSchema = new mongoose.Schema(
  {
    senderId:   { type: String, required: true },                                    // Admin _id or customer sessionId
    senderName: { type: String, required: true, trim: true },                        // Display name
    senderRole: { type: String, enum: ['admin', 'customer'], required: true },       // Role badge
    message:    { type: String, required: true, trim: true, maxlength: 4000 },       // Sanitized content / file name for images
    type:       { type: String, enum: ['text', 'image'], default: 'text' },          // Message type
    imageData:  { type: String, default: null },                                     // Base64 data URL for images
    fileName:   { type: String, default: null, trim: true },                         // Original file name
    timestamp:  { type: Date,   default: Date.now },                                 // When sent
    read:       { type: Boolean, default: false },                                   // Read receipt flag
  },
  { _id: true }
);

// ── Assigned Admin Sub-Schema ──────────────────────────────────────────────────
const assignedAdminSchema = new mongoose.Schema(
  {
    adminId:   { type: String, default: null },
    adminName: { type: String, default: null, trim: true },
  },
  { _id: false }
);

// ── Customer Sub-Schema ────────────────────────────────────────────────────────
const customerSchema = new mongoose.Schema(
  {
    name:  { type: String, default: 'Guest', trim: true },
    email: { type: String, default: '',      trim: true, lowercase: true },
  },
  { _id: false }
);

// ── Chat Session Schema ────────────────────────────────────────────────────────
const chatSchema = new mongoose.Schema(
  {
    // Unique session identifier — used as the Socket.IO room name: chat_<sessionId>
    sessionId: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },

    customer:      { type: customerSchema,      default: () => ({}) },
    assignedAdmin: { type: assignedAdminSchema, default: () => ({}) },

    // Session lifecycle state
    status: {
      type:    String,
      enum:    ['waiting', 'active', 'closed'],
      default: 'waiting',
      index:   true,
    },

    // Full message history
    messages: [messageSchema],

    // Last activity timestamp — used for sorting in admin dashboard
    lastMessageAt: {
      type:    Date,
      default: Date.now,
      index:   true,
    },

    // Unread counters per side
    unreadByAdmin:    { type: Number, default: 0, min: 0 },
    unreadByCustomer: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    // Return lean-friendly virtuals
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Compound Indexes ───────────────────────────────────────────────────────────
chatSchema.index({ status: 1, lastMessageAt: -1 });  // Admin dashboard list
chatSchema.index({ 'customer.email': 1 });            // Look up by email

// ── Virtual: unread message count ─────────────────────────────────────────────
chatSchema.virtual('totalMessages').get(function () {
  return this.messages.length;
});

// ── Static: get dashboard summary (no messages array) ─────────────────────────
chatSchema.statics.forDashboard = function () {
  return this.find()
    .sort({ lastMessageAt: -1 })
    .select('-messages')
    .lean();
};

module.exports = mongoose.model('Chat', chatSchema);
