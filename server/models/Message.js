// server/models/Message.js
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  _id: { type: String }, // we'll use uuid string as _id
  room: { type: String, required: true }, // room name or dm_room key
  type: { type: String, enum: ['room', 'dm'], default: 'room' },
  senderId: { type: String, required: true }, // socketId of sender
  senderName: { type: String },
  receiverId: { type: String, default: null }, // for DMs
  text: { type: String, default: '' },
  fileName: { type: String, default: null },
  fileUrl: { type: String, default: null }, // if uploaded via /api/upload
  fileData: { type: String, default: null }, // base64 (if used)
  reactions: { type: Map, of: [String], default: {} }, // reaction => [usernames]
  readBy: { type: [String], default: [] }, // usernames who read
  delivered: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

module.exports = mongoose.model('Message', MessageSchema);
