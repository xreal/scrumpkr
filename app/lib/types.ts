export interface Room {
  roomId: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  participants: Participant[];
  currentRound: {
    revealed: boolean;
    votes: Record<string, string | null>;
  };
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

export interface RevealEntry {
  timestamp: number;
  aggregation: string;
}

export interface ClientMessage {
  action: "join" | "rejoin" | "set_name" | "set_mode" | "set_title" | "vote" | "reveal" | "reset_round" | "clear_history" | "remove_participant" | "poke";
  participantId: string;
  name?: string;
  mode?: "voter" | "spectator";
  title?: string;
  vote?: string | null;
  removeId?: string;
  targetId?: string;
}

export type ServerMessage =
  | {
      type: "room_state";
      room: Room;
      yourId?: string;
      yourVote?: string | null;
      yourToken?: string;
    }
  | {
      type: "error";
      error: string;
    }
  | {
      type: "poke";
      fromName: string;
    };
