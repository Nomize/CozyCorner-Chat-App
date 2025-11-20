// client/src/components/MessageInput.jsx
import React, { useRef, useState } from "react";
import { FaPaperPlane, FaPaperclip, FaSmile } from "react-icons/fa";
import Picker from "emoji-picker-react";

export default function MessageInput({ onSend, onFile, onTyping }) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const fileRef = useRef(null);
  const [typingTimeout, setTypingTimeout] = useState(null);

  const send = (e) => {
    if (e) e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
    setShowEmoji(false);
    onTyping(false);
  };

  const handleChange = (e) => {
    setText(e.target.value);
    if (onTyping) {
      onTyping(true);
      if (typingTimeout) clearTimeout(typingTimeout);
      setTypingTimeout(setTimeout(() => onTyping(false), 800));
    }
  };

  const pickFile = () => fileRef.current?.click();

  const onFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (f && onFile) {
      onFile(f);
    }
    e.target.value = null;
  };

  const onEmojiClick = (emojiData) => {
    setText((p) => p + emojiData.emoji);
  };

  return (
    <form onSubmit={send} className="flex items-center gap-3">
      <button type="button" onClick={() => setShowEmoji((s) => !s)} className="text-xl text-gray-300">
        <FaSmile />
      </button>

      <div className="relative flex-1">
        <input
          value={text}
          onChange={handleChange}
          placeholder="Type a message"
          className="w-full rounded-full px-4 py-2 bg-gray-800 text-white placeholder-gray-400"
        />
        {showEmoji && (
          <div className="absolute bottom-12 left-0 z-50">
            <Picker onEmojiClick={onEmojiClick} />
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" className="hidden" onChange={onFileChange} />
      <button type="button" onClick={pickFile} className="p-2 rounded-full bg-gray-800 text-gray-200">
        <FaPaperclip />
      </button>

      <button type="submit" className="bg-emerald-500 px-4 py-2 rounded-full flex items-center gap-2">
        <FaPaperPlane />
        <span className="hidden sm:inline">Send</span>
      </button>
    </form>
  );
}
