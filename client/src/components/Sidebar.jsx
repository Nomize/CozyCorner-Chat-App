// client/src/components/Sidebar.jsx
import React from "react";

export default function Sidebar({ username, avatar, rooms = [], users = [], socketId, activeChat, setActiveChat, openDM, unreadCounts = {} }) {
  const avatarFor = (u) =>
    u?.avatar || `https://api.dicebear.com/8.x/adventurer/svg?seed=${encodeURIComponent(u?.id || u?.username || "guest")}`;

  return (
    <aside className="w-full md:w-80 bg-gray-900/60 border-r border-gray-800 p-4 hidden md:block">
      <div className="flex items-center gap-3 mb-6">
        <img src={avatar} alt="me" className="w-12 h-12 rounded-full border-2 border-indigo-500" />
        <div>
          <div className="font-semibold">{username}</div>
          <div className="text-sm text-gray-400">CozyCorner</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs text-gray-400 uppercase mb-2">Rooms</div>
        <div className="space-y-2">
          {rooms.map((r) => (
            <button key={r} onClick={() => setActiveChat(r)} className={`w-full text-left px-3 py-2 rounded ${activeChat === r ? "bg-indigo-600" : "hover:bg-gray-800"}`}>
              <div className="flex items-center justify-between">
                <span>{r}</span>
                {unreadCounts?.[r] ? <span className="text-xs bg-red-500 px-2 rounded-full">{unreadCounts[r]}</span> : null}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs text-gray-400 uppercase mb-2">Direct messages</div>
        <div className="space-y-2">
          {users.filter(u => u.id !== socketId).map(u => (
            <button key={u.id} onClick={() => openDM(u)} className={`w-full text-left px-3 py-2 rounded ${activeChat.startsWith(`dm_${[socketId,u.id].sort().join("_")}`) ? "bg-emerald-600" : "hover:bg-gray-800"}`}>
              <div className="flex items-center gap-3">
                <img src={avatarFor(u)} alt={u.username} className="w-8 h-8 rounded-full" />
                <div className="flex-1">
                  <div className="font-medium">{u.username}</div>
                  <div className="text-xs text-gray-400">Tap to chat</div>
                </div>
                {unreadCounts?.[u.id] ? <span className="text-xs bg-red-500 px-2 rounded-full">{unreadCounts[u.id]}</span> : null}
              </div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
