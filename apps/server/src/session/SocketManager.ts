import type { WebSocket } from "ws";
import { RoundStatus } from "../types";
import { GameUser } from "./GameUser";
import { game } from "../singletons";
import { publish } from "../pubsub";

// Close code sent when the server ends a user's connection (kick / logout). The client does not auto-retry on it.
export const CLOSE_CODE_DISCONNECTED = 4000;

export class SocketManager {
  gameUsers: Map<string, GameUser> = new Map();
  private connections: Map<string, Set<WebSocket>> = new Map();

  async kickByUserId(userId: string) {
    this.gameUsers.get(userId)?.kick();
  }

  closeConnections(userId: string) {
    for (const socket of this.connections.get(userId) ?? []) {
      socket.close(CLOSE_CODE_DISCONNECTED, "Disconnected by server");
    }
  }

  userIsOnline(userId: string) {
    return this.gameUsers.get(userId)?.isActive ?? false;
  }

  onConnection(user: GameUser, socket: WebSocket) {
    if (this.activeUsers.length < 3) {
      publish("closeModal", true);
    }
    user.isActive = true;
    const sockets = this.connections.get(user.id) ?? new Set();
    sockets.add(socket);
    this.connections.set(user.id, sockets);
    if (sockets.size === 1) {
      publish("playerJoined", user.toJSON());
    }
  }

  onDisconnection(user: GameUser, socket: WebSocket) {
    const sockets = this.connections.get(user.id);
    sockets?.delete(socket);
    if (!sockets || sockets.size === 0) {
      this.connections.delete(user.id);
      this.onLastUserDisconnect(user);
    }
  }

  private onLastUserDisconnect(user: GameUser) {
    user.isActive = false;
    publish("playerLeft", user.id);
    if (
      game.currentRound?.cardCzarId === user.id &&
      game.currentRound?.status === RoundStatus.WAITING_FOR_PLAYERS
    ) {
      this.gameUsers.forEach((gameUser) => {
        if (gameUser.isActive) {
          gameUser.undoPlay();
        }
      });
      game.nextRound();
    }
  }

  get activeUsers() {
    return this.usersArray.filter((user) => user.isActive);
  }

  get usersArray() {
    return [...Array.from(this.gameUsers.values())];
  }

  usernameAvailable(username: string) {
    return !this.usersArray.some(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    );
  }

  registerUser(username: string) {
    if (!this.usernameAvailable(username)) {
      throw new Error("Username already in use");
    }
    const newUser = new GameUser(username);
    this.gameUsers.set(newUser.id, newUser);
    return newUser;
  }
}
