// client/src/socket/socket.js
import { io } from "socket.io-client";
import { useEffect, useRef, useState } from "react";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

/* Helpers */
const makeDMKey = (a, b) => {
  if (!a || !b) return null;
  const [small, large] = [a, b].sort();
  return `dm_${small}_${large}`;
};
const idOf = (m) => (m && (m._id || m.id || m.tempId || null));

/* Hook */
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [socketId, setSocketId] = useState(socket.id || null);

  const [messages, setMessages] = useState([]); // all messages
  const [users, setUsers] = useState([]); // { id, username, online, avatar }
  const [typingUsers, setTypingUsers] = useState([]); // usernames array
  const [rooms, setRooms] = useState([]); // room names

  const [currentRoom, setCurrentRoom] = useState("General");
  const currentRoomRef = useRef(currentRoom);
  useEffect(() => { currentRoomRef.current = currentRoom; }, [currentRoom]);

  const [unreadCounts, setUnreadCounts] = useState({});
  const unreadRef = useRef(unreadCounts);
  useEffect(() => { unreadRef.current = unreadCounts; }, [unreadCounts]);

  // audio helper
  const playTone = ({ frequency = 520, duration = 0.08, type = "sine", volume = 0.04 }) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.value = volume;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, duration * 1000);
    } catch (e) { /* audio blocked */ }
  };

  // dedupe & push message
  const pushMessage = (m) => {
    if (!m) return;
    const mid = idOf(m);
    setMessages((prev) => {
      if (!mid) {
        // attach a temp id to avoid repeated identical objects
        return [...prev, { ...m, tempId: `${Date.now()}_${Math.random()}` }];
      }
      if (prev.some((x) => idOf(x) === mid)) return prev;
      return [...prev, m];
    });
  };

  // unread helpers
  const incUnread = (key, n = 1) => {
    if (!key) return;
    setUnreadCounts((prev) => ({ ...prev, [key]: (prev[key] || 0) + n }));
  };
  const clearUnreadFor = (key) => {
    if (!key) return;
    setUnreadCounts((prev) => ({ ...prev, [key]: 0 }));
  };

  // ------------------------------
  // Public API methods
  // ------------------------------
  const connect = (username) => {
    if (!socket.connected) socket.connect();

    socket.once("connect", () => {
      setSocketId(socket.id);
      setIsConnected(true);
      if (username) socket.emit("user_join", username);
    });

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  };

  const joinRoom = (room) => {
    if (!room) return;
    // Do not create persistent rooms for DM keys
    if (String(room).startsWith("dm_")) {
      setCurrentRoom(room);
      clearUnreadFor(room);
      return;
    }

    // Only emit if room changed
    if (currentRoomRef.current !== room) {
      socket.emit("join_room", room);
    }
    setCurrentRoom(room);
    clearUnreadFor(room);
  };

  // Server-echo only: don't optimistic-insert on client
  const sendMessage = (message, room = currentRoomRef.current) => {
    if (!message) return;
    socket.emit("send_message", { id: Date.now(), message, room });
  };

  const sendPrivateMessage = (to, text, options = {}) => {
    if (!to) return;
    const payload = {
      to,
      message: {
        id: Date.now(),
        message: text || null,
        type: options.type || (options.fileUrl ? "file" : "text"),
        url: options.fileUrl || options.url || null,
        fileName: options.fileName || null,
      },
    };
    socket.emit("private_message", payload);
  };

  const setTyping = (isTyping, room = currentRoomRef.current) => {
    socket.emit("typing", { isTyping, room });
  };

  const sendFile = (fileData) => {
    // fileData: { room, url, fileName, isPrivate, receiverId }
    socket.emit("send_file", fileData);
  };

  const sendReadReceipt = (messageId) => {
    if (!messageId) return;
    socket.emit("read_receipt", { messageId });
  };

  const sendReaction = (messageId, reaction) => {
    if (!messageId || !reaction) return;
    socket.emit("message_reaction", { messageId, reaction });
  };

  // ------------------------------
  // Listeners - attach once
  // ------------------------------
  useEffect(() => {
    if (!socket) return;

    // receive group message
    const onReceiveMessage = (m) => {
      pushMessage(m);

      const key = m.isPrivate ? (m.dmKey || makeDMKey(m.senderId, m.receiverId)) : (m.room || "General");

      if (m.senderId !== socket.id) {
        const isForActive = key === currentRoomRef.current;
        playTone({ frequency: isForActive ? 520 : 540, type: "triangle" });

        const shouldNotify = (!document.hasFocus() || !isForActive);
        if (shouldNotify && "Notification" in window && Notification.permission === "granted") {
          try {
            const title = m.isPrivate ? `DM from ${m.sender}` : `${m.sender} in ${m.room || "General"}`;
            const body = (m.message || m.fileName || "New message").slice(0, 140);
            const n = new Notification(title, { body });
            n.onclick = () => window.focus();
          } catch (e) {}
        }
      }

      if (key !== currentRoomRef.current) incUnread(key, 1);
    };

    // receive private message (server echoes to both)
    const onPrivateMessage = (m) => {
      if (!m.dmKey) m.dmKey = makeDMKey(m.senderId, m.receiverId);
      pushMessage(m);

      const dmKey = m.dmKey;
      if (dmKey !== currentRoomRef.current) incUnread(dmKey, 1);

      if (m.senderId !== socket.id) {
        playTone({ frequency: 900, type: "square" });
        if ("Notification" in window && Notification.permission === "granted" && !document.hasFocus()) {
          try {
            new Notification(`DM from ${m.sender}`, { body: (m.message || m.fileName || "").slice(0, 140) });
          } catch (e) {}
        }
      }
    };

    const onUserList = (list) => {
      const normalized = (list || []).map((u) => ({ online: true, ...u }));
      setUsers(normalized);
    };

    const onTypingUsers = (list) => setTypingUsers(list || []);
    const onRoomList = (list) => setRooms(list || []);

    const onReceiveFile = (m) => {
      if (!m.dmKey && m.isPrivate) m.dmKey = makeDMKey(m.senderId, m.receiverId);
      pushMessage(m);

      const key = m.isPrivate ? m.dmKey : (m.room || "General");
      if (key !== currentRoomRef.current) incUnread(key, 1);
    };

    const onReadReceipt = ({ messageId, user }) => {
      setMessages((prev) =>
        prev.map((mm) =>
          (idOf(mm) === messageId) ? { ...mm, readBy: Array.from(new Set([...(mm.readBy || []), user])) } : mm
        )
      );
    };

    const onMessageReaction = ({ messageId, reaction, user }) => {
      setMessages((prev) =>
        prev.map((mm) =>
          (idOf(mm) === messageId)
            ? { ...mm, reactions: { ...(mm.reactions || {}), [reaction]: Array.from(new Set([...(mm.reactions?.[reaction] || []), user])) } }
            : mm
        )
      );
    };

    const onMessageDelivered = ({ messageId }) => {
      setMessages((prev) => prev.map((mm) => (idOf(mm) === messageId) ? { ...mm, delivered: true } : mm));
    };

    const onUserOnline = (id) => setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, online: true } : u)));
    const onUserOffline = (id) => setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, online: false } : u)));
    const onUnreadIncrement = ({ key, count = 1 }) => incUnread(key, count);

    // Attach listeners (only once)
    socket.on("receive_message", onReceiveMessage);
    socket.on("private_message", onPrivateMessage);
    socket.on("user_list", onUserList);
    socket.on("typing_users", onTypingUsers);
    socket.on("room_list", onRoomList);
    socket.on("receive_file", onReceiveFile);
    socket.on("read_receipt", onReadReceipt);
    socket.on("message_reaction", onMessageReaction);
    socket.on("message_delivered", onMessageDelivered);

    socket.on("user_online", onUserOnline);
    socket.on("user_offline", onUserOffline);
    socket.on("unread_increment", onUnreadIncrement);

    socket.on("connect", () => {
      setIsConnected(true);
      setSocketId(socket.id);
    });
    socket.on("disconnect", () => setIsConnected(false));

    // cleanup - remove what we added
    return () => {
      socket.off("receive_message", onReceiveMessage);
      socket.off("private_message", onPrivateMessage);
      socket.off("user_list", onUserList);
      socket.off("typing_users", onTypingUsers);
      socket.off("room_list", onRoomList);
      socket.off("receive_file", onReceiveFile);
      socket.off("read_receipt", onReadReceipt);
      socket.off("message_reaction", onMessageReaction);
      socket.off("message_delivered", onMessageDelivered);

      socket.off("user_online", onUserOnline);
      socket.off("user_offline", onUserOffline);
      socket.off("unread_increment", onUnreadIncrement);

      socket.off("connect");
      socket.off("disconnect");
    };
  }, []); // attach once

  // Return API
  return {
    socket,
    socketId,
    isConnected,
    messages,
    users,
    typingUsers,
    rooms,
    currentRoom,
    setCurrentRoom,
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
