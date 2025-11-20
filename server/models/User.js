// server/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  socketId: { type: String, index: true },
  username: { type: String, required: true },
  avatar: { type: String, default: '' },
  lastSeen: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
