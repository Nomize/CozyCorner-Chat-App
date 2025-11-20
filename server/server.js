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
  .then(() => console.log("✔ MongoDB Connected Successfully"))
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
  reactions: Object,
  readBy: [String],
});

const Message = mongoose.model("Message", MessageSchema);

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
const users = {}; // id -> { id, username }
const typingUsers = {};

// ---------------------------
// SOCKET LOGIC
// ---------------------------
io.on("connection", (socket) => {
  console.log("⚡ Connected:", socket.id);

  // send rooms
  Room.find().then((rooms) => {
    socket.emit("room_list", rooms.map((r) => r.name));
  });

  // user joins
  socket.on("user_join", (username) => {
    users[socket.id] = { id: socket.id, username };
    io.emit("user_list", Object.values(users));
    io.emit("user_online", socket.id);
    console.log(`${username} joined (${socket.id})`);
  });

  // join room
  socket.on("join_room", async (roomName) => {
    if (!roomName || roomName.startsWith("dm_")) return;

    await Room.findOneAndUpdate({ name: roomName }, { name: roomName }, { upsert: true });
    socket.join(roomName);

    const rooms = await Room.find();
    io.emit("room_list", rooms.map((r) => r.name));

    console.log(`Socket ${socket.id} joined room ${roomName}`);
  });

  // ---------------------------
  // GROUP MESSAGE
  // ---------------------------
  socket.on("send_message", async (msg) => {
    try {
      const message = {
        message: msg.message,
        room: msg.room,
        sender: users[socket.id]?.username,
        senderId: socket.id,
        isPrivate: false,
        timestamp: new Date().toISOString(),
      };

      const saved = await Message.create(message);

      // send to room with REAL _id
      io.to(msg.room).emit("receive_message", { ...message, _id: saved._id });

      // delivered ack
      io.to(socket.id).emit("message_delivered", { messageId: saved._id });

    } catch (err) {
      console.log("send_message error:", err);
    }
  });

  // ---------------------------
  // PRIVATE MESSAGES
  // ---------------------------
  socket.on("private_message", async ({ to, message }) => {
    try {
      const msg = {
        message: message.message,
        sender: users[socket.id]?.username,
        senderId: socket.id,
        receiverId: to,
        isPrivate: true,
        type: message.type || "text",
        url: message.url || null,
        fileName: message.fileName || null,
        timestamp: new Date().toISOString(),
      };

      const saved = await Message.create(msg);

      const [a, b] = [socket.id, to].sort();
      const dmKey = `dm_${a}_${b}`;

      // send to both
      socket.to(to).emit("private_message", { ...msg, _id: saved._id, dmKey });
      socket.emit("private_message", { ...msg, _id: saved._id, dmKey });

      io.to(socket.id).emit("message_delivered", { messageId: saved._id });

      // unread count for recipient
      io.to(to).emit("unread_increment", { key: dmKey, count: 1 });

    } catch (err) {
      console.log("private_message error:", err);
    }
  });

  // ---------------------------
  // FILE UPLOAD MESSAGE
  // ---------------------------
  socket.on("send_file", async (f) => {
    try {
      const msg = {
        message: null,
        sender: users[socket.id]?.username,
        senderId: socket.id,
        timestamp: new Date().toISOString(),
        type: "file",
        fileName: f.fileName,
        url: f.url,
        room: f.room || null,
        isPrivate: !!f.isPrivate,
        receiverId: f.receiverId || null,
      };

      const saved = await Message.create(msg);

      if (msg.isPrivate) {
        const [a, b] = [socket.id, msg.receiverId].sort();
        const dmKey = `dm_${a}_${b}`;

        socket.to(msg.receiverId).emit("receive_file", { ...msg, _id: saved._id, dmKey });
        socket.emit("receive_file", { ...msg, _id: saved._id, dmKey });

        io.to(msg.receiverId).emit("unread_increment", { key: dmKey, count: 1 });
      } else {
        io.to(msg.room).emit("receive_file", { ...msg, _id: saved._id });
        io.to(socket.id).emit("message_delivered", { messageId: saved._id });
      }

    } catch (err) {
      console.log("send_file error:", err);
    }
  });

  // ---------------------------
  // REACTIONS
  // ---------------------------
  socket.on("message_reaction", ({ messageId, reaction }) => {
    io.emit("message_reaction", {
      messageId,
      reaction,
      user: users[socket.id]?.username,
    });
  });

  // ---------------------------
  // READ RECEIPTS (FIXED _id)
  // ---------------------------
  socket.on("read_receipt", ({ messageId }) => {
    if (!messageId) return;

    Message.findByIdAndUpdate(
      messageId,
      { $addToSet: { readBy: users[socket.id]?.username } }
    )
      .then(() => {
        io.emit("read_receipt", {
          messageId,
          user: users[socket.id]?.username,
        });
      })
      .catch((err) => console.log("read_receipt error:", err));
  });

  // ---------------------------
  // DISCONNECT
  // ---------------------------
  socket.on("disconnect", () => {
    if (users[socket.id]) {
      io.emit("user_offline", socket.id);
      delete users[socket.id];
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
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🔥 Server running on ${PORT}`));
