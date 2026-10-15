import type { WebSocket } from "ws";
import type { CardSource, RoomEvents } from "../game/contracts";
import { Game, MIN_PLAYERS } from "../game/Game";
import { GameUser } from "../session/GameUser";
import type { TokenClaims } from "../session/token";
import { RoundStatus } from "@repo/shared/types";
import { ConnectionTracker } from "./ConnectionTracker";
import { PlayerRegistry } from "./PlayerRegistry";

/** Tells the outside world who is in the room and when a game begins (e.g. a Discord post). */
export interface Announcer {
  updatePlayers(playerNames: string[]): Promise<unknown>;
  announceGameStart(playerNames: string[]): Promise<unknown>;
}

export type GameRoomDependencies = {
  events: RoomEvents;
  cards: CardSource;
  announcer: Announcer;
};

/** Grace period so the czar can refresh or reconnect before being skipped. */
const CZAR_RECONNECT_GRACE_MS = 5_000;
/** How long a disconnected player is kept before their seat is given up. */
const INACTIVE_PLAYER_TTL_MS = 30_000;

/**
 * A place where one group of players plays games: who is in it, who is connected,
 * and the game being played. Everything that used to be a process-wide singleton hangs off
 * a room, so supporting several rooms means creating several of these.
 */
export class GameRoom {
  readonly game: Game;
  readonly players = new PlayerRegistry();

  private readonly connections = new ConnectionTracker();
  private readonly removalTimers = new Map<string, NodeJS.Timeout>();
  private readonly events: RoomEvents;
  private readonly announcer: Announcer;

  constructor(
    readonly id: string,
    { events, cards, announcer }: GameRoomDependencies,
  ) {
    this.events = events;
    this.announcer = announcer;
    this.game = new Game({ roster: this.players, events, cards });
  }

  get activeUsers() {
    return this.players.activePlayers;
  }

  // ---- Membership ----

  usernameAvailable(username: string, exceptUserId?: string) {
    return this.players.isUsernameAvailable(username, exceptUserId);
  }

  registerUser(username: string, id?: string, discordName?: string): GameUser {
    if (!this.usernameAvailable(username)) {
      throw new Error("Username already in use");
    }
    const user = new GameUser({ username, id, discordName }, this.events);
    this.players.add(user);
    this.game.dealHandTo(user);
    return user;
  }

  /** Resolves the user behind a token, recreating them if they were removed (inactivity, restart) and their name is still free. */
  userFromToken(claims: TokenClaims | undefined): GameUser | undefined {
    if (!claims) return undefined;
    const existing = this.players.findPlayer(claims.sub);
    if (existing) return existing;
    if (!this.usernameAvailable(claims.username)) return undefined;
    return this.registerUser(claims.username, claims.sub, claims.discordName);
  }

  renameUser(user: GameUser, username: string) {
    user.username = username;
    this.events.profileChanged(user.id, this.describe(user));
    this.events.playerJoined(this.describe(user));
    this.syncAnnouncement();
  }

  setDiscordName(user: GameUser, discordName: string | undefined) {
    user.discordName = discordName;
    this.events.profileChanged(user.id, this.describe(user));
    this.syncAnnouncement();
  }

  /** Disconnects the user's sockets; they stay in the room until the inactivity timeout. */
  kick(userId: string) {
    this.connections.closeAll(userId);
  }

  /** Disconnects the user and removes them from the room immediately. */
  removeUser(user: GameUser) {
    this.kick(user.id);
    this.cancelRemoval(user.id);
    this.players.remove(user.id);
  }

  describe(user: GameUser) {
    return this.game.describePlayer(user);
  }

  // ---- Presence ----

  onConnection(user: GameUser, socket: WebSocket) {
    if (this.activeUsers.length < MIN_PLAYERS) {
      this.events.closeModal();
    }
    user.isActive = true;
    this.cancelRemoval(user.id);

    if (this.connections.add(user.id, socket)) {
      this.events.playerJoined(this.describe(user));
      this.syncAnnouncement();
    }
  }

  onDisconnection(user: GameUser, socket: WebSocket) {
    if (!this.connections.remove(user.id, socket)) return;

    user.isActive = false;
    console.log(`User ${user.username} is inactive`);
    if (this.game.started && this.activeUsers.length < MIN_PLAYERS) {
      this.events.gameOnHold();
    }
    this.scheduleRemoval(user);

    this.events.playerLeft(user.id);
    this.syncAnnouncement();
    this.skipRoundIfCzarStaysAway(user);
  }

  // ---- Game ----

  async startGame({ announce = false } = {}) {
    await this.game.start();
    if (!announce) return;
    try {
      await this.announcer.announceGameStart(this.activeUsers.map((user) => user.displayName));
    } catch (error) {
      console.error("Failed to announce game start to Discord", error);
    }
  }

  // ---- Internals ----

  private scheduleRemoval(user: GameUser) {
    this.cancelRemoval(user.id);
    this.removalTimers.set(
      user.id,
      setTimeout(() => {
        this.removalTimers.delete(user.id);
        if (this.players.findPlayer(user.id) !== user) return;
        console.log(`User ${user.username} deleted due to inactivity`);
        this.players.remove(user.id);
        if (this.game.started && this.activeUsers.length < MIN_PLAYERS) {
          this.game.endGame();
        }
      }, INACTIVE_PLAYER_TTL_MS),
    );
  }

  private cancelRemoval(userId: string) {
    clearTimeout(this.removalTimers.get(userId));
    this.removalTimers.delete(userId);
  }

  private skipRoundIfCzarStaysAway(user: GameUser) {
    const round = this.game.currentRound;
    if (round?.cardCzarId !== user.id || round.status === RoundStatus.SHOWING_WINNER) return;

    setTimeout(() => {
      if (
        user.isActive ||
        this.game.currentRound?.id !== round.id ||
        round.status === RoundStatus.SHOWING_WINNER ||
        this.activeUsers.length === 0
      ) {
        return;
      }
      this.game.skipBlackCard({ replaceCzar: true });
    }, CZAR_RECONNECT_GRACE_MS);
  }

  private syncAnnouncement() {
    this.announcer
      .updatePlayers(this.activeUsers.map((user) => user.displayName))
      .catch((error) => console.error("Failed to update Discord announcement", error));
  }
}
