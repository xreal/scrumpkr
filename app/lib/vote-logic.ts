export const DECK = [
  "0",
  "0.5",
  "1",
  "2",
  "3",
  "5",
  "8",
  "13",
  "21",
  "?",
] as const;

export type CardValue = (typeof DECK)[number];

export const VALID_VOTES = new Set<string>(DECK);

export function isNumericCard(v: string): boolean {
  return v !== "?";
}

export function isValidVote(vote?: string | null): boolean {
  if (vote == null) return true;
  return VALID_VOTES.has(vote);
}

export function sanitizeName(name?: string): string | undefined {
  if (!name) return undefined;
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 40);
}

export function sanitizeTitle(title?: string): string {
  if (!title) return "";
  return title.trim().slice(0, 120);
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

export function computeAverage(votes: (string | null)[]): string {
  const numeric = votes
    .filter((v): v is string => v !== null && isNumericCard(v))
    .map(Number);
  if (numeric.length === 0) return "—";
  return (numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(1);
}
