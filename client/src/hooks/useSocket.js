// src/hooks/useSocket.js
import { useEffect, useRef, useState } from "react";
import socket from "../socket/socket";

const makeDMKey = (a, b) => {
  if (!a || !b) return null;
  const [small, large] = [a, b].sort();
  return `dm_${small}___${large}`; // ✅ FIXED: Use triple underscore
};

const idOf = (m) => m && (m._id || m.id || m.tempId || null);

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [socketId, setSocketId] = useState(socket.id || null);

  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [currentRoom, setCurrentRoom] = useState("General");
  const currentRoomRef = useRef("General");

  const [unreadCounts, setUnreadCounts] = useState({});
  const unreadRef = useRef({});

  useEffect(() => { currentRoomRef.current = currentRoom; }, [currentRoom]);
  useEffect(() => { unreadRef.current = unreadCounts; }, [unreadCounts]);

  // ============================================
  // NOTIFICATION SYSTEM - Built-in, no context needed
  // ============================================
  
  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
        .then(permission => {
          console.log("📢 Notification permission:", permission);
        })
        .catch(err => {
          console.warn("Failed to request notification permission:", err);
        });
    }
  }, []);

  // Play notification sound
  const playNotificationSound = (type = "message") => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Different sounds for different message types
      const soundConfig = {
        message: { frequency: 520, type: "sine", duration: 0.1 },
        dm: { frequency: 800, type: "square", duration: 0.15 },
        file: { frequency: 600, type: "triangle", duration: 0.12 }
      };

      const config = soundConfig[type] || soundConfig.message;

      osc.type = config.type;
      osc.frequency.value = config.frequency;
      gain.gain.value = 0.1;

      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, config.duration * 1000);
    } catch (err) {
      console.warn("Audio playback failed:", err);
    }
  };

  // Show browser notification
  const showBrowserNotification = (title, body, icon = null) => {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const notification = new Notification(title, {
          body: body || "",
          icon: icon || "/icon.png",
          badge: "/badge.png",
          tag: "chat-message",
          requireInteraction: false,
          silent: false
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);
      } catch (err) {
        console.warn("Failed to show notification:", err);
      }
    }
  };

  // Unified notification handler
  const handleNotification = (message, isPrivate) => {
    // Don't notify for own messages
    if (message.senderId === socketId) return;

    const key = isPrivate 
      ? (message.dmKey || makeDMKey(message.senderId, message.receiverId))
      : (message.room || "General");

    // Only notify if not viewing this chat
    const isActiveChat = key === currentRoomRef.current;
    const shouldNotify = !document.hasFocus() || !isActiveChat;

    if (shouldNotify) {
      // Determine notification content
      const senderName = message.sender || "Someone";
      let title, body, soundType;

      if (isPrivate) {
        title = `💬 ${senderName}`;
        soundType = "dm";
      } else {
        title = `# ${message.room || "General"}`;
        soundType = "message";
      }

      if (message.type === "file") {
        body = `${senderName} sent ${message.fileName || "a file"}`;
        soundType = "file";
      } else {
        body = message.message || "New message";
      }

      // Play sound (always, even if browser notifications are blocked)
      playNotificationSound(soundType);

      // Show browser notification (if window not focused)
      if (!document.hasFocus()) {
        showBrowserNotification(title, body);
      }
    }
  };

  // ============================================
  // MESSAGE HELPERS
  // ============================================

  const pushMessage = (m) => {
    if (!m) return;
    const mid = idOf(m);
    setMessages((prev) => {
      if (!mid) return [...prev, { ...m, tempId: `${Date.now()}_${Math.random()}` }];
      if (prev.some((x) => idOf(x) === mid)) return prev;
      return [...prev, m];
    });
  };

  const incUnread = (key) => {
    if (!key) return;
    setUnreadCounts((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
  };

  const clearUnreadFor = (key) => {
    if (!key) return;
    setUnreadCounts((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  // ============================================
  // SOCKET EMIT HELPERS
  // ============================================

  const emitWhenConnected = (eventName, payload) => {
    if (socket.connected) {
      socket.emit(eventName, payload);
      return;
    }
    
    const onConn = () => {
      try { 
        socket.emit(eventName, payload); 
      } catch (err) {
        console.error(`Failed to emit ${eventName}:`, err);
      }
      socket.off("connect", onConn);
    };
    socket.on("connect", onConn);
  };

  // ============================================
  // PUBLIC API METHODS
  // ============================================

  const connect = (username, avatar) => {
    if (!socket.connected) socket.connect();

    const onceConnect = () => {
      setSocketId(socket.id);
      setIsConnected(true);
      if (username) socket.emit("user_join", {username, avatar});
      socket.off("connect", onceConnect);
    };

    socket.on("connect", onceConnect);
  };

  const joinRoom = (room) => {
    if (!room) return;

    currentRoomRef.current = room;
    setCurrentRoom(room);

    // Clear unread for this room/DM
    clearUnreadFor(room);

    // Don't emit join for DM keys
    if (String(room).startsWith("dm_")) {
      return;
    }

    emitWhenConnected("join_room", room);
  };

  const sendMessage = (message, room = currentRoomRef.current) => {
    if (!message || !message.trim()) return;

    const payload = { 
      id: Date.now(), 
      message: message.trim(), 
      room 
    };

    // Optimistic UI for group messages
    pushMessage({
      tempId: `${Date.now()}_local`,
      message: message.trim(),
      room,
      senderId: socketId,
      sender: "You",
      timestamp: new Date().toISOString(),
      isPrivate: false
    });

    emitWhenConnected("send_message", payload);
  };

  const sendPrivateMessage = (to, text, options = {}) => {
    if (!to || !text?.trim()) {
      console.error("❌ Invalid DM parameters:", { to, text });
      return;
    }

    // Validate that 'to' looks like a valid socket ID
    if (typeof to !== 'string' || to.length < 10) {
      console.error("❌ Invalid receiverId format:", to);
      return;
    }

    console.log("📤 Sending DM:", { to, text: text.substring(0, 20) + "..." });

    const payload = {
      to,
      message: {
        id: Date.now(),
        message: text.trim(),
        type: options.type || "text",
        url: options.fileUrl || null,
        fileName: options.fileName || null,
      },
    };

    // NO optimistic push for DMs to avoid duplicates
    emitWhenConnected("private_message", payload);
  };

  const sendFile = (fileMeta) => {
    emitWhenConnected("send_file", fileMeta);
  };

  const sendReadReceipt = (messageId) => {
    if (!messageId) return;
    emitWhenConnected("read_receipt", { messageId });
  };

  const sendReaction = (messageId, reaction) => {
    if (!messageId || !reaction) return;
    emitWhenConnected("message_reaction", { messageId, reaction });
  };

  const setTyping = (isTyping, room = currentRoomRef.current) => {
    emitWhenConnected("typing", { isTyping, room });
  };

  // ============================================
  // SOCKET EVENT LISTENERS
  // ============================================

  useEffect(() => {
    if (!socket) return;

    // ========================================
    // RECEIVE GROUP MESSAGE
    // ========================================
    const handleReceiveMessage = (m) => {
      console.log("📨 Received message:", m);

      // Add dmKey for private messages
      if (m.isPrivate && !m.dmKey) {
        m.dmKey = makeDMKey(m.senderId, m.receiverId);
      }

      // Remove optimistic message if this is our own echo
      if (m.senderId === socketId) {
        setMessages((prev) =>
          prev.filter((mm) => {
            // Don't remove if it's not a temp message
            if (!mm.tempId) return true;
            
            // Remove if it matches (same sender, message, and context)
            const isSameSender = mm.senderId === socketId;
            const isSameMessage = mm.message === m.message;
            const isSameContext = m.isPrivate 
              ? mm.isPrivate 
              : mm.room === m.room;
            
            return !(isSameSender && isSameMessage && isSameContext);
          })
        );
      }

      // Add the real message
      pushMessage(m);

      // Handle notifications
      const key = m.isPrivate 
        ? (m.dmKey || makeDMKey(m.senderId, m.receiverId))
        : (m.room || "General");

      // Increment unread if not viewing this chat
      if (m.senderId !== socketId && key !== currentRoomRef.current) {
        incUnread(key);
      }

      // Show notification
      handleNotification(m, m.isPrivate);
    };

    // ========================================
    // RECEIVE PRIVATE MESSAGE
    // ========================================
    const handlePrivateMessage = (m) => {
      console.log("💌 Received private message:", m);
      
      if (!m.dmKey) {
        m.dmKey = makeDMKey(m.senderId, m.receiverId);
      }
      
      // Reuse the same handler
      handleReceiveMessage(m);
    };

    // ========================================
    // RECEIVE FILE
    // ========================================
    const handleReceiveFile = (m) => {
      console.log("📎 Received file:", m);

      if (m.isPrivate && !m.dmKey) {
        m.dmKey = makeDMKey(m.senderId, m.receiverId);
      }

      // Remove optimistic if exists
      if (m.senderId === socketId) {
        setMessages((prev) =>
          prev.filter((mm) => {
            if (!mm.tempId) return true;
            
            const isSameSender = mm.senderId === socketId;
            const isSameFile = mm.fileName === m.fileName;
            const isSameContext = m.isPrivate 
              ? mm.isPrivate 
              : mm.room === m.room;
            
            return !(isSameSender && isSameFile && isSameContext);
          })
        );
      }

      pushMessage(m);

      // Handle notifications
      const key = m.isPrivate ? m.dmKey : (m.room || "General");

      if (m.senderId !== socketId && key !== currentRoomRef.current) {
        incUnread(key);
      }

      handleNotification(m, m.isPrivate);
    };

    // ========================================
    // OTHER LISTENERS
    // ========================================
    const handleUserList = (list) => {
      setUsers(list.map((u) => ({ ...u, online: u.online !== false })));
    };

    const handleTypingUsers = (list) => {
      setTypingUsers(list || []);
    };

    const handleRoomList = (list) => {
      setRooms(list || []);
    };

    const handleReadReceipt = ({ messageId, user }) => {
      setMessages((prev) =>
        prev.map((mm) =>
          idOf(mm) === messageId
            ? { ...mm, readBy: [...new Set([...(mm.readBy || []), user])] }
            : mm
        )
      );
    };

    const handleMessageReaction = ({ messageId, reaction, user }) => {
      setMessages((prev) =>
        prev.map((mm) =>
          idOf(mm) === messageId
            ? {
                ...mm,
                reactions: {
                  ...(mm.reactions || {}),
                  [reaction]: [...new Set([...(mm.reactions?.[reaction] || []), user])],
                },
              }
            : mm
        )
      );
    };

    const handleMessageDelivered = ({ messageId }) => {
      setMessages((prev) =>
        prev.map((mm) =>
          idOf(mm) === messageId ? { ...mm, delivered: true } : mm
        )
      );
    };

    const handleConnect = () => {
      console.log("✅ Socket connected:", socket.id);
      setSocketId(socket.id);
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      console.log("❌ Socket disconnected");
      setIsConnected(false);
    };

    const handleConnectError = (err) => {
      console.error("❌ Connection error:", err);
    };

    // Register all listeners
    socket.on("receive_message", handleReceiveMessage);
    socket.on("private_message", handlePrivateMessage);
    socket.on("receive_file", handleReceiveFile);

    socket.on("user_list", handleUserList);
    socket.on("typing_users", handleTypingUsers);
    socket.on("room_list", handleRoomList);

    socket.on("read_receipt", handleReadReceipt);
    socket.on("message_reaction", handleMessageReaction);
    socket.on("message_delivered", handleMessageDelivered);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    // Cleanup
    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("private_message", handlePrivateMessage);
      socket.off("receive_file", handleReceiveFile);

      socket.off("user_list", handleUserList);
      socket.off("typing_users", handleTypingUsers);
      socket.off("room_list", handleRoomList);

      socket.off("read_receipt", handleReadReceipt);
      socket.off("message_reaction", handleMessageReaction);
      socket.off("message_delivered", handleMessageDelivered);

      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
    };
  }, [socketId]); // Only depend on socketId

  // ============================================
  // RETURN PUBLIC API
  // ============================================
  return {
    socket,
    socketId,
    isConnected,
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
    sendFile,
    sendReadReceipt,
    sendReaction,
    setTyping,
    clearUnreadFor,
  };
};

export default useSocket;