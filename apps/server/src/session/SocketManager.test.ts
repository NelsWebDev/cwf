import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../singletons", () => ({
  game: { started: false, getPoints: () => 0, drawWhiteCards: () => [] },
  socketManager: {},
}));
vi.mock("../pubsub", () => ({ publish: vi.fn(), publishToUser: vi.fn() }));

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
