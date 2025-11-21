import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSocket } from "../hooks/useSocket";
import MessageList from "./MessageList";
import MessageInput from "../components/MessageInput";
import Sidebar from "../components/Sidebar";
import EmojiPicker from "emoji-picker-react";
import socket from "../socket/socket";

const DEFAULT_ROOM = "General";

const makeDMKey = (a, b) => {
  if (!a || !b) return null;
  const [s, l] = [a, b].sort();
  return `dm_${s}___${l}`;
};

export default function ChatRoom({ username, avatar }) {
  const {
    socketId,
    messages,
    users,
    typingUsers,
    rooms,
    connect,
    joinRoom,
    sendMessage,
    sendPrivateMessage,
    setTyping,
    sendFile,
    sendReadReceipt,
    sendReaction,
    unreadCounts,
    clearUnreadFor
  } = useSocket();

  const [activeChat, setActiveChat] = useState(DEFAULT_ROOM);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeDMAvatar, setActiveDMAvatar] = useState(null);
  const [label, setLabel] = useState(DEFAULT_ROOM);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  

  // SEARCH + FILTER STATE
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // all | text | files | sender | date
  const [filterSender, setFilterSender] = useState("");   // user id
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const messageInputRef = useRef(null);
  const hasConnected = useRef(false);

  /** INITIAL LOGIN */
  useEffect(() => {
    if (!username || hasConnected.current) return;

    connect(username);

    const handleConnect = () => {
      joinRoom(DEFAULT_ROOM);
      setActiveChat(DEFAULT_ROOM);
      hasConnected.current = true;
    };

    socket.once("connect", handleConnect);

    return () => {
      socket.off("connect", handleConnect);
    };
  }, [username, connect, joinRoom]);

  /** GROUP MESSAGES */
  const grouped = useMemo(() => {
    const map = {};
    const push = (key, msg) => {
      if (!key) return;
      if (!map[key]) map[key] = [];

      const exists = map[key].some(
        (m) =>
          (m._id && m._id === msg._id) ||
          (m.id && m.id === msg.id) ||
          (m.tempId && m.tempId === msg.tempId)
      );

      if (!exists) map[key].push(msg);
    };

    (messages || []).forEach((m) => {
      if (m.isPrivate) {
        const dmKey = m.dmKey || makeDMKey(m.senderId, m.receiverId);
        console.log("📦 Grouping DM:", { dmKey, message: m.message, senderId: m.senderId, receiverId: m.receiverId });
        if (dmKey) push(dmKey, m);
      } else {
        push(m.room || DEFAULT_ROOM, m);
      }
    });

    console.log("📊 Grouped messages:", Object.keys(map));
    return map;
  }, [messages, socketId]);

  /** SEARCH + FILTERED activeMessages */
  const activeMessages = useMemo(() => {
    const msgs = grouped[activeChat] || [];

    // date helpers
    const dateInRange = (ts) => {
      if (!ts) return false;
      const t = new Date(ts).setHours(0,0,0,0);
      if (filterDateFrom) {
        const f = new Date(filterDateFrom).setHours(0,0,0,0);
        if (t < f) return false;
      }
      if (filterDateTo) {
        const to = new Date(filterDateTo).setHours(23,59,59,999);
        if (new Date(ts) > to) return false;
      }
      return true;
    };

    let filtered = msgs;

    // apply filterMode
    if (filterMode === "files") {
      filtered = filtered.filter(m => m.type === "file" && m.url);
    } else if (filterMode === "sender" && filterSender) {
      filtered = filtered.filter(m => (m.senderId === filterSender || m.sender === filterSender));
    } else if (filterMode === "date" && (filterDateFrom || filterDateTo)) {
      filtered = filtered.filter(m => dateInRange(m.timestamp));
    } else if (filterMode === "text") {
      // we'll still apply same logic as below search
      filtered = filtered.filter(m => !!m.message);
    }

    // apply free text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((m) => {
        return (
          (m.message && m.message.toLowerCase().includes(q)) ||
          (m.sender && m.sender.toLowerCase().includes(q)) ||
          (m.fileName && m.fileName.toLowerCase().includes(q)) ||
          (m.timestamp && m.timestamp.toLowerCase().includes(q))
        );
      });
    }

    // finally sort chronologically
    return filtered.slice().sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [grouped, activeChat, searchQuery, filterMode, filterSender, filterDateFrom, filterDateTo]);

  /** UPDATE LABEL + READ RECEIPTS - FIXED */
  useEffect(() => {
    if (!activeChat || !socketId) return;

    console.log("🔄 Active chat changed to:", activeChat);

    if (activeChat.startsWith("dm_")) {
      const idsString = activeChat.substring(3);
      // supports single underscore separation
      const [a, b] = idsString.split("___");
      const otherId = a === socketId ? b : a;
      const otherUser = users.find((u) => u.id === otherId);
      console.log("👤 DM with:", otherUser?.username, "| Other ID:", otherId);
      setLabel(otherUser?.username || "DM");
      setActiveDMAvatar(otherUser?.avatar || null);
      clearUnreadFor(activeChat);
    } else {
      setLabel(activeChat);
      // Only join room for non-DM rooms
      if (activeChat !== DEFAULT_ROOM || !hasConnected.current) {
        joinRoom(activeChat);
      }
      clearUnreadFor(activeChat);
    }

    // Send read receipts
    const msgs = grouped[activeChat] || [];
    console.log("📬 Messages in active chat:", msgs.length);
    msgs.forEach((m) => {
      const idToUse = m._id || m.id;
      if (idToUse && m.senderId !== socketId && !m.readBy?.includes(socketId)) {
        sendReadReceipt(idToUse);
      }
    });
  }, [activeChat, socketId, users]); // Removed functions from deps

  /** OPEN DM - Use useCallback */
  const openDM = useCallback((u) => {
    if (!u || !socketId) return;
    const key = makeDMKey(socketId, u.id);
    setActiveChat(key);
  }, [socketId]);

  /** SEND MESSAGE */
  const handleSend = (text) => {
    if (!text.trim()) return;
    if (activeChat.startsWith("dm_")) {
      const idsString = activeChat.substring(3);
      const [a, b] = idsString.split("___");
      const other = a === socketId ? b : a;

      console.log("🔍 Sending DM to:", other, "from:", socketId);
      sendPrivateMessage(other, text.trim());
    } else {
      sendMessage(text.trim(), activeChat);
    }
  };

  /** FILE UPLOAD */
  const handleFile = async (file) => {
    try {
      const form = new FormData();
      form.append("file", file);

      const base = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
      const res = await fetch(`${base}/api/upload`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error("Upload failed");

      const json = await res.json();
      if (!json.url) return;

      if (activeChat.startsWith("dm_")) {
        const idsString = activeChat.substring(3);
        const [a, b] = idsString.split("___");
        const other = a === socketId ? b : a;
        sendFile({ isPrivate: true, receiverId: other, url: json.url, fileName: file.name });
      } else {
        sendFile({ isPrivate: false, room: activeChat, url: json.url, fileName: file.name });
      }
    } catch (err) {
      console.error(err);
    }
  };

  /** SORT MESSAGES (handled above by activeMessages) */
  const sortedActiveMessages = activeMessages;

  /** ADD EMOJI */
  const addEmoji = (emoji) => {
    if (messageInputRef.current?.addEmoji) {
      messageInputRef.current.addEmoji(emoji);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-b from-[#071024] to-[#03040a] text-white">
      <Sidebar
        username={username}
        avatar={avatar}
        rooms={rooms}
        users={users}
        socketId={socketId}
        activeChat={activeChat}
        setActiveChat={setActiveChat}
        openDM={openDM}
        unreadCounts={unreadCounts}
        isOpen={sidebarOpen}
        closeSidebar={() => setSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* HEADER */}
        <div className="px-4 py-3 border-b border-gray-800 bg-[#0f1624] shadow flex items-center justify-between">
          <button className="text-2xl md:hidden" onClick={() => setSidebarOpen(true)}>
            ☰
          </button>

          <div className="flex-1 flex flex-col items-center mx-auto max-w-2xl">
            <div className="w-full flex items-center gap-3">
              <div className="flex-1 text-left">
                <span className="text-xl font-bold text-indigo-400 tracking-wide">CozyCorner</span>
{activeChat.startsWith("dm_") && activeDMAvatar && (
  <img
    src={activeDMAvatar}
    className="w-8 h-8 rounded-full object-cover mb-1 border border-gray-700"
  />
)}

                <div className="text-xs text-gray-400">{label}</div>
              </div>

              {/* SEARCH INPUT */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1 rounded bg-gray-800 text-gray-300 text-sm focus:outline-none border border-gray-700"
                />
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setFilterMode("all");
                    setFilterSender("");
                    setFilterDateFrom("");
                    setFilterDateTo("");
                  }}
                  className="px-2 py-1 text-xs bg-gray-700 rounded"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* FILTERS */}
            <div className="mt-2 w-full flex gap-2 items-center">
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value)}
                className="px-2 py-1 bg-gray-800 text-sm rounded border border-gray-700"
              >
                <option value="all">All</option>
                <option value="text">Text only</option>
                <option value="files">Files only</option>
                <option value="sender">By sender</option>
                <option value="date">By date</option>
              </select>

              {filterMode === "sender" && (
                <select
                  value={filterSender}
                  onChange={(e) => setFilterSender(e.target.value)}
                  className="px-2 py-1 bg-gray-800 text-sm rounded border border-gray-700"
                >
                  <option value="">— Choose sender —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              )}

              {filterMode === "date" && (
                <>
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="px-2 py-1 bg-gray-800 text-sm rounded border border-gray-700"
                  />
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="px-2 py-1 bg-gray-800 text-sm rounded border border-gray-700"
                  />
                </>
              )}
            </div>
          </div>

          <div className="text-sm text-gray-400">{users.length} online</div>
        </div>

        {/* MESSAGE AREA */}
        <div className="flex-1 overflow-y-auto p-4 pb-32 mt-2">
          <MessageList
            messages={sortedActiveMessages}
            currentUser={username}
            currentUserId={socketId}
            typingUsers={typingUsers}
            onReact={sendReaction}
            users={users}
            searchQuery={searchQuery}
          />
        </div>

        {/* EMOJI PICKER */}
        {showEmojiPicker && (
          <div className="absolute bottom-24 left-4 z-50">
            <EmojiPicker
              theme="dark"
              onEmojiClick={(e) => {
                addEmoji(e.emoji);
                setShowEmojiPicker(false);
              }}
            />
          </div>
        )}

        {/* INPUT BAR */}
        <div className="border-t border-gray-800 p-3 bg-gray-900 fixed bottom-0 left-0 md:left-64 right-0 z-50">
          <MessageInput
            ref={messageInputRef}
            onSend={handleSend}
            onFile={handleFile}
            onTyping={(t) => setTyping(t, activeChat)}
            disabled={!socketId}
            toggleEmojiPicker={() => setShowEmojiPicker(!showEmojiPicker)}
          />
        </div>
      </main>
    </div>
  );
}
