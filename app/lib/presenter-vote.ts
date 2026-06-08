import { DECK, VALID_VOTES, type CardValue } from "./vote-logic";

export function parsePresenterVoteInput(raw: string): CardValue | null {
  const input = raw.trim();
  if (!input) {
    return null;
  }

  if (input === "?") {
    return "?";
  }

  if (VALID_VOTES.has(input)) {
    return input as CardValue;
  }

  return null;
}

export function isPresenterVotePrefix(raw: string): boolean {
  const input = raw.trim();
  if (input === "") {
    return true;
  }

  if (input === "?") {
    return true;
  }

  if (input === "0.") {
    return true;
  }

  return DECK.some((card) => card.startsWith(input));
}

export function getPresenterVoteHint(buffer: string): string | null {
  const input = buffer.trim();
  if (!input) {
    return null;
  }

  if (parsePresenterVoteInput(input)) {
    return "Press Enter to vote";
  }

  if (!isPresenterVotePrefix(input)) {
    return "Not a valid estimate";
  }

  return "Keep typing…";
}

export function shouldIgnorePresenterKeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    return true;
  }

  return target.isContentEditable;
}
