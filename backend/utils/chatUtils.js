/**
 * Chat Utility Functions
 * Shared helpers used by socket handlers and controllers.
 */

const crypto = require('crypto');

/**
 * Generate a cryptographically random session ID.
 * Format: sess_<timestamp_base36>_<8 random hex chars>
 * Example: sess_lf4xp7k_3a9bf12e
 *
 * @returns {string}
 */
function generateSessionId() {
  const ts  = Date.now().toString(36);
  const rnd = crypto.randomBytes(4).toString('hex');
  return `sess_${ts}_${rnd}`;
}

/**
 * Basic HTML/script sanitizer.
 * Strips tags and trims. Does NOT encode for rich HTML display —
 * the frontend must handle its own encoding when rendering.
 *
 * @param   {*}      input
 * @param   {number} [maxLength=4000]
 * @returns {string}
 */
function sanitize(input, maxLength = 4000) {
  if (input === null || input === undefined) return '';
  const str = String(input)
    .replace(/<[^>]*>/g, '')    // strip HTML tags
    .replace(/javascript:/gi, '') // block JS URIs
    .trim();
  return str.slice(0, maxLength);
}

/**
 * Validate an email address (permissive).
 *
 * @param   {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = { generateSessionId, sanitize, isValidEmail };
