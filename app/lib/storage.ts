const KEYS = {
  participantIdByRoom: "scrumpkr:room:participantId:",
  participantTokenByRoom: "scrumpkr:room:participantToken:",
  displayNameByRoom: "scrumpkr:room:displayName:",
  preferredModeByRoom: "scrumpkr:room:preferredMode:",
  displayName: "scrumpkr:displayName",
  lastRoom: "scrumpkr:lastRoom",
  preferredMode: "scrumpkr:preferredMode",
} as const;

function getLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function roomKey(prefix: string, roomId: string): string {
  return `${prefix}${roomId}`;
}

export function getParticipantId(roomId: string | null): string | null {
  if (!roomId) return null;
  return getLocal(roomKey(KEYS.participantIdByRoom, roomId));
}

export function setParticipantId(roomId: string | null, id: string): void {
  if (!roomId) return;
  setLocal(roomKey(KEYS.participantIdByRoom, roomId), id);
}

export function getParticipantToken(roomId: string | null): string | null {
  if (!roomId) return null;
  return getLocal(roomKey(KEYS.participantTokenByRoom, roomId));
}

export function setParticipantToken(roomId: string | null, token: string): void {
  if (!roomId) return;
  setLocal(roomKey(KEYS.participantTokenByRoom, roomId), token);
}

export function getDisplayName(roomId?: string | null): string | null {
  if (roomId) {
    return getLocal(roomKey(KEYS.displayNameByRoom, roomId));
  }
  return getLocal(KEYS.displayName);
}

export function setDisplayName(name: string, roomId?: string | null): void {
  if (roomId) {
    setLocal(roomKey(KEYS.displayNameByRoom, roomId), name);
    return;
  }
  setLocal(KEYS.displayName, name);
}

export function getLastRoom(): string | null {
  return getLocal(KEYS.lastRoom);
}

export function setLastRoom(roomId: string): void {
  setLocal(KEYS.lastRoom, roomId);
}

export function getPreferredMode(roomId?: string | null):
  | "voter"
  | "spectator"
  | null {
  if (roomId) {
    return getLocal(roomKey(KEYS.preferredModeByRoom, roomId)) as
      | "voter"
      | "spectator"
      | null;
  }
  return getLocal(KEYS.preferredMode) as "voter" | "spectator" | null;
}

export function setPreferredMode(mode: "voter" | "spectator", roomId?: string | null): void {
  if (roomId) {
    setLocal(roomKey(KEYS.preferredModeByRoom, roomId), mode);
    return;
  }
  setLocal(KEYS.preferredMode, mode);
}
