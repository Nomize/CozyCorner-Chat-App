// client/src/pages/MessageList.jsx
import React from "react";

function formatDateLabel(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function smallTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function MessageList({
  messages = [],
  currentUser,
  typingUsers = [],
  onReact = () => {},
}) {
  const items = [];
  let lastDate = null;
  let lastSender = null;

  messages.forEach((m, i) => {
    const dateLabel = formatDateLabel(m.timestamp);

    // Insert date separator
    if (dateLabel !== lastDate) {
      items.push(
        <div
          key={`date-${dateLabel}-${i}`}
          className="text-center text-gray-400 my-4 text-sm"
        >
          {dateLabel}
        </div>
      );
      lastDate = dateLabel;
      lastSender = null; // reset grouping
    }

    const isMine = m.sender === currentUser || m.senderId === m.currentUserId;
    const sameSender = lastSender === m.sender;
    lastSender = m.sender;

    const key = m._id || m.id || `${i}`;

    items.push(
      <div
        key={key}
        className={`max-w-[75%] ${
          isMine ? "ml-auto text-right" : "mr-auto text-left"
        }`}
      >
        <div
          className={`${
            sameSender ? "mt-1" : "mt-4"
          } inline-block p-3 rounded-lg ${
            isMine ? "bg-indigo-600" : "bg-gray-800"
          }`}
        >
          {/* Sender name (only for others and not grouped) */}
          {!sameSender && !isMine && (
            <div className="text-xs text-gray-300 mb-1">{m.sender}</div>
          )}

          {/* Message OR file */}
          {m.url ? (
            <div>
              <a
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="underline break-all"
              >
                📎 {m.fileName || "File"}
              </a>

              {/* If it's an image */}
              {m.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
                <img
                  src={m.url}
                  alt={m.fileName}
                  className="mt-2 rounded max-h-72"
                />
              )}
            </div>
          ) : (
            <div className="leading-relaxed">{m.message}</div>
          )}

          {/* Timestamp + read receipts + reactions */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-xs text-gray-300">
              {smallTime(m.timestamp)}
            </div>

            <div className="flex items-center gap-3">
              {/* ✔ Delivered / ✔✔ Read */}
              {isMine && (
                <div className="text-xs text-gray-200">
                  {m.readBy && m.readBy.length > 0
                    ? "✔✔"
                    : m.delivered
                    ? "✔"
                    : "⏳"}
                </div>
              )}

              {/* Reactions */}
              {m.reactions && Object.keys(m.reactions).length > 0 && (
                <div className="text-sm text-yellow-300 flex flex-wrap gap-1">
                  {Object.entries(m.reactions).map(([emoji, users], idx) => (
                    <span key={idx}>
                      {emoji} {users.length}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Reaction buttons */}
          <div className="mt-2 flex gap-2">
            {["❤️", "😂", "👍", "🔥"].map((e) => (
              <button
                key={e}
                onClick={() => onReact(m._id || m.id, e)}
                className="text-lg hover:scale-110"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  });

  return (
    <div className="space-y-2">
      {items}

      {/* TYPING INDICATOR */}
      {typingUsers && typingUsers.length > 0 && (
        <div className="text-gray-400 text-sm italic mt-2">
          {typingUsers.join(", ")} typing…
        </div>
      )}
    </div>
  );
}
