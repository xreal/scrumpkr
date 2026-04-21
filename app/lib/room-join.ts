const JOIN_ERROR_QUERY_KEY = "error";
const ROOM_NOT_FOUND_ERROR_CODE = "room_not_found";

export const ROOM_NOT_FOUND_MESSAGE = "Room not found.";

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
