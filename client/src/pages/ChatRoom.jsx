// client/src/pages/ChatRoom.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "../socket/socket";
import MessageList from "./MessageList";
import MessageInput from "../components/MessageInput";

const DEFAULT_ROOM = "General";
const DM_PREFIX = "dm_";

// MINI SOUND HELPER
function playTone({ frequency = 440, duration = 0.12, type = "sine", volume = 0.06 }) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = frequency;
    g.gain.value = volume;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, duration * 1000);
  } catch (e) {}
}

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
    unreadCounts,
  } = useSocket();

  const [joined, setJoined] = useState(false);
  const [activeChat, setActiveChat] = useState(DEFAULT_ROOM);
  const [label, setLabel] = useState(DEFAULT_ROOM);
  const containerRef = useRef(null);

  /** INIT LOGIN + JOIN DEFAULT ROOM */
  useEffect(() => {
    if (username) {
      connect(username);
      joinRoom(DEFAULT_ROOM);
      setActiveChat(DEFAULT_ROOM);
      setLabel(DEFAULT_ROOM);
      setJoined(true);
    }
  }, [username]);

  /** Ask for browser notification permission once */
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  /**
   * GROUP MESSAGES SAFELY
   */
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

        if (a && b) {
          const [small, large] = [a, b].sort();
          const key = `${DM_PREFIX}${small}_${large}`;
          push(key, m);
        } else {
          push(m.senderId || "dm_unknown", m);
        }
      } else {
        const r = m.room || DEFAULT_ROOM;
        push(r, m);
      }
    });

    return map;
  }, [messages]);

  /**
   * SOUND + NOTIFICATION WHEN NEW MESSAGE ARRIVES
   */
  const prevMessagesRef = useRef([]);

  useEffect(() => {
    const prev = prevMessagesRef.current || [];
    const current = messages || [];

    if (current.length > prev.length) {
      const newMsgs = current.slice(prev.length);

      newMsgs.forEach((m) => {
        const key = m.isPrivate
          ? (() => {
              const a = m.senderId, b = m.receiverId;
              if (a && b) {
                const [small, large] = [a, b].sort();
                return `${DM_PREFIX}${small}_${large}`;
              }
              return m.senderId || "dm_unknown";
            })()
          : (m.room || DEFAULT_ROOM);

        const isForActive = key === activeChat;
        const isFromSelf = m.senderId === socketId;

        if (!isFromSelf) {
          if (m.isPrivate) {
            playTone({
              frequency: isForActive ? 880 : 900,
              duration: 0.1,
              type: "square",
              volume: 0.05
            });
          } else {
            playTone({
              frequency: isForActive ? 520 : 540,
              duration: 0.1,
              type: "triangle",
              volume: 0.05
            });
          }
        }

        const shouldNotify = (!document.hasFocus() || !isForActive);
        if ("Notification" in window && Notification.permission === "granted" && shouldNotify) {
          const title = m.isPrivate
            ? `DM from ${m.sender}`
            : `${m.sender} in ${m.room || DEFAULT_ROOM}`;

          const body = m.message || m.fileName || "New message";

          const n = new Notification(title, {
            body: body.slice(0, 100),
            icon:
              m.avatar ||
              avatar ||
              `https://api.dicebear.com/8.x/adventurer/svg?seed=${encodeURIComponent(
                m.sender || "guest"
              )}`,
          });

          n.onclick = () => {
            window.focus();
            setActiveChat(key);
          };
        }
      });
    }

    prevMessagesRef.current = current;
  }, [messages, activeChat, socketId, avatar]);

  /**
   * SWITCHING ROOMS / DMS
   */
  useEffect(() => {
    if (!activeChat) return;

    if (activeChat.startsWith(DM_PREFIX)) {
      joinRoom(activeChat);

      const parts = activeChat.split("_");
      const idA = parts[1], idB = parts[2];
      const other = idA === socketId ? idB : idA;
      const u = (users || []).find((x) => x.id === other);
      setLabel(u ? u.username : "Direct Message");
    } else {
      joinRoom(activeChat);
      setLabel(activeChat);
    }

    const msgs = grouped[activeChat] || [];
    msgs.forEach((m) => {
      if (!m.readBy || !m.readBy.includes(username)) {
        sendReadReceipt(m.id);
      }
    });
  }, [activeChat]);

  /** Open DM with selected user */
  const openDM = (u) => {
    if (!u || u.id === socketId) return;
    const [a, b] = [socketId, u.id].sort();
    setActiveChat(`${DM_PREFIX}${a}_${b}`);
  };

  /** Send text message */
  const handleSend = (text) => {
    if (activeChat.startsWith(DM_PREFIX)) {
      const parts = activeChat.split("_");
      const other = parts[1] === socketId ? parts[2] : parts[1];
      sendPrivateMessage(other, text);
    } else {
      sendMessage(text, activeChat);
    }
  };

  /** File upload handler */
  const handleFile = async (file) => {
    if (!file) return;
    try {
      const form = new FormData();
      form.append("file", file);
      const base = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
      const res = await fetch(`${base}/api/upload`, { method: "POST", body: form });
      const json = await res.json();
      if (json?.url) {
        sendFile({ room: activeChat, url: json.url, fileName: file.name });
      }
    } catch (e) {
      console.error(e);
    }
  };

  /** Add emoji / reactions */
  const handleReact = (messageId, emoji) => {
    sendReaction(messageId, emoji);
  };

  const activeMessages = (grouped[activeChat] || []).slice().sort((a, b) => (a.id || 0) - (b.id || 0));

  const avatarForUser = (u) =>
    u?.avatar ||
    `https://api.dicebear.com/8.x/adventurer/svg?seed=${encodeURIComponent(
      u?.id || u?.username || "guest"
    )}`;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-b from-[#071024] to-[#03040a] text-white">
      {/* SIDEBAR */}
      <aside className="w-full md:w-80 bg-gray-900/60 border-r border-gray-800 p-4 hidden md:block">
        <div className="flex items-center gap-3 mb-6">
          <img src={avatar} alt="me" className="w-12 h-12 rounded-full border-2 border-indigo-500" />
          <div>
            <div className="font-semibold">{username}</div>
            <div className="text-sm text-gray-400">CozyCorner</div>
          </div>
        </div>

        {/* ROOMS */}
        <div className="mb-4">
          <div className="text-xs text-gray-400 uppercase mb-2">Rooms</div>
          <div className="space-y-2">
            {(rooms || [])
              .filter((r) => r !== "global")
              .map((r) => (
                <button
                  key={r}
                  onClick={() => setActiveChat(r)}
                  className={`w-full text-left px-3 py-2 rounded ${
                    activeChat === r ? "bg-indigo-600" : "hover:bg-gray-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{r}</span>
                    {unreadCounts?.[r] ? (
                      <span className="text-xs bg-red-500 px-2 rounded-full">
                        {unreadCounts[r]}
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}
          </div>
        </div>

        {/* DIRECT MESSAGES */}
        <div>
          <div className="text-xs text-gray-400 uppercase mb-2">Direct messages</div>
          <div className="space-y-2">
            {(users || [])
              .filter((u) => u.id !== socketId)
              .map((u) => (
                <button
                  key={u.id}
                  onClick={() => openDM(u)}
                  className="w-full text-left px-3 py-2 rounded hover:bg-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <img src={avatarForUser(u)} alt={u.username} className="w-8 h-8 rounded-full" />
                    <div className="flex-1">
                      <div className="font-medium">{u.username}</div>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main className="flex-1 flex flex-col">
        {/* HEADER */}
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <div className="text-lg font-semibold">{label}</div>
        </div>

        {/* MESSAGES */}
        <div ref={containerRef} className="flex-1 overflow-y-auto p-4">
          <MessageList
            messages={activeMessages}
            currentUser={username}
            typingUsers={typingUsers}
            onReact={handleReact}
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
