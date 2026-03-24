/**
 * GCSC Tracking Number Generator
 * ─────────────────────────────────────────────────────────────────────────────
 * Format: GCSC26-XXXXXXXX
 *   GCSC   = company prefix
 *   26     = last 2 digits of current year
 *   XXXXXX = 8 random uppercase alphanumeric chars (no ambiguous 0/O/1/I)
 *
 * Example: GCSC26-K7MN4PRQ
 */

const { customAlphabet } = require('nanoid');

// Unambiguous uppercase alphanumeric alphabet
const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

function generateTracking() {
  const prefix = 'GCSC';
  const year   = new Date().getFullYear().toString().slice(-2);
  const random = nanoid();
  return `${prefix}${year}-${random}`;
}

module.exports = generateTracking;
