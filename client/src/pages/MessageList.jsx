// client/src/pages/MessageList.jsx
import React from "react";

const Bubble = ({ msg, isOwn, onReact }) => {
  const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} group`}>
      {!isOwn && (
        <div className="flex-shrink-0 mr-3">
          <img src={msg.avatar || `https://api.dicebear.com/8.x/adventurer/svg?seed=${encodeURIComponent(msg.sender || "anon")}`} alt={msg.sender} className="w-9 h-9 rounded-full" />
        </div>
      )}

      <div className="max-w-[75%]">
        <div className={`px-4 py-2 rounded-lg break-words ${isOwn ? "bg-emerald-500 text-black rounded-br-none" : "bg-gray-700 text-white rounded-bl-none"}`}>
          {msg.message}
          {msg.type === "file" && msg.url && (
            <div className="mt-2">
              <a href={msg.url} target="_blank" rel="noreferrer" className="underline text-sm text-blue-200">
                {msg.fileName || "Download file"}
              </a>
            </div>
          )}
        </div>

        <div className={`flex items-center mt-1 text-xs ${isOwn ? "justify-end text-gray-200" : "justify-start text-gray-400"}`}>
          <span>{msg.sender} • {time}</span>
          {isOwn && (
            <span className="ml-2 text-xs text-gray-300">{msg.delivered ? "✓✓" : "✓"}</span>
          )}
        </div>

        {/* Reactions */}
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <div className="mt-1 flex space-x-2">
            {Object.entries(msg.reactions).map(([emoji, users]) => (
              <button key={emoji} className="text-sm bg-gray-800 px-2 rounded-full" title={users.join(", ")}>
                {emoji} {users.length}
              </button>
            ))}
          </div>
        )}
      </div>

      {isOwn && (
        <div className="flex-shrink-0 ml-3">
          <img src={msg.avatar || `https://api.dicebear.com/8.x/adventurer/svg?seed=${encodeURIComponent(msg.sender || "anon")}`} alt={msg.sender} className="w-9 h-9 rounded-full" />
        </div>
      )}
    </div>
  );
};

const MessageList = ({ messages = [], currentUser, typingUsers = [], onReact }) => {
  return (
    <div className="flex-1 space-y-4">
      {messages.map((msg) => {
        const isOwn = msg.sender === currentUser || msg.senderId === undefined && msg.sender === "You";
        // use composite key to avoid duplicates (id + senderId)
        const key = `${msg.id}_${msg.senderId || "s"}`;
        return (
          <div key={key}>
            <Bubble msg={msg} isOwn={isOwn} onReact={onReact} />
          </div>
        );
      })}

      {typingUsers.length > 0 && (
        <div className="text-gray-400 italic text-sm">
          {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
        </div>
      )}
    </div>
  );
};

export default MessageList;
