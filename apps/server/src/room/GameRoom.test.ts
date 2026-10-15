import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoundStatus } from "@repo/shared/types";
import { makeCardSource, makeEvents } from "../testing/fakes";
import { CLOSE_CODE_DISCONNECTED } from "./ConnectionTracker";
import { GameRoom } from "./GameRoom";

const makeSocket = () => ({ close: vi.fn() }) as never as import("ws").WebSocket & { close: ReturnType<typeof vi.fn> };

const setup = () => {
  const events = makeEvents();
  const announcer = {
    updatePlayers: vi.fn(() => Promise.resolve()),
    announceGameStart: vi.fn(() => Promise.resolve()),
  };
  const room = new GameRoom("room-1", { events, cards: makeCardSource(), announcer });
  return { room, events, announcer };
};

describe("GameRoom membership", () => {
  it("is available when nobody uses the name, and case-insensitive otherwise", () => {
    const { room } = setup();
    room.registerUser("Alice");
    expect(room.usernameAvailable("bob")).toBe(true);
    expect(room.usernameAvailable("aLiCe")).toBe(false);
  });

  it("lets a user keep their own name but not take another's", () => {
    const { room } = setup();
    const alice = room.registerUser("Alice");
    room.registerUser("Bob");
    expect(room.usernameAvailable("alice", alice.id)).toBe(true);
    expect(room.usernameAvailable("bob", alice.id)).toBe(false);
  });

  it("refuses to register a taken name", () => {
    const { room } = setup();
    room.registerUser("Alice");
    expect(() => room.registerUser("alice")).toThrow("Username already in use");
  });

  it("restores a user from token claims, unless their name was taken", () => {
    const { room } = setup();
    const claims = { sub: "u1", username: "Alice" } as never;
    const restored = room.userFromToken(claims)!;
    expect(restored.id).toBe("u1");
    expect(room.userFromToken(claims)).toBe(restored);

    expect(room.userFromToken({ sub: "u2", username: "alice" } as never)).toBeUndefined();
    expect(room.userFromToken(undefined)).toBeUndefined();
  });

  it("renames a user and tells everyone", () => {
    const { room, events } = setup();
    const user = room.registerUser("old");
    room.renameUser(user, "new");
    expect(user.username).toBe("new");
    expect(events.profileChanged).toHaveBeenCalledWith(user.id, expect.objectContaining({ username: "new" }));
    expect(events.playerJoined).toHaveBeenCalledWith(expect.objectContaining({ username: "new" }));
  });

  it("sets the Discord name", () => {
    const { room, events } = setup();
    const user = room.registerUser("a");
    room.setDiscordName(user, "disc");
    expect(user.displayName).toBe("disc");
    expect(events.profileChanged).toHaveBeenCalled();
  });

  it("kicks by closing sockets and removes users on logout", () => {
    const { room } = setup();
    const user = room.registerUser("a");
    const socket = makeSocket();
    room.onConnection(user, socket);

    room.kick(user.id);
    expect(socket.close).toHaveBeenCalledWith(CLOSE_CODE_DISCONNECTED, expect.any(String));

    room.removeUser(user);
    expect(room.players.findPlayer(user.id)).toBeUndefined();
  });
});

describe("GameRoom presence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("announces a user once, on their first connection", () => {
    const { room, events } = setup();
    const user = room.registerUser("a");
    room.onConnection(user, makeSocket());
    room.onConnection(user, makeSocket());
    expect(user.isActive).toBe(true);
    expect(events.playerJoined).toHaveBeenCalledOnce();
  });

  it("marks the user inactive only after their last socket closes", () => {
    const { room, events } = setup();
    const user = room.registerUser("a");
    const one = makeSocket();
    const two = makeSocket();
    room.onConnection(user, one);
    room.onConnection(user, two);

    room.onDisconnection(user, one);
    expect(user.isActive).toBe(true);
    room.onDisconnection(user, two);
    expect(user.isActive).toBe(false);
    expect(events.playerLeft).toHaveBeenCalledWith(user.id);
  });

  it("removes a user who stays disconnected for 30 seconds", () => {
    const { room } = setup();
    const user = room.registerUser("a");
    const socket = makeSocket();
    room.onConnection(user, socket);
    room.onDisconnection(user, socket);

    vi.advanceTimersByTime(29_999);
    expect(room.players.findPlayer(user.id)).toBe(user);
    vi.advanceTimersByTime(1);
    expect(room.players.findPlayer(user.id)).toBeUndefined();
  });

  it("keeps a user who reconnects in time", () => {
    const { room } = setup();
    const user = room.registerUser("a");
    const socket = makeSocket();
    room.onConnection(user, socket);
    room.onDisconnection(user, socket);
    room.onConnection(user, makeSocket());
    vi.advanceTimersByTime(60_000);
    expect(room.players.findPlayer(user.id)).toBe(user);
  });

  it("puts a running game on hold and ends it when too few players remain", async () => {
    const { room, events } = setup();
    const sockets = ["a", "b", "c"].map((name) => {
      const user = room.registerUser(name);
      const socket = makeSocket();
      room.onConnection(user, socket);
      return { user, socket };
    });
    await room.startGame();

    room.onDisconnection(sockets[0]!.user, sockets[0]!.socket);
    expect(events.gameOnHold).toHaveBeenCalled();

    vi.advanceTimersByTime(30_000);
    expect(room.game.started).toBe(false);
    expect(events.gameEnded).toHaveBeenCalled();
  });

  it("announces the game start only when asked", async () => {
    const { room, announcer } = setup();
    ["a", "b", "c"].forEach((name) => room.onConnection(room.registerUser(name), makeSocket()));

    await room.startGame();
    expect(announcer.announceGameStart).not.toHaveBeenCalled();
    room.game.endGame();
    await room.startGame({ announce: true });
    expect(announcer.announceGameStart).toHaveBeenCalledWith(["a", "b", "c"]);
  });
});

describe("GameRoom czar disconnect", () => {
  const GRACE_MS = 5_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const startRoom = async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ctx = setup();
    const members = ["a", "b", "c", "d"].map((name) => {
      const user = room_register(ctx.room, name);
      return user;
    });
    await ctx.room.startGame();
    const round = ctx.room.game.currentRound!;
    const czar = members.find((m) => m.user.id === round.cardCzarId)!;
    return { ...ctx, members, czar, round };
  };

  const room_register = (room: GameRoom, name: string) => {
    const user = room.registerUser(name);
    const socket = makeSocket();
    room.onConnection(user, socket);
    return { user, socket };
  };

  it("skips the round with a new czar if the czar does not return in time", async () => {
    const { room, czar, round } = await startRoom();
    room.onDisconnection(czar.user, czar.socket);

    vi.advanceTimersByTime(GRACE_MS - 1);
    expect(room.game.currentRound).toBe(round);
    vi.advanceTimersByTime(1);
    expect(room.game.currentRound).not.toBe(round);
    expect(room.game.currentCardCzar).not.toBe(czar.user);
  });

  it("does not skip if the czar reconnects within the grace period", async () => {
    const { room, czar, round } = await startRoom();
    room.onDisconnection(czar.user, czar.socket);
    vi.advanceTimersByTime(2_000);
    room.onConnection(czar.user, makeSocket());
    vi.advanceTimersByTime(GRACE_MS);
    expect(room.game.currentRound).toBe(round);
  });

  it("ignores non-czar disconnects and the winner-showing phase", async () => {
    const { room, members, czar, round } = await startRoom();
    const other = members.find((m) => m !== czar)!;
    room.onDisconnection(other.user, other.socket);
    vi.advanceTimersByTime(GRACE_MS);
    expect(room.game.currentRound).toBe(round);

    round.status = RoundStatus.SHOWING_WINNER;
    room.onDisconnection(czar.user, czar.socket);
    vi.advanceTimersByTime(GRACE_MS);
    expect(room.game.currentRound).toBe(round);
  });
});
