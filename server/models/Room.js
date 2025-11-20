// server/models/Room.js
const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  displayName: { type: String },
  isDefault: { type: Boolean, default: false },
  members: [{ type: String }], // socketIds (optional)
}, { timestamps: true });

module.exports = mongoose.model('Room', RoomSchema);
