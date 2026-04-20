import type { RevealEntry } from "~/lib/types";

interface RevealHistoryProps {
  history: RevealEntry[];
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RevealHistory({ history }: RevealHistoryProps) {
  if (history.length === 0) return null;

  return (
    <div className="border-4 border-black p-6">
      <h3 className="text-2xl font-black uppercase tracking-widest border-b-4 border-black pb-4 mb-4">
        History
      </h3>
      <ul className="space-y-3">
        {history.map((entry, i) => (
          <li key={i} className="flex justify-between items-center font-medium">
            <span className="text-gray-500">{timeAgo(entry.timestamp)}</span>
            <span className="font-bold">{entry.aggregation}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
