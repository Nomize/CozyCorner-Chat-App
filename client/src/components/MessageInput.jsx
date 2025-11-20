// client/src/components/MessageInput.jsx
import React, { useState, useRef } from "react";

export default function MessageInput({ onSend, onFile, onTyping }) {
  const [text, setText] = useState("");
  const fileRef = useRef(null);
  const typingTimeout = useRef(null);

  const handleTyping = (val) => {
    setText(val);

    if (onTyping) onTyping(true);

    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      if (onTyping) onTyping(false);
    }, 900);
  };

  const send = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");

    if (onTyping) onTyping(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const pickFile = () => fileRef.current.click();

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = "";
  };

  return (
    <div className="flex items-center gap-3">
      {/* FILE BUTTON */}
      <button
        onClick={pickFile}
        className="text-xl text-gray-300 hover:text-white"
      >
        📎
      </button>
      <input
        type="file"
        className="hidden"
        ref={fileRef}
        onChange={handleFile}
      />

      {/* TEXT BOX */}
      <textarea
        value={text}
        onChange={(e) => handleTyping(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Type a message..."
        rows={1}
        className="flex-1 bg-gray-800 rounded-lg p-2 resize-none focus:outline-none"
        style={{ maxHeight: "120px" }}
      />

      {/* SEND BUTTON */}
      <button
        onClick={send}
        className="bg-indigo-600 px-4 py-2 rounded-lg font-medium"
      >
        Send
      </button>
    </div>
  );
}
