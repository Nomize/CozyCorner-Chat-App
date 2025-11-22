# **CozyCorner – Real-Time Chat Application**

CozyCorner is a real-time chat application built with  **React** ,  **Node.js** ,  **Express** ,  **Socket.io** , and  **MongoDB** .

It supports global chatrooms, private messaging, file sharing, reactions, read receipts, notifications, avatars, and more.

This project was built as part of the Week 5 Real-Time Communication assignment.

---

## **🌟 Features Implemented**

### **Core Functionality**

* Username-based authentication
* Live global chatroom
* Real-time messages (no page reload)
* Sender’s username + timestamp
* Online/offline user presence
* Typing indicators

### **Advanced Chat Features**

✔ Private messaging (DMs) with correct DM keying

✔ Multiple chat rooms

✔ File & image sharing

✔ Message reactions

✔ Read receipts

### **Real-Time Notifications**

* Unread message counts
* Sound alerts (DM, file, group message types)
* Browser notifications when app is unfocused
* Notification batching logic

### **Performance + UX**

* Reconnection logic
* Delivery acknowledgment
* Message search
* Sender and date filtering
* Mobile-responsive design
* Avatars displayed in DMs
* Clean message grouping for DM rooms

---

## **📁 Project Structure**

```
CozyCorner/
│
├── client/                       # React front-end
│   ├── public/
│   ├── src/
│   │   ├── components/           # UI components
│   │   │   ├── ChatHeader.jsx
│   │   │   ├── MessageBubble.jsx
│   │   │   ├── MessageInput.jsx
│   │   │   ├── OnlineUsers.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── TypingIndicators.jsx
│   │   │
│   │   ├── context/
│   │   │   └── NotificationContext.jsx
│   │   │
│   │   ├── hooks/
│   │   │   └── useSocket.js      # Core socket logic
│   │   │
│   │   ├── pages/
│   │   │   ├── ChatRoom.jsx
│   │   │   └── MessageList.jsx
│   │   │
│   │   ├── socket/
│   │   │   └── socket.js
│   │   │
│   │   ├── main.jsx
│   │   └── index.css
│   │
│   └── package.json
│
├── server/                       # Node.js backend
│   ├── config/
│   │   └── db.js                 # MongoDB connection
│   │
│   ├── controllers/
│   │   └── chatController.js     # Server socket events
│   │
│   ├── models/
│   │   ├── Message.js
│   │   ├── Room.js
│   │   └── User.js
│   │
│   ├── socket/
│   │   └── index.js              # Socket.io initialization
│   │
│   ├── uploads/                  # Stored uploaded files
│   │
│   ├── utils/
│   │   ├── helpers.js            # Utility functions
│   │   └── upload.js             # Multer upload config
│   │
│   ├── server.js
│   └── package.json
│
├── Week5-Assignment.md
└── README.md
```

---

## **🚀 Getting Started**

### **1. Install Dependencies**

#### Client:

```sh
cd client
npm install
npm run dev
```

#### Server:

```sh
cd server
npm install
npm start
```

---

## **🔧 Environment Variables**

Create a `.env` file inside  **server/** :

```
MONGO_URI=your_mongo_connection
ALLOWED_ORIGIN=http://localhost:5173
```

---

## **🧪 How It Works**

* When a user joins, Socket.io registers their username and avatar.
* Each user is placed in the **Global** room automatically.
* Users can join channels or open direct chats.
* Private messages use a stable DM key:

  `dm_<smallID>___<largeID>`
* Messages are saved to MongoDB and streamed to both sender and receiver.
* React groups conversations and updates the UI in real-time.

---

## **📌 Deployment**

### **Client (Vercel)**

🔗 Deployed Link: *(https://cozy-corner-chat-app.vercel.app/)*

### **Server (Render)**

🔗 API / Websocket URL: *(https://cozycorner-chat-app.onrender.com)*

---

## **📷 Screenshots**

*(Included in project folder.)*

---

## **📚 Resources Used**

* Socket.io v4
* React + Vite
* Express.js
* MongoDB + Mongoose
* DiceBear Avatars API

---
