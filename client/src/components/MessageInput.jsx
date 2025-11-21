// src/components/MessageInput.jsx
import React, { useState, useRef, forwardRef, useImperativeHandle } from "react";

const MessageInput = forwardRef(
  ({ onSend, onFile, onTyping, disabled, toggleEmojiPicker }, ref) => {
    const [text, setText] = useState("");
    const inputRef = useRef(null);

    // Allow parent to add emoji reliably
    useImperativeHandle(ref, () => ({
      addEmoji: (emoji) => {
        setText((prev) => prev + emoji);
        if (inputRef.current) inputRef.current.focus();
      },
    }));

    const handleSend = () => {
      if (text.trim()) {
        onSend(text.trim());
        setText("");
      }
    };

    const handleKey = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    const handleFileUpload = (e) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
      // reset input so same file can be selected again if needed
      e.target.value = "";
    };

    return (
      <div className="flex items-center gap-2 bg-gray-800 p-2 rounded-xl">
        {/* EMOJI BUTTON */}
        <button
          type="button"
          onClick={toggleEmojiPicker}
          className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600"
          aria-label="Toggle emoji picker"
        >
          😊
        </button>

        {/* FILE UPLOAD */}
        <label className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 cursor-pointer">
          📎
          <input type="file" className="hidden" onChange={handleFileUpload} />
        </label>

        {/* TEXT INPUT (shorter height) */}
        <textarea
          id="chat-input"
          ref={inputRef}
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            if (onTyping) onTyping(true);
          }}
          onBlur={() => {
            if (onTyping) onTyping(false);
          }}
          onKeyDown={handleKey}
          placeholder="Write a message…"
          className="flex-1 bg-gray-900 text-white p-2 rounded-lg h-12 resize-none"
        />

        {/* SEND BUTTON */}
        <button
          onClick={handleSend}
          disabled={disabled}
          className="bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-500 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    );
  }
);

export default MessageInput;
