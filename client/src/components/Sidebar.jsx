import React from "react";

const makeDMKey = (a, b) => {
  if (!a || !b) return null;
  const [s, l] = [a, b].sort();
  return `dm_${s}___${l}`;
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
  // only show "real" rooms (filter out any dm_ keys that somehow ended up here)
  const visibleRooms = (rooms || []).filter((r) => !String(r).startsWith("dm_"));

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`fixed md:relative inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 transform transition-all ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        style={{ display: "flex", flexDirection: "column", maxHeight: "100vh" }}
      >
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full overflow-hidden">
              {avatar ? (
                <img src={avatar} alt={username} className="w-10 h-10 object-cover rounded-full" />
              ) : (
                <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white">
                  {username ? username[0].toUpperCase() : "U"}
                </div>
              )}
            </div>
            <div>
              <div className="font-semibold">{username}</div>
              <div className="text-xs text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full" />
                Online
              </div>
            </div>
          </div>

          <button className="md:hidden text-2xl" onClick={closeSidebar}>
            ×
          </button>
        </div>

        {/* Make body scroll independently */}
        <div style={{ overflowY: "auto", flex: 1, paddingBottom: "1rem" }}>

          <div className="p-3">
            <div className="text-xs text-gray-400 uppercase mb-2 px-1">Rooms</div>
            <div className="space-y-1">
              {visibleRooms.map((room) => {
                const unread = unreadCounts[room] || 0;
                const active = activeChat === room;
                return (
                  <button
                    key={room}
                    onClick={() => { setActiveChat(room); closeSidebar(); }}
                    className={`w-full px-3 py-2 rounded flex justify-between ${active ? "bg-indigo-600 text-white" : "text-gray-300 hover:bg-gray-800"}`}
                  >
                    <span># {room}</span>
                    {unread > 0 && <span className="bg-red-500 px-2 rounded-full text-xs">{unread}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3 border-t border-gray-800">
            <div className="text-xs text-gray-400 uppercase mb-2 px-1">Direct Messages</div>

            <div className="space-y-1">
              {users
                .filter((u) => u.id !== socketId)
                .map((u) => {
                  const dmKey = makeDMKey(socketId, u.id);
                  const unread = unreadCounts[dmKey] || 0;
                  const active = activeChat === dmKey;

                  return (
                    <button
                      key={u.id}
                      onClick={() => { openDM(u); closeSidebar(); }}
                      className={`w-full px-3 py-2 rounded flex justify-between items-center ${active ? "bg-indigo-600 text-white" : "text-gray-300 hover:bg-gray-800"}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center">
                          {u.avatar ? (
                            <img src={u.avatar} alt={u.username} className="w-8 h-8 object-cover rounded-full" />
                          ) : (
                            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-xs text-white">
                              {u.username ? u.username[0].toUpperCase() : "U"}
                            </div>
                          )}
                        </span>
                        <div className="text-left">
                          <div className="font-medium">{u.username}</div>
                          <div className="text-xs text-gray-400">{u.online ? "Online" : "Offline"}</div>
                        </div>
                      </span>

                      {unread > 0 && <span className="bg-red-500 px-2 rounded-full text-xs">{unread}</span>}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
