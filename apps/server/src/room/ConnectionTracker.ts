import type { WebSocket } from "ws";

/** Close code sent when the server ends a user's connection (kick / logout). The client does not auto-retry on it. */
export const CLOSE_CODE_DISCONNECTED = 4000;

/** Tracks the open sockets of each user; a user may be connected from several tabs at once. */
export class ConnectionTracker {
  private readonly sockets = new Map<string, Set<WebSocket>>();

  /** @returns true if this is the user's first open connection. */
  add(userId: string, socket: WebSocket): boolean {
    const open = this.sockets.get(userId) ?? new Set();
    open.add(socket);
    this.sockets.set(userId, open);
    return open.size === 1;
  }

  /** @returns true if that was the user's last open connection. */
  remove(userId: string, socket: WebSocket): boolean {
    const open = this.sockets.get(userId);
    open?.delete(socket);
    if (open && open.size > 0) return false;
    this.sockets.delete(userId);
    return true;
  }

  closeAll(userId: string) {
    for (const socket of this.sockets.get(userId) ?? []) {
      socket.close(CLOSE_CODE_DISCONNECTED, "Disconnected by server");
    }
  }
}
