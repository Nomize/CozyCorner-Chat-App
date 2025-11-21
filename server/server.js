require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const upload = require("./utils/upload");

// ---------------------------
// CONNECT MONGODB
// ---------------------------
if (!process.env.MONGO_URI) {
  console.error("❌ Missing MONGO_URI in .env");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

// ---------------------------
// MODELS
// ---------------------------
const RoomSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now },
});

const Room = mongoose.model("Room", RoomSchema);

const MessageSchema = new mongoose.Schema({
  message: String,
  sender: String,
  senderId: String,
  room: String,
  timestamp: String,
  isPrivate: Boolean,
  receiverId: String,
  fileName: String,
  url: String,
  type: String,
  reactions: { type: Map, of: [String], default: {} },
  readBy: [String],
  delivered: { type: Boolean, default: false }
});

const Message = mongoose.model("Message", MessageSchema);

// ---------------------------
// DM KEY HELPER — MUST BE ABOVE SOCKET LOGIC
// ---------------------------
function makeDMKey(a, b) {
  if (!a || !b) return null;
  const [small, large] = [a, b].sort();
  return `dm_${small}___${large}`;
}

// ---------------------------
// EXPRESS + SOCKET.IO
// ---------------------------
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------------------------
// SEED ROOMS
// ---------------------------
async function seedRooms() {
  const defaults = ["General", "MERN_Stack", "Family", "Friends"];
  for (const name of defaults) {
    await Room.findOneAndUpdate({ name }, { name }, { upsert: true });
  }
}
seedRooms();

// ---------------------------
// MEMORY STORES
// ---------------------------
const users = {}; // socketId -> { id, username, rooms: Set }
const roomTyping = {}; // room -> Set of usernames

// ---------------------------
// HELPER FUNCTIONS
// ---------------------------
function getUsernameById(socketId) {
  return users[socketId]?.username || "Unknown";
}

function broadcastUserList() {
  io.emit("user_list", Object.values(users).map(u => ({
    id: u.id,
    username: u.username,
    online: true
  })));
}

// ---------------------------
// SOCKET LOGIC
// ---------------------------
io.on("connection", (socket) => {
  console.log("⚡ Connected:", socket.id);

  // Send room list immediately
  Room.find().then((rooms) => {
    socket.emit("room_list", rooms.map((r) => r.name));
  });

  // ---------------------------
  // USER JOIN
  // ---------------------------
  socket.on("user_join", async ({username, avatar}) => {
    users[socket.id] = { 
      id: socket.id, 
      username,
      avatar: avatar || null,
      rooms: new Set()
    };
    
    broadcastUserList();
    io.emit("user_online", socket.id);
    
    // AUTO-JOIN DEFAULT ROOMS
    const defaultRooms = await Room.find();
    defaultRooms.forEach(room => {
      socket.join(room.name);
      users[socket.id].rooms.add(room.name);
      console.log(`${username} auto-joined ${room.name}`);
    });
    
    console.log(`✅ ${username} joined (${socket.id})`);
  });

  // ---------------------------
  // JOIN ROOM
  // ---------------------------
  socket.on("join_room", async (roomName) => {
    if (!roomName || roomName.startsWith("dm_")) return;

    await Room.findOneAndUpdate({ name: roomName }, { name: roomName }, { upsert: true });
    socket.join(roomName);
    
    if (users[socket.id]) {
      users[socket.id].rooms.add(roomName);
    }

    const rooms = await Room.find();
    io.emit("room_list", rooms.map((r) => r.name));

    console.log(`📌 Socket ${socket.id} joined room ${roomName}`);
  });

  // ---------------------------
  // TYPING INDICATOR
  // ---------------------------
  socket.on("typing", ({ isTyping, room }) => {
    if (!room || !users[socket.id]) return;
    
    const username = users[socket.id].username;
    
    if (!roomTyping[room]) {
      roomTyping[room] = new Set();
    }

    if (isTyping) {
      roomTyping[room].add(username);
    } else {
      roomTyping[room].delete(username);
    }

    const typingList = Array.from(roomTyping[room]);
    
    // Broadcast to room (DM or group)
    if (room.startsWith("dm_")) {
      const [id1, id2] = room.replace("dm_", "").split("_");
      // Send to both parties
      if (id1 !== socket.id) io.to(id1).emit("typing_users", typingList);
      if (id2 !== socket.id) io.to(id2).emit("typing_users", typingList);
    } else {
      // Broadcast to everyone in room EXCEPT sender
      socket.to(room).emit("typing_users", typingList);
    }
  });

  // ---------------------------
  // GROUP MESSAGE
  // ---------------------------
  socket.on("send_message", async (msg) => {
    try {
      if (!users[socket.id]) {
        console.error("❌ User not found for socket:", socket.id);
        return;
      }

      const message = {
        message: msg.message,
        room: msg.room,
        sender: users[socket.id].username,
        senderId: socket.id,
         senderAvatar: users[socket.id].avatar || null,
        isPrivate: false,
        timestamp: new Date().toISOString(),
        delivered: true
      };

      const saved = await Message.create(message);

      // Emit to EVERYONE in the room (including sender)
      io.to(msg.room).emit("receive_message", { 
        ...message, 
        _id: saved._id.toString() 
      });

      // Delivery ack to sender
      socket.emit("message_delivered", { messageId: saved._id.toString() });

      console.log(`💬 [${msg.room}] ${users[socket.id].username}: ${msg.message}`);
    } catch (err) {
      console.error("❌ send_message error:", err);
    }
  });

  // ---------------------------
  // PRIVATE MESSAGES
  // ---------------------------
  socket.on("private_message", async ({ to, message }) => {
    try {
      if (!users[socket.id]) return;

      const msg = {
        message: message.message,
        sender: users[socket.id].username,
        senderId: socket.id,
        senderAvatar: users[socket.id].avatar || null,   
        receiverId: to,
        isPrivate: true,
        type: message.type || "text",
        url: message.url || null,
        fileName: message.fileName || null,
        timestamp: new Date().toISOString(),
        delivered: true
      };

      // In your backend server code
const dmKey = makeDMKey(socket.id, to);

    const saved = await Message.create(msg);

    const payload = {
      ...msg,
      _id: saved._id.toString(),
      dmKey,
    };

      // Send to receiver
      io.to(to).emit("private_message", payload);
      
      // Echo to sender
      socket.emit("private_message", payload);

      // Delivery ack
      socket.emit("message_delivered", { messageId: saved._id.toString() });

      console.log(`💌 DM: ${users[socket.id].username} -> ${getUsernameById(to)}`);
    } catch (err) {
      console.error("❌ private_message error:", err);
    }
  });

  // ---------------------------
  // FILE UPLOAD MESSAGE
  // ---------------------------
  socket.on("send_file", async (f) => {
    try {
      if (!users[socket.id]) return;

      const msg = {
        message: null,
        sender: users[socket.id].username,
        senderId: socket.id,
        senderAvatar: users[socket.id].avatar || null, 
        timestamp: new Date().toISOString(),
        type: "file",
        fileName: f.fileName,
        url: f.url,
        room: f.room || null,
        isPrivate: !!f.isPrivate,
        receiverId: f.receiverId || null,
        delivered: true
      };

      const saved = await Message.create(msg);

      if (msg.isPrivate) {
        const [a, b] = [socket.id, msg.receiverId].sort();
        const dmKey = makeDMKey(a, b);

        const payload = { ...msg, _id: saved._id.toString(), dmKey };

        io.to(msg.receiverId).emit("receive_file", payload);
        socket.emit("receive_file", payload);
      } else {
        io.to(msg.room).emit("receive_file", { 
          ...msg, 
          _id: saved._id.toString() 
        });
        socket.emit("message_delivered", { messageId: saved._id.toString() });
      }

      console.log(`📎 File shared: ${f.fileName}`);
    } catch (err) {
      console.error("❌ send_file error:", err);
    }
  });

  // ---------------------------
  // REACTIONS
  // ---------------------------
  socket.on("message_reaction", async ({ messageId, reaction }) => {
    try {
      if (!users[socket.id]) return;

      const username = users[socket.id].username;

      // Update in DB
      const message = await Message.findById(messageId);
      if (!message) return;

      if (!message.reactions) message.reactions = new Map();
      
      const reactionUsers = message.reactions.get(reaction) || [];
      if (!reactionUsers.includes(username)) {
        reactionUsers.push(username);
        message.reactions.set(reaction, reactionUsers);
        await message.save();
      }

      // Broadcast
      io.emit("message_reaction", {
        messageId,
        reaction,
        user: username,
      });

      console.log(`👍 ${username} reacted with ${reaction}`);
    } catch (err) {
      console.error("❌ message_reaction error:", err);
    }
  });

  // ---------------------------
  // READ RECEIPTS
  // ---------------------------
  socket.on("read_receipt", async ({ messageId }) => {
    if (!messageId || !users[socket.id]) return;

    try {
      const username = users[socket.id].username;

      await Message.findByIdAndUpdate(
        messageId,
        { $addToSet: { readBy: username } }
      );

      io.emit("read_receipt", {
        messageId,
        user: username,
      });
    } catch (err) {
      console.error("❌ read_receipt error:", err);
    }
  });

  // ---------------------------
  // DISCONNECT
  // ---------------------------
  socket.on("disconnect", () => {
    if (users[socket.id]) {
      const username = users[socket.id].username;
      
      // Clear typing indicators
      Object.keys(roomTyping).forEach(room => {
        if (roomTyping[room]) {
          roomTyping[room].delete(username);
          const typingList = Array.from(roomTyping[room]);
          io.to(room).emit("typing_users", typingList);
        }
      });

      io.emit("user_offline", socket.id);
      delete users[socket.id];
      
      broadcastUserList();
      
      console.log(`👋 ${username} disconnected`);
    }
  });
});

// ---------------------------
// UPLOAD ROUTE
// ---------------------------
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file received" });

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, fileName: req.file.originalname });
});

// ---------------------------
// START SERVER
// ---------------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready`);
});