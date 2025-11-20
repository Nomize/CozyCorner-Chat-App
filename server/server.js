// server.js - Main server file for Socket.io chat application

require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const upload = require("./utils/upload");
const mongoose = require("mongoose");

// --------------------------------------------------
// 1. CONNECT TO MONGODB
// --------------------------------------------------

console.log("Loaded URI:", process.env.MONGO_URI);

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

// --------------------------------------------------
// 2. DEFINE SCHEMAS + MODELS (Fix for rooms buffering error)
// --------------------------------------------------

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
    fileData: String,
    type: String,
    reactions: Object,
    readBy: [String],
});

const Message = mongoose.model("Message", MessageSchema);

// --------------------------------------------------
// 3. EXPRESS APP + SOCKET.IO INITIALIZATION
// --------------------------------------------------

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
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --------------------------------------------------
// 4. SEED DEFAULT ROOMS ONLY IF NOT ALREADY IN DATABASE
// --------------------------------------------------

async function seedRooms() {
    const defaults = ["global", "General", "MERN_Stack", "Family", "Friends"];
    for (const name of defaults) {
        await Room.findOneAndUpdate(
            { name },
            { name },
            { upsert: true, new: true }
        );
    }
    console.log("✔ Default chat rooms verified");
}
seedRooms();

// --------------------------------------------------
// 5. SOCKET.IO LOGIC (your instructor’s logic preserved)
// --------------------------------------------------

const users = {};
const typingUsers = {};

io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // SEND ROOMS FROM DB
    Room.find().then((rooms) => {
        socket.emit("room_list", rooms.map((r) => r.name));
    });

    socket.on("user_join", (username) => {
        users[socket.id] = { username, id: socket.id };
        socket.join("global");

        io.emit("user_list", Object.values(users));
        io.emit("user_joined", { username, id: socket.id });

        console.log(`${username} joined the chat`);
    });

    // JOIN ROOM
    socket.on("join_room", async (roomName) => {
        await Room.findOneAndUpdate(
            { name: roomName },
            { name: roomName },
            { upsert: true }
        );

        socket.join(roomName);

        const rooms = await Room.find();
        io.emit("room_list", rooms.map((r) => r.name));

        console.log(`User ${users[socket.id]?.username} joined room ${roomName}`);
    });

    // SEND GROUP MESSAGE
    socket.on("send_message", async (msg) => {
        const message = {
            ...msg,
            sender: users[socket.id]?.username,
            senderId: socket.id,
            timestamp: new Date().toISOString(),
        };

        await Message.create(message);

        io.to(message.room).emit("receive_message", message);
    });

    // PRIVATE MESSAGE
    socket.on("private_message", async ({ to, message }) => {
        const msg = {
            id: message.id || Date.now(),
            message: message.message,
            sender: users[socket.id]?.username,
            senderId: socket.id,
            receiverId: to,
            timestamp: new Date().toISOString(),
            isPrivate: true,
        };

        await Message.create(msg);

        socket.to(to).emit("private_message", msg);
        socket.emit("private_message", msg);
    });

    // TYPING INDICATOR
    socket.on("typing", ({ isTyping, room }) => {
        if (isTyping) typingUsers[socket.id] = users[socket.id]?.username;
        else delete typingUsers[socket.id];

        io.to(room).emit("typing_users", Object.values(typingUsers));
    });

    // FILE / IMAGE SHARING
    socket.on("send_file", async (f) => {
        const msg = {
            ...f,
            id: Date.now(),
            sender: users[socket.id]?.username,
            senderId: socket.id,
            timestamp: new Date().toISOString(),
            type: "file",
        };

        await Message.create(msg);
        io.to(f.room).emit("receive_file", msg);
    });

    // REACTIONS
    socket.on("message_reaction", async ({ messageId, reaction }) => {
        io.emit("message_reaction", {
            messageId,
            reaction,
            user: users[socket.id]?.username,
        });
    });

    // READ RECEIPT
    socket.on("read_receipt", ({ messageId }) => {
        io.emit("read_receipt", {
            messageId,
            user: users[socket.id]?.username,
        });
    });

    socket.on("disconnect", () => {
        if (users[socket.id]) {
            io.emit("user_left", users[socket.id]);
            delete users[socket.id];
        }
    });
});

// --------------------------------------------------
// 6. ROUTES
// --------------------------------------------------

app.get("/api/messages", async (req, res) => {
    const msgs = await Message.find().limit(200).sort({ timestamp: 1 });
    res.json(msgs);
});

// --------------------------------------------------

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = { app, server, io };
