// server/controllers/chatController.js
const Message = require('../models/Message');
const { trimMessages } = require('../utils/helpers'); // optional helper; if not present, you can remove use
// In-memory runtime structures
const users = {};       // socketId -> { username, id }
const typingUsers = {}; // socketId -> username
const rooms = {};       // roomName -> Set(socketId)
let recentMessages = []; // cache

const ensureRoom = (roomName) => {
  if (!rooms[roomName]) rooms[roomName] = new Set();
};

const addUserToRoom = (roomName, socketId) => {
  ensureRoom(roomName);
  rooms[roomName].add(socketId);
};

const removeUserFromRoom = (roomName, socketId) => {
  if (!rooms[roomName]) return;
  rooms[roomName].delete(socketId);
  if (rooms[roomName].size === 0) delete rooms[roomName];
};

const getUsersInRoom = (roomName) => {
  if (!rooms[roomName]) return [];
  return Array.from(rooms[roomName]).map((id) => users[id]).filter(Boolean);
};

const broadcastRoomUserList = (io, roomName) => {
  io.to(roomName).emit('room_user_list', { room: roomName, users: getUsersInRoom(roomName) });
};

const chatController = (io) => {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // user registers a username
    socket.on('user_join', (usernameRaw) => {
      const username = (usernameRaw || '').trim();
      if (!username) {
        socket.emit('username_error', 'Username is required');
        return;
      }
      users[socket.id] = { username, id: socket.id };
      socket.currentRooms = new Set();
      io.emit('user_list', Object.values(users));
      io.emit('user_joined', { username, id: socket.id });
    });

    // join a room
    socket.on('join_room', (roomNameRaw) => {
      if (!roomNameRaw) return;
      const roomName = String(roomNameRaw).trim();
      socket.join(roomName);
      addUserToRoom(roomName, socket.id);
      socket.currentRooms = socket.currentRooms || new Set();
      socket.currentRooms.add(roomName);
      socket.currentRoom = roomName;
      socket.emit('joined_room', roomName);
      io.to(roomName).emit('system_message', { room: roomName, message: `${users[socket.id]?.username || 'Someone'} joined ${roomName}` });
      broadcastRoomUserList(io, roomName);
    });

    // leave a room
    socket.on('leave_room', (roomNameRaw) => {
      if (!roomNameRaw) return;
      const roomName = String(roomNameRaw).trim();
      socket.leave(roomName);
      removeUserFromRoom(roomName, socket.id);
      if (socket.currentRooms) socket.currentRooms.delete(roomName);
      if (socket.currentRoom === roomName) socket.currentRoom = undefined;
      socket.emit('left_room', roomName);
      io.to(roomName).emit('system_message', { room: roomName, message: `${users[socket.id]?.username || 'Someone'} left ${roomName}` });
      broadcastRoomUserList(io, roomName);
    });

    // send text message (room-aware)
    socket.on('send_message', async ({ message, room }) => {
      const targetRoom = room || socket.currentRoom || 'global';
      const msgData = {
        sender: users[socket.id]?.username || 'Anonymous',
        senderId: socket.id,
        message: message || '',
        timestamp: new Date(),
        room: targetRoom,
        isPrivate: false,
        type: 'text',
      };

      try {
        const saved = new Message(msgData);
        await saved.save();
      } catch (err) {
        console.error('Error saving message:', err);
      }

      recentMessages.push(msgData);
      if (typeof trimMessages === 'function') {
        recentMessages = trimMessages(recentMessages, 200);
      } else if (recentMessages.length > 200) {
        recentMessages = recentMessages.slice(-200);
      }

      if (targetRoom && targetRoom !== 'global') {
        io.to(targetRoom).emit('receive_message', msgData);
      } else {
        io.emit('receive_message', msgData);
      }
    });

    // send file message (room-aware)
    socket.on('send_file', async ({ fileUrl, room }) => {
      if (!fileUrl) return;
      const targetRoom = room || socket.currentRoom || 'global';
      const msgData = {
        sender: users[socket.id]?.username || 'Anonymous',
        senderId: socket.id,
        fileUrl,
        message: null,
        timestamp: new Date(),
        room: targetRoom,
        isPrivate: false,
        type: 'file',
      };

      try {
        const saved = new Message(msgData);
        await saved.save();
      } catch (err) {
        console.error('Error saving file message:', err);
      }

      recentMessages.push(msgData);
      if (typeof trimMessages === 'function') {
        recentMessages = trimMessages(recentMessages, 200);
      } else if (recentMessages.length > 200) {
        recentMessages = recentMessages.slice(-200);
      }

      if (targetRoom && targetRoom !== 'global') {
        io.to(targetRoom).emit('receive_message', msgData);
      } else {
        io.emit('receive_message', msgData);
      }
    });

    // private message (to a specific socket id)
    socket.on('private_message', ({ to, message }) => {
      if (!to) return;
      const msgData = {
        sender: users[socket.id]?.username || 'Anonymous',
        senderId: socket.id,
        message,
        timestamp: new Date(),
        isPrivate: true,
        type: 'text',
      };

      socket.to(to).emit('private_message', msgData);
      socket.emit('private_message', msgData);
    });

    // typing indicator (room-aware)
    socket.on('typing', ({ isTyping, room }) => {
      const username = users[socket.id]?.username;
      if (!username) return;

      if (isTyping) typingUsers[socket.id] = username;
      else delete typingUsers[socket.id];

      const targetRoom = room || socket.currentRoom || null;
      if (targetRoom && targetRoom !== 'global') {
        io.to(targetRoom).emit('typing_users', Object.values(typingUsers));
      } else {
        io.emit('typing_users', Object.values(typingUsers));
      }
    });

    // fetch recent messages for a room
    socket.on('get_recent_messages', async ({ room }) => {
      const targetRoom = room || 'global';
      try {
        const msgs = await Message.find({ room: targetRoom }).sort({ timestamp: 1 }).limit(200).lean();
        socket.emit('recent_messages', { room: targetRoom, messages: msgs });
      } catch (err) {
        console.error('Error fetching recent messages:', err);
      }
    });

    // READ RECEIPT: mark message as read by this socket
    socket.on('message_read', async ({ messageId }) => {
      if (!messageId) return;
      try {
        // add socket id to readBy array, avoid duplicates
        const msg = await Message.findById(messageId);
        if (!msg) return;
        const already = (msg.readBy || []).includes(socket.id);
        if (!already) {
          msg.readBy.push(socket.id);
          await msg.save();
          // emit update to room or sender
          const room = msg.room || 'global';
          // send updated message to room so UI can update read receipts
          if (room && room !== 'global') io.to(room).emit('update_message', msg);
          else io.emit('update_message', msg);
          // also emit specifically to sender (if sender is connected)
          io.to(msg.senderId).emit('message_read', { messageId: msg._id, readerId: socket.id });
        }
      } catch (err) {
        console.error('Error marking message read:', err);
      }
    });

    // REACTIONS: user reacts/unreacts to a message
    socket.on('react_message', async ({ messageId, reaction }) => {
      if (!messageId || !reaction) return;
      try {
        const msg = await Message.findById(messageId);
        if (!msg) return;

        // use Map stored as object in mongoose; convert to JS Map-like handling
        const current = msg.reactions || {};
        // reactions in mongoose Map serialize as plain object, so handle safely
        const currentCount = (current.get && current.has(reaction)) ? current.get(reaction) : (current[reaction] || 0);

        // For simplicity we toggle: if user_id already reacted with same reaction we won't track per-user reaction here.
        // Instead, increment the reaction count. If you want per-user reaction toggles, you'd need to track reactions by user.
        const newCount = currentCount + 1;
        // set new count
        if (msg.reactions instanceof Map) {
          msg.reactions.set(reaction, newCount);
        } else {
          // plain object fallback
          msg.reactions = msg.reactions || {};
          msg.reactions[reaction] = newCount;
        }

        await msg.save();

        // broadcast updated message to room or global
        const room = msg.room || 'global';
        if (room && room !== 'global') io.to(room).emit('update_message', msg);
        else io.emit('update_message', msg);

      } catch (err) {
        console.error('Error reacting to message:', err);
      }
    });

    // disconnect cleanup
    socket.on('disconnect', () => {
      const username = users[socket.id]?.username;
      if (username) {
        io.emit('user_left', { username, id: socket.id });
      }

      // remove user from rooms
      Object.keys(rooms).forEach((roomName) => {
        if (rooms[roomName].has(socket.id)) {
          rooms[roomName].delete(socket.id);
          io.to(roomName).emit('system_message', { room: roomName, message: `${username || 'Someone'} disconnected` });
          broadcastRoomUserList(io, roomName);
          if (rooms[roomName].size === 0) delete rooms[roomName];
        }
      });

      delete users[socket.id];
      delete typingUsers[socket.id];

      io.emit('user_list', Object.values(users));
      io.emit('typing_users', Object.values(typingUsers));
    });
  });
};

module.exports = chatController;
