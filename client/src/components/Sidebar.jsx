// client/src/components/Sidebar.jsx
import React from "react";

// Convert dm_key → username
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

export default function Sidebar({
  username,
  avatar,
  rooms = [],
  users = [],
  socketId,
  activeChat,
  setActiveChat,
  openDM,
  unreadCounts = {},
  isOpen,
  closeSidebar,
}) {
  const avatarFor = (u) =>
    u?.avatar ||
    `https://api.dicebear.com/8.x/adventurer/svg?seed=${encodeURIComponent(
      u?.id || u?.username || "guest"
    )}`;

  return (
    <aside
      className={`
        bg-gray-900/60 border-r border-gray-800 p-4 z-50
        w-72 fixed inset-y-0 left-0 transform transition-transform duration-200

        ${isOpen ? "translate-x-0" : "-translate-x-full"}

        md:relative md:translate-x-0 md:w-80 md:block
      `}
    >
      {/* Mobile close button */}
      <div className="md:hidden mb-4 flex justify-end">
        <button
          onClick={closeSidebar}
          className="text-gray-400 hover:text-white text-2xl"
        >
          ×
        </button>
      </div>

      {/* USER */}
      <div className="flex items-center gap-3 mb-6">
        <img
          src={avatar}
          alt="me"
          className="w-12 h-12 rounded-full border-2 border-indigo-500"
        />
        <div>
          <div className="font-semibold">{username}</div>
          <div className="text-sm text-gray-400">CozyCorner</div>
        </div>
      </div>

      {/* ROOMS */}
      <div className="mb-4">
        <div className="text-xs text-gray-400 uppercase mb-2">Rooms</div>
        <div className="space-y-2">
          {rooms
            .filter((r) => r.toLowerCase() !== "global")
            .map((r) => {
              const isActive = activeChat === r;

              return (
                <button
                  key={r}
                  onClick={() => {
                    setActiveChat(r);
                    closeSidebar();
                  }}
                  className={`w-full text-left px-3 py-2 rounded ${
                    isActive ? "bg-indigo-600" : "hover:bg-gray-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{r}</span>

                    {unreadCounts?.[r] > 0 && (
                      <span className="text-xs bg-red-500 px-2 rounded-full">
                        {unreadCounts[r]}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* DIRECT MESSAGES */}
      <div>
        <div className="text-xs text-gray-400 uppercase mb-2">
          Direct Messages
        </div>

        <div className="space-y-2">
          {users
            .filter((u) => u.id !== socketId)
            .map((u) => {
              const dmKey = `dm_${[socketId, u.id].sort().join("_")}`;
              const isActive = activeChat === dmKey;

              return (
                <button
                  key={u.id}
                  onClick={() => {
                    openDM(u);
                    closeSidebar();
                  }}
                  className={`w-full text-left px-3 py-2 rounded ${
                    isActive ? "bg-emerald-600" : "hover:bg-gray-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={avatarFor(u)}
                      alt={u.username}
                      className="w-8 h-8 rounded-full"
                    />

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{u.username}</span>

                        {u.online ? (
                          <span className="w-2 h-2 bg-green-400 rounded-full" />
                        ) : (
                          <span className="w-2 h-2 bg-gray-600 rounded-full" />
                        )}
                      </div>

                      <div className="text-xs text-gray-400">Tap to chat</div>
                    </div>

                    {unreadCounts?.[dmKey] > 0 && (
                      <span className="text-xs bg-red-500 px-2 rounded-full">
                        {unreadCounts[dmKey]}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </aside>
  );
}
