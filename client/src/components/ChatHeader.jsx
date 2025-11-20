// client/src/components/ChatHeader.jsx
export default function ChatHeader({ title, subText }) {
  return (
    <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-[#021126] to-[#051428]">
      <div className="flex items-center gap-3">
        <div className="text-lg font-semibold">{title}</div>
        <div className="text-xs text-gray-400 ml-2">{subText}</div>
      </div>
    </div>
  );
}
