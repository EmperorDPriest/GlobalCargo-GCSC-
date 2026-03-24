/**
 * Admin Model
 * Stores GCSC admin user accounts.
 * Passwords are stored as bcrypt hashes — never plain-text.
 */

const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  name: {
    type:     String,
    required: true,
    trim:     true,
  },
  email: {
    type:      String,
    required:  true,
    unique:    true,
    lowercase: true,
    trim:      true,
  },
  password: {
    type:     String,
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
