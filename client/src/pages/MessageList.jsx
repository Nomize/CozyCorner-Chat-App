import React, { useState, useMemo } from "react";
import MessageBubble from "../components/MessageBubble";

const formatTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "bmp"];

const looksLikeImage = (url = "") => {
  try {
    const lower = url.toLowerCase();
    return IMAGE_EXT.some((ext) => lower.endsWith("." + ext));
  } catch {
    return false;
  }
};

// small default emoji list (fallback)
const DEFAULT_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥"];

/**
 * highlightText:
 * - Returns safe HTML with <mark> around query matches.
 * - If query is falsy, returns the original text escaped for HTML.
 */
const escapeHtml = (str = "") =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const highlightText = (text = "", query = "") => {
  if (!query) return escapeHtml(text);
  try {
    const q = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${q})`, "gi");
    return escapeHtml(text).replace(regex, "<mark class='bg-yellow-300 text-black'>$1</mark>");
  } catch {
    return escapeHtml(text);
  }
};

export default function MessageList({
  messages = [],
  currentUser,
  currentUserId,
  typingUsers = [],
  onReact,
  users = [],            // optional: array of {id, username, avatar}
  searchQuery = ""       // optional, used to highlight matches
}) {
  const [openReactionFor, setOpenReactionFor] = useState(null);

  // helper to get avatar URL or fallback
  const getAvatar = (senderId, senderName) => {
    const u = users.find((x) => x.id === senderId);
    if (u && u.avatar) return u.avatar;
    // fallback to letter avatar data-url could be added later; for now return null to use initials
    return null;
  };

  const groupedBySender = useMemo(() => {
    // not changing grouping semantics, just illustrating we can group if needed.
    return null;
  }, [messages]);

  return (
    <div className="space-y-4">
      {messages.map((m) => {
        const isMe = m.senderId === currentUserId || m.sender === currentUser;
        const key = m._id || m.id || m.tempId;

        // Avatar rendering
        const avatarUrl = getAvatar(m.senderId, m.sender);
        const initials = (m.sender || (isMe ? currentUser : "U")).charAt(0).toUpperCase();

        return (
          <div key={key} className={`flex ${isMe ? "justify-end" : "justify-start"} items-end gap-3`}>
            {/* left avatar for others */}
            {!isMe && (
              <div className="w-10 h-10 flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={m.sender || "avatar"} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-xs">
                    {initials}
                  </div>
                )}
              </div>
            )}

            <div className={`max-w-[70%] p-3 rounded ${isMe ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-200"}`}>
              <div className="text-xs text-gray-300 mb-1 flex items-center justify-between gap-2">
                <span className="font-semibold">{m.sender || (isMe ? currentUser : "Unknown")}</span>
                <span className="text-[10px] text-gray-400">{formatTime(m.timestamp)}</span>
              </div>

              {m.type === "file" && m.url ? (
                looksLikeImage(m.url) ? (
                  <div className="break-words">
                    <img src={m.url} alt={m.fileName || "file"} style={{ maxWidth: "100%", borderRadius: 8 }} />
                    <div className="max-w-xs rounded-lg mt-2 text-sm text-gray-200">{m.fileName}</div>
                  </div>
                ) : (
                  <div className="break-words">
                    <a href={m.url} target="_blank" rel="noreferrer" className="underline">{m.fileName || m.url}</a>
                  </div>
                )
              ) : (
                // message content with highlight
                <div
                  className="whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: highlightText(m.message || "", searchQuery) }}
                />
              )}

              <div className="mt-2 flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1">
                  {/* reactions summary */}
                  {(m.reactions && Object.keys(m.reactions).length > 0) ? (
                    Object.entries(m.reactions).map(([k, arr]) => (
                      <button
                        key={k}
                        onClick={() => onReact && onReact(m._id || m.id, k)}
                        className="px-2 py-0.5 rounded bg-black/20"
                      >
                        {k} <span className="ml-1 text-[11px]">({Array.isArray(arr) ? arr.length : 1})</span>
                      </button>
                    ))
                  ) : (
                    <button
                      onClick={() => setOpenReactionFor(openReactionFor === key ? null : key)}
                      className="px-2 py-0.5 rounded bg-black/10"
                    >
                      😊
                    </button>
                  )}
                </div>

                <div className="text-[11px] text-gray-400 ml-auto">
                  {m.readBy && m.readBy.length > 0 ? `Read by ${m.readBy.length}` : (m.delivered ? "Delivered" : "Sending...")}
                </div>
              </div>

              {/* emoji picker popup (simple) */}
              {openReactionFor === key && (
                <div className="mt-2 bg-gray-800 p-2 rounded shadow flex gap-2">
                  {DEFAULT_EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => { onReact && onReact(m._id || m.id, e); setOpenReactionFor(null); }}
                      className="text-lg"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* right avatar for me (optional) */}
            {isMe && (
              <div className="w-10 h-10 flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={m.sender || "avatar"} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-400 flex items-center justify-center text-xs">
                    {initials}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {typingUsers && typingUsers.length > 0 && (
        <div className="text-sm text-gray-400 italic">{typingUsers.join(", ")} typing…</div>
      )}
    </div>
  );
}
