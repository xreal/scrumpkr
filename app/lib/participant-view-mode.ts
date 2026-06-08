export type ParticipantViewMode = "voter" | "presenter" | "spectator";

export type ServerParticipantMode = "voter" | "spectator";

export function toServerMode(viewMode: ParticipantViewMode): ServerParticipantMode {
  return viewMode === "spectator" ? "spectator" : "voter";
}

export function isPresenterView(viewMode: ParticipantViewMode): boolean {
  return viewMode === "presenter";
}
