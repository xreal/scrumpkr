export interface Room {
  roomId: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  participants: Participant[];
  currentRound: Round;
  history: RevealEntry[];
}

export interface Participant {
  participantId: string;
  name: string;
  role: "admin";
  mode: "voter" | "spectator";
  connected: boolean;
  lastSeenAt: number;
}

export interface Round {
  revealed: boolean;
  votes: Record<string, string | null>;
}

export interface RevealEntry {
  timestamp: number;
  aggregation: string;
}

export interface ClientMessage {
  action: "join" | "rejoin" | "set_name" | "set_mode" | "set_title" | "vote" | "reveal" | "reset_round" | "remove_participant" | "poke";
  participantId: string;
  name?: string;
  mode?: "voter" | "spectator";
  title?: string;
  vote?: string | null;
  removeId?: string;
  targetId?: string;
}

export interface RoomStateMessage {
  type: "room_state";
  room: Room;
  yourId?: string;
  yourVote?: string | null;
  yourToken?: string;
}

export interface ErrorMessage {
  type: "error";
  error: string;
}

export interface PokeMessage {
  type: "poke";
  fromName: string;
}

export type ServerMessage = RoomStateMessage | ErrorMessage | PokeMessage;

export type RoomId = string;
