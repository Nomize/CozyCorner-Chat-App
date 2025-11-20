// socket.js - CLEAN + FIXED COMPLETE VERSION
import { io } from "socket.io-client";
import { useEffect, useState } from "react";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [socketId, setSocketId] = useState(socket.id || null);

  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState("General");
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastMessage, setLastMessage] = useState(null); // <-- FIXED: properly declared

  // ---------------------- CONNECT -------------------------
  const connect = (username) => {
    socket.connect();

    socket.on("connect", () => {
      setSocketId(socket.id);
      setIsConnected(true);

      if (username) {
        socket.emit("user_join", username);
      }
    });
  };

  // ---------------------- ROOMS -------------------------
  const joinRoom = (roomName) => {
    if (!roomName) return;
    socket.emit("join_room", roomName);
    setCurrentRoom(roomName);
  };

  // ---------------------- SENDING -------------------------
  const sendMessage = (message, room = currentRoom) => {
    const id = Date.now();

    const packet = {
      id,
      message,
      room,
    };

    socket.emit("send_message", packet);

    // optimistic UI insert
    setMessages((prev) => [
      ...prev,
      {
        id,
        message,
        room,
        sender: "You",
        senderId: socket.id,
        timestamp: new Date().toISOString(),
        delivered: false,
      },
    ]);
  };

  const sendPrivateMessage = (to, messageText) => {
    const id = Date.now();

    const payload = {
      to,
      message: {
        id,
        message: messageText,
        isPrivate: true,
        senderId: socket.id,
        receiverId: to,
      },
    };

    socket.emit("private_message", payload);

    setMessages((prev) => [
      ...prev,
      {
        id,
        message: messageText,
        isPrivate: true,
        senderId: socket.id,
        receiverId: to,
        sender: "You",
        timestamp: new Date().toISOString(),
        delivered: false,
      },
    ]);
  };

  const setTyping = (isTyping, room = currentRoom) => {
    socket.emit("typing", { isTyping, room });
  };

  const sendFile = (fileData) => {
    const packet = {
      id: Date.now(),
      ...fileData,
    };

    socket.emit("send_file", packet);

    setMessages((prev) => [
      ...prev,
      {
        ...packet,
        sender: "You",
        senderId: socket.id,
        timestamp: new Date().toISOString(),
        delivered: false,
      },
    ]);
  };

  const sendReadReceipt = (messageId) => {
    socket.emit("read_receipt", { messageId });
  };

  const sendReaction = (messageId, reaction) => {
    socket.emit("message_reaction", { messageId, reaction });
  };

  // ---------------------- LISTENERS -------------------------
  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    const onReceiveMessage = (message) => {
      setMessages((prev) => [...prev, message]);
      setLastMessage(message);

      // unread logic
      if (message.room !== currentRoom) {
        setUnreadCounts((prev) => ({
          ...prev,
          [message.room]: (prev[message.room] || 0) + 1,
        }));
      }
    };

    const onPrivateMessage = (message) => {
      setMessages((prev) => [...prev, message]);
      setLastMessage(message);

      const key =
        message.senderId === socketId ? message.receiverId : message.senderId;

      if (key !== currentRoom) {
        setUnreadCounts((prev) => ({
          ...prev,
          [key]: (prev[key] || 0) + 1,
        }));
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("receive_message", onReceiveMessage);
    socket.on("private_message", onPrivateMessage);
    socket.on("user_list", (list) => setUsers(list));
    socket.on("typing_users", (list) => setTypingUsers(list));
    socket.on("room_list", (list) => setRooms(list));

    socket.on("receive_file", (fileMsg) =>
      setMessages((prev) => [...prev, fileMsg])
    );

    socket.on("read_receipt", ({ messageId, user }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, readBy: [...(m.readBy || []), user] }
            : m
        )
      );
    });

    socket.on("message_reaction", ({ messageId, reaction, user }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                reactions: {
                  ...(m.reactions || {}),
                  [reaction]: [...(m.reactions?.[reaction] || []), user],
                },
              }
            : m
        )
      );
    });

    socket.on("message_delivered", ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, delivered: true } : m
        )
      );
    });

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("receive_message", onReceiveMessage);
      socket.off("private_message", onPrivateMessage);
      socket.off("user_list");
      socket.off("typing_users");
      socket.off("room_list");
      socket.off("receive_file");
      socket.off("read_receipt");
      socket.off("message_reaction");
      socket.off("message_delivered");
    };
  }, [currentRoom, socketId]);

  return {
    socket,
    socketId,
    isConnected,
    lastMessage,
    messages,
    users,
    typingUsers,
    rooms,
    currentRoom,
    unreadCounts,

    connect,
    joinRoom,
    sendMessage,
    sendPrivateMessage,
    setTyping,
    sendFile,
    sendReadReceipt,
    sendReaction,
  };
};

export default socket;
