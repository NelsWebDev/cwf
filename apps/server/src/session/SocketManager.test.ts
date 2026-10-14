import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  game: {
    started: false,
    getPoints: () => 0,
    drawWhiteCards: () => [],
    currentRound: undefined as unknown,
    skipBlackCard: vi.fn(),
  },
}));
vi.mock("../singletons", () => ({
  game: mocks.game,
  socketManager: { activeUsers: [] },
}));
vi.mock("../utils/discordWebhook", () => ({
  updateAnnouncedPlayers: vi.fn(() => Promise.resolve()),
}));
vi.mock("../pubsub", () => ({ publish: vi.fn(), publishToUser: vi.fn() }));

import { RoundStatus } from "../types";
import { SocketManager } from "./SocketManager";

describe("SocketManager.usernameAvailable", () => {
  let manager: SocketManager;

  beforeEach(() => {
    manager = new SocketManager();
  });

  it("is available when nobody uses the name", () => {
    manager.registerUser("alice");

    expect(manager.usernameAvailable("bob")).toBe(true);
  });

  it("treats names as taken case-insensitively", () => {
    manager.registerUser("Alice");

    expect(manager.usernameAvailable("aLiCe")).toBe(false);
  });

  it("lets a user keep or re-case their own name when excluded", () => {
    const alice = manager.registerUser("Alice");

    expect(manager.usernameAvailable("alice", alice.id)).toBe(true);
  });

  it("still blocks another user's name when excluding someone else", () => {
    const alice = manager.registerUser("Alice");
    manager.registerUser("Bob");

    expect(manager.usernameAvailable("bob", alice.id)).toBe(false);
  });
});

describe("SocketManager czar disconnect", () => {
  const socket = {} as never;
  let manager: SocketManager;

  const setup = (status = RoundStatus.WAITING_FOR_PLAYERS) => {
    manager = new SocketManager();
    const czar = manager.registerUser("czar");
    const other = manager.registerUser("other");
    manager.onConnection(czar, socket);
    manager.onConnection(other, {} as never);
    mocks.game.currentRound = { id: "r1", cardCzarId: czar.id, status };
    return czar;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mocks.game.skipBlackCard.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips the round after 5 seconds if the czar does not return", () => {
    const czar = setup();
    manager.onDisconnection(czar, socket);

    vi.advanceTimersByTime(4999);
    expect(mocks.game.skipBlackCard).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(mocks.game.skipBlackCard).toHaveBeenCalledWith(true);
  });

  it("skips while the czar is selecting a winner", () => {
    const czar = setup(RoundStatus.SELECTING_WINNER);
    manager.onDisconnection(czar, socket);
    vi.advanceTimersByTime(5000);
    expect(mocks.game.skipBlackCard).toHaveBeenCalledOnce();
  });

  it("does not skip if the czar reconnects within 5 seconds", () => {
    const czar = setup();
    manager.onDisconnection(czar, socket);
    vi.advanceTimersByTime(2000);
    manager.onConnection(czar, {} as never);
    vi.advanceTimersByTime(5000);
    expect(mocks.game.skipBlackCard).not.toHaveBeenCalled();
  });

  it("does not skip if the round changed during the grace period", () => {
    const czar = setup();
    manager.onDisconnection(czar, socket);
    mocks.game.currentRound = { id: "r2", cardCzarId: "x", status: RoundStatus.WAITING_FOR_PLAYERS };
    vi.advanceTimersByTime(5000);
    expect(mocks.game.skipBlackCard).not.toHaveBeenCalled();
  });

  it("ignores non-czar disconnects and the winner-showing phase", () => {
    const czar = setup();
    const other = manager.gameUsers.get(manager.usersArray[1].id)!;
    manager.onDisconnection(other, {} as never);
    vi.advanceTimersByTime(5000);
    expect(mocks.game.skipBlackCard).not.toHaveBeenCalled();

    (mocks.game.currentRound as { status: RoundStatus }).status = RoundStatus.SHOWING_WINNER;
    manager.onDisconnection(czar, socket);
    vi.advanceTimersByTime(5000);
    expect(mocks.game.skipBlackCard).not.toHaveBeenCalled();
  });
});
