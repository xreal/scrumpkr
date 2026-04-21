import type { RevealEntry } from "~/lib/types";

interface RevealHistoryProps {
  history: RevealEntry[];
}

export function timeAgo(timestamp: number): string {
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
    <div className="border-2 border-black p-3 sm:p-4">
      <h3 className="text-base sm:text-lg font-black uppercase tracking-widest border-b-2 border-black pb-2 mb-3">
        History
      </h3>
      <ul className="space-y-2">
        {history.map((entry, i) => (
          <li key={i} className="flex justify-between items-center text-sm font-medium">
            <span className="text-gray-500">{timeAgo(entry.timestamp)}</span>
            <span className="font-bold">{entry.aggregation}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
