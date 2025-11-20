export default function OnlineUsers({ users }) {
  return (
    <div className="w-1/4 bg-white p-4 rounded shadow h-[500px] overflow-y-auto">
      <h3 className="font-semibold mb-2">Users Online:</h3>
      <ul className="space-y-1">
        {users.map((u) => (
          <li key={u.id} className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            {u.username}
          </li>
        ))}
      </ul>
    </div>
  );
}
