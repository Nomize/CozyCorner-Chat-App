// client/src/pages/ChatRoom.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "../socket/socket";
import MessageList from "./MessageList";
import MessageInput from "../components/MessageInput";
import Sidebar from "../components/Sidebar";

const DEFAULT_ROOM = "General";
const DM_PREFIX = "dm_";

const getDMLabel = (dmKey, socketId, users) => {
  if (!dmKey.startsWith("dm_")) return dmKey;

  const parts = dmKey.split("_");
  if (parts.length !== 3) return dmKey;

  const idA = parts[1];
  const idB = parts[2];
  const otherId = idA === socketId ? idB : idA;

  const u = users.find((user) => user.id === otherId);
  return u ? u.username : "Direct Message";
};

export default function ChatRoom({ username, avatar }) {
  const {
    socket,
    socketId,
    messages,
    users,
    typingUsers,
    rooms,
    currentRoom,
    joinRoom,
    connect,
    sendMessage,
    sendPrivateMessage,
    setTyping,
    sendFile,
    sendReadReceipt,
    sendReaction,
    unreadCounts
  } = useSocket();

  const [activeChat, setActiveChat] = useState(DEFAULT_ROOM);
  const [label, setLabel] = useState(DEFAULT_ROOM);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const containerRef = useRef(null);

  /** INIT LOGIN */
  useEffect(() => {
    if (username) {
      connect(username);
      joinRoom(DEFAULT_ROOM);
      setActiveChat(DEFAULT_ROOM);
      setLabel(DEFAULT_ROOM);
    }
  }, [username]);

  /** NOTIFICATIONS PERMISSION */
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  /** GROUP MESSAGES */
  const grouped = useMemo(() => {
    const map = {};
    const push = (key, msg) => {
      map[key] = map[key] || [];
      if (!map[key].some((m) => m.id === msg.id)) map[key].push(msg);
    };

    (messages || []).forEach((m) => {
      if (m.isPrivate) {
        const a = m.senderId;
        const b = m.receiverId;
        const [s, l] = [a, b].sort();
        const key = `${DM_PREFIX}${s}_${l}`;
        push(key, m);
      } else {
        push(m.room || DEFAULT_ROOM, m);
      }
    });

    return map;
  }, [messages]);

  /** SWITCH ACTIVE ROOM / DM */
  useEffect(() => {
    if (!activeChat) return;

    if (activeChat.startsWith(DM_PREFIX)) {
      setLabel(getDMLabel(activeChat, socketId, users));
    } else {
      setLabel(activeChat);
    }

    // Read receipts
    const msgs = grouped[activeChat] || [];
    msgs.forEach((m) => {
      if (!m.readBy || !m.readBy.includes(username)) {
        sendReadReceipt(m.id);
      }
    });
  }, [activeChat, socketId, users]);

  /** OPEN A DM */
  const openDM = (u) => {
    if (!u) return;
    const [a, b] = [socketId, u.id].sort();
    setActiveChat(`dm_${a}_${b}`);
  };

  /** SEND TEXT MESSAGE */
  const handleSend = (text) => {
    if (activeChat.startsWith(DM_PREFIX)) {
      const parts = activeChat.split("_");
      const other = parts[1] === socketId ? parts[2] : parts[1];
      sendPrivateMessage(other, text);
    } else {
      sendMessage(text, activeChat);
    }
  };

  /** FILE UPLOAD */
  const handleFile = async (file) => {
    if (!file) return;

    try {
      const form = new FormData();
      form.append("file", file);

      const base = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
      const res = await fetch(`${base}/api/upload`, { method: "POST", body: form });
      const json = await res.json();

      if (json?.url) {
        sendFile({
          isPrivate: activeChat.startsWith(DM_PREFIX),
          receiverId: activeChat.startsWith(DM_PREFIX)
            ? activeChat.split("_")[1] === socketId
              ? activeChat.split("_")[2]
              : activeChat.split("_")[1]
            : null,
          room: activeChat.startsWith(DM_PREFIX) ? null : activeChat,
          url: json.url,
          fileName: file.name,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const activeMessages = (grouped[activeChat] || []).slice().sort((a, b) => (a.id || 0) - (b.id || 0));

  return (
    <div className="min-h-screen flex bg-gradient-to-b from-[#071024] to-[#03040a] text-white">

      {/* SIDEBAR */}
      <Sidebar
        username={username}
        avatar={avatar}
        rooms={rooms.filter(r => r !== "global")}
        users={users}
        socketId={socketId}
        activeChat={activeChat}
        setActiveChat={setActiveChat}
        openDM={openDM}
        unreadCounts={unreadCounts}
        isOpen={sidebarOpen}
        closeSidebar={() => setSidebarOpen(false)}
      />

      {/* MAIN SECTION */}
      <main className="flex-1 flex flex-col">

        {/* HEADER */}
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <button
            className="md:hidden text-2xl text-gray-300"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>

          <div className="text-lg font-semibold">{label}</div>

          <div className="text-sm text-gray-400">
            {users.length} online
          </div>
        </div>

        {/* MESSAGES */}
        <div ref={containerRef} className="flex-1 overflow-y-auto p-4">
          <MessageList
            messages={activeMessages}
            currentUser={username}
            typingUsers={typingUsers}
            onReact={sendReaction}
          />
        </div>

        {/* INPUT */}
        <div className="border-t border-gray-800 p-3 bg-gray-900">
          <MessageInput
            onSend={handleSend}
            onFile={handleFile}
            onTyping={(t) => setTyping(t, activeChat)}
          />
        </div>
      </main>
    </div>
  );
}
