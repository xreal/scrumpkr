const JOIN_ERROR_QUERY_KEY = "error";
const ROOM_NOT_FOUND_ERROR_CODE = "room_not_found";

export const ROOM_NOT_FOUND_MESSAGE = "Room not found.";
export const ROOM_LOOKUP_ERROR_MESSAGE =
  "We couldn't reach this room right now. Please try again.";
export const ROOM_CREATE_ERROR_MESSAGE =
  "We couldn't create a room right now. Please try again.";
export const TOO_MANY_CONNECTIONS_MESSAGE =
  "This room is already open in 3 tabs or windows for you. Close one and try again.";
export const ROOM_FULL_MESSAGE =
  "This room is full right now. Try again in a moment.";
export const REMOVED_FROM_ROOM_MESSAGE = "You were removed from this room.";

export function getJoinErrorMessageFromSearch(search: string): string | null {
  const searchParams = new URLSearchParams(search);
  const errorCode = searchParams.get(JOIN_ERROR_QUERY_KEY);

  if (errorCode === ROOM_NOT_FOUND_ERROR_CODE) {
    return ROOM_NOT_FOUND_MESSAGE;
  }

  return null;
}

export function roomNotFoundRedirectPath(): string {
  const searchParams = new URLSearchParams();
  searchParams.set(JOIN_ERROR_QUERY_KEY, ROOM_NOT_FOUND_ERROR_CODE);
  return `/?${searchParams.toString()}`;
}
