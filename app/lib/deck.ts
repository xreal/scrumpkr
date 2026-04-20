export const DECK = [
  "0",
  "1",
  "2",
  "3",
  "5",
  "8",
  "13",
  "21",
  "coffee",
  "?",
] as const;

export type CardValue = (typeof DECK)[number];

export function isNumericCard(v: string): boolean {
  return v !== "?" && v !== "coffee";
}

export function computeAverage(votes: (string | null)[]): string {
  const numeric = votes
    .filter((v): v is string => v !== null && isNumericCard(v))
    .map(Number);
  if (numeric.length === 0) return "—";
  return (numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(1);
}

export function aggregateReveal(votes: (string | null)[]): string {
  const counts: Record<string, number> = {};
  for (const v of votes) {
    if (v == null) continue;
    counts[v] = (counts[v] ?? 0) + 1;
  }
  const parts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([val, count]) => `${count}x${val}`);
  return parts.length > 0 ? parts.join(", ") : "no votes";
}
