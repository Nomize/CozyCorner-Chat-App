// client/src/App.jsx
import React, { useState } from "react";
import ChatRoom from "./pages/ChatRoom";

const avatarSeeds = [
  "mystic-fox",
  "sunny-hare",
  "calm-ocean",
  "forest-owl",
];

export default function App() {
  const [username, setUsername] = useState("");
  const [avatarSeed, setAvatarSeed] = useState(avatarSeeds[0]);
  const [joined, setJoined] = useState(false);

  const avatarUrl = (seed) =>
    `https://api.dicebear.com/8.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;

  const handleJoin = () => {
    if (!username.trim()) return;
    setJoined(true);
  };

  if (!joined) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-[#071024] to-[#05060a] text-white">
        <div className="bg-gray-900/60 p-6 rounded-xl w-full max-w-md shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-center">Welcome to CozyCorner</h2>

          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your display name"
            className="w-full px-3 py-2 rounded bg-gray-800 mb-4"
          />

          <div className="mb-4">
            <div className="text-sm text-gray-400 mb-2">Pick an avatar</div>
            <div className="flex gap-3">
              {avatarSeeds.map((s) => (
                <button
                  key={s}
                  onClick={() => setAvatarSeed(s)}
                  className={`p-1 rounded-full ${avatarSeed === s ? "ring-2 ring-indigo-500" : ""}`}
                >
                  <img
                    src={avatarUrl(s)}
                    alt={s}
                    className="w-16 h-16 rounded-full"
                  />
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleJoin}
            className="w-full bg-indigo-600 py-2 rounded font-medium"
          >
            Enter CozyCorner
          </button>
        </div>
      </div>
    );
  }

  return <ChatRoom username={username} avatar={`https://api.dicebear.com/8.x/adventurer/svg?seed=${encodeURIComponent(avatarSeed)}`} />;
}
