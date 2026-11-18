import { getDemoPlaybackEngine, type DemoSocketMessage } from "./DemoPlaybackEngine";

type SocketHandler = ((event: { data?: string }) => void) | null;

/**
 * Same callback shape the production hooks already use (`onopen`, `onmessage`,
 * `onclose`, `close`). It never opens a network socket.
 */
export class DemoWebSocketMock {
  onopen: SocketHandler = null;
  onclose: SocketHandler = null;
  onerror: SocketHandler = null;
  onmessage: SocketHandler = null;
  readyState = 0;
  private unsubscribe: (() => void) | null = null;

  connect(): void {
    this.readyState = 1;
    this.unsubscribe = getDemoPlaybackEngine().addSocketListener((message) => {
      this.deliver(message);
    });
    this.onopen?.({});
  }

  close(): void {
    this.readyState = 3;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.onclose?.({});
  }

  private deliver(message: DemoSocketMessage): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

export function createDemoWebSocketMock(): DemoWebSocketMock {
  return new DemoWebSocketMock();
}
