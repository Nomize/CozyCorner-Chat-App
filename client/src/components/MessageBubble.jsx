import React from "react";

const formatTime = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

// WhatsApp ticks ✨
const Delivered = () => <span className="text-blue-400 ml-1">✓✓</span>;
const Sending = () => <span className="text-gray-400 ml-1">✓</span>;

const isImage = (url = "") => {
  return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url);
};

export default function MessageBubble({ msg, isMine }) {
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"} mb-2`}>
      <div
        className={`max-w-[75%] rounded-xl px-3 py-2 shadow-sm ${
          isMine
            ? "bg-[#DCF8C6] text-gray-900 rounded-br-none"
            : "bg-white text-gray-900 rounded-bl-none"
        }`}
      >
        {/* Sender name for others */}
        {!isMine && msg.sender && (
          <div className="font-semibold text-sm text-gray-700 mb-1">
            {msg.sender}
          </div>
        )}

        {/* Message or file */}
        {msg.type === "file" && msg.url ? (
          isImage(msg.url) ? (
            <img
              src={msg.url}
              alt={msg.fileName || "image"}
              className="rounded-lg max-w-full mb-1"
            />
          ) : (
            <a
              href={msg.url}
              target="_blank"
              rel="noreferrer"
              className="underline text-blue-600"
            >
              {msg.fileName || msg.url}
            </a>
          )
        ) : (
          <div className="whitespace-pre-wrap">{msg.message}</div>
        )}

        {/* Footer row (time + ticks) */}
        <div className="flex justify-end items-center text-xs text-gray-500 mt-1">
          {formatTime(msg.timestamp)}

          {isMine &&
            (msg.readBy?.length > 0 ? (
              <Delivered />
            ) : msg.delivered ? (
              <Delivered />
            ) : (
              <Sending />
            ))}
        </div>

        {/* Reactions display */}
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <div className="flex gap-1 mt-1">
            {Object.entries(msg.reactions).map(([emoji, arr]) => (
              <div
                key={emoji}
                className="bg-gray-200 px-2 py-0.5 rounded-full text-sm"
              >
                {emoji} {arr.length}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
