import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useWebSocket } from "./useWebSocket";

async function flushAsyncWork(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readonly url: string;
  readyState = MockWebSocket.OPEN;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string | URL) {
    this.url = String(url);
    MockWebSocket.instances.push(this);
  }

  send(_data: string | ArrayBufferLike | Blob | ArrayBufferView): void {}

  close(code = 1000, reason = ""): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close", { code, reason }));
  }
}

describe("useWebSocket", () => {
  const originalWebSocket = globalThis.WebSocket;
  const originalFetch = globalThis.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    MockWebSocket.instances = [];
    fetchMock.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ ok: true }) });
    Object.defineProperty(globalThis, "WebSocket", {
      value: MockWebSocket,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(globalThis, "WebSocket", {
      value: originalWebSocket,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      writable: true,
      configurable: true,
    });
  });

  it("reconnects after close while still mounted", async () => {
    renderHook(() => useWebSocket("room-1"));

    await flushAsyncWork();

    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => {
      MockWebSocket.instances[0].close();
    });

    expect(MockWebSocket.instances).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it("does not reconnect after unmount", async () => {
    const { unmount } = renderHook(() => useWebSocket("room-1"));

    await flushAsyncWork();

    expect(MockWebSocket.instances).toHaveLength(1);

    await act(async () => {
      unmount();
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("keeps a single socket after connection opens", async () => {
    renderHook(() => useWebSocket("room-1"));

    await flushAsyncWork();

    expect(MockWebSocket.instances).toHaveLength(1);

    await act(async () => {
      MockWebSocket.instances[0].onopen?.(new Event("open"));
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("keeps connection open while timers advance", async () => {
    renderHook(() => useWebSocket("room-1"));

    await flushAsyncWork();

    expect(MockWebSocket.instances).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    });

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("surfaces connection limit errors before opening a socket", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: vi.fn().mockResolvedValue({ code: "too_many_connections" }),
    });

    const { result } = renderHook(() => useWebSocket("room-1"));

    await flushAsyncWork();

    expect(MockWebSocket.instances).toHaveLength(0);
    expect(result.current.connectionError).toBe(
      "This room is already open in 3 tabs or windows for you. Close one and try again."
    );
  });

  it("surfaces user-facing socket action errors", async () => {
    const { result } = renderHook(() => useWebSocket("room-1"));

    await flushAsyncWork();

    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => {
      MockWebSocket.instances[0].onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ type: "error", error: "Round already revealed" }),
        })
      );
    });

    expect(result.current.actionError).toBe(
      "This round is already revealed. Reset the round to vote again."
    );
  });
});
