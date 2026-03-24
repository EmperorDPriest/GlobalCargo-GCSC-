/**
 * Shipment Model
 * Core data structure for all GCSC shipment records.
 */

const mongoose = require('mongoose');

// A single timeline event (status-history entry)
const timelineEventSchema = new mongoose.Schema({
  status: {
    type:     String,
    required: true,
  },
  location: {
    type:     String,
    required: true,
  },
  description: {
    type:     String,
    required: true,
  },
  timestamp: {
    type:    Date,
    default: Date.now,
  },
}, { _id: true });

const shipmentSchema = new mongoose.Schema({

  // ── Tracking number ────────────────────────────────────────────────────────
  trackingNumber: {
    type:     String,
    required: true,
    unique:   true,
    uppercase: true,
    index:    true,
    trim:     true,
  },

  // ── Current status ─────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: [
      'Pending',
      'Processing',
      'In Transit',
      'Out for Delivery',
      'Delivered',
      'Exception',
      'On Hold',
      'Returned',
    ],
    default: 'Pending',
  },

  // ── Sender ─────────────────────────────────────────────────────────────────
  sender: {
    name:    { type: String, required: true, trim: true },
    email:   { type: String, trim: true, lowercase: true },
    phone:   { type: String, trim: true },
    address: { type: String, required: true, trim: true },
    city:    { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
  },

  // ── Receiver ───────────────────────────────────────────────────────────────
  receiver: {
    name:    { type: String, required: true, trim: true },
    email:   { type: String, trim: true, lowercase: true },
    phone:   { type: String, trim: true },
    address: { type: String, required: true, trim: true },
    city:    { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
  },

  // ── Package info ───────────────────────────────────────────────────────────
  packageInfo: {
    description: { type: String, default: 'General Cargo', trim: true },
    weight:      { type: String, trim: true },
    dimensions:  { type: String, trim: true },
    quantity:    { type: Number, default: 1, min: 1 },
  },

  // ── Service type ───────────────────────────────────────────────────────────
  service: {
    type:    String,
    default: 'Standard',
    trim:    true,
  },

  // ── Route ──────────────────────────────────────────────────────────────────
  origin:      { type: String, required: true, trim: true },  // e.g. "New York, USA"
  destination: { type: String, required: true, trim: true },  // e.g. "London, UK"

  // ── Current GPS position (manually set by admin) ───────────────────────────
  currentLocation: {
    name: { type: String, default: '' },
    lat:  { type: Number, default: 0 },
    lng:  { type: Number, default: 0 },
  },

  // ── Dates ──────────────────────────────────────────────────────────────────
  estimatedDelivery: { type: Date },

  // ── Status history ─────────────────────────────────────────────────────────
  timeline: [timelineEventSchema],

  // ── Admin-only fields ──────────────────────────────────────────────────────
  isArchived: { type: Boolean, default: false },
  adminNotes: { type: String, trim: true },

}, { timestamps: true });

// Virtual: how many days since shipment was created
shipmentSchema.virtual('daysSinceCreated').get(function () {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

module.exports = mongoose.model('Shipment', shipmentSchema);
