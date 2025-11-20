export default function MessageBubble({ msg, username }) {
  const isMine = msg.sender === username;

  if (msg.system) {
    return (
      <div className="text-center text-gray-500 italic text-sm">
        {msg.message}
      </div>
    );
  }

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs px-4 py-2 rounded-lg shadow ${
          isMine ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none'
        }`}
      >
        {!isMine && <div className="font-semibold text-sm mb-1">{msg.sender}</div>}
        <div>{msg.message}</div>
        <div className="text-right text-xs text-gray-300 mt-1">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
