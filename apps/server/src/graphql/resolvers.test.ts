import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchAllDecks: vi.fn(),
  importDeck: vi.fn(),
  shareRoundToDiscord: vi.fn(),
}));
vi.mock("../CardManager", () => ({ CardManager: { fetchAllDecks: mocks.fetchAllDecks } }));
vi.mock("../utils/cardImporter", () => ({ importDeck: mocks.importDeck }));
vi.mock("../utils/shareRound", () => ({ shareRoundToDiscord: mocks.shareRoundToDiscord }));

import { publishToRoom, publishToUser } from "../pubsub";
import { verifyToken } from "../session/token";
import { resolvers } from "./resolvers";

const makeCtx = () => {
  const user = { id: "u1" };
  const room = {
    usernameAvailable: vi.fn(() => true),
    renameUser: vi.fn(),
    describe: () => ({ id: "u1", username: "renamed" }),
  };
  return { user, room, ctx: { user, room } as never };
};

const updateUsername = (username: string, ctx: never) =>
  resolvers.Mutation.updateUsername({}, { username }, ctx);

describe("updateUsername mutation", () => {
  it("renames the user with a trimmed name and returns the profile", () => {
    const { room, ctx } = makeCtx();

    const result = updateUsername("  renamed  ", ctx);

    expect(room.renameUser).toHaveBeenCalledWith({ id: "u1" }, "renamed");
    expect(room.usernameAvailable).toHaveBeenCalledWith("renamed", "u1");
    expect(result).toEqual({ id: "u1", username: "renamed" });
  });

  it("rejects blank names", () => {
    const { room, ctx } = makeCtx();

    expect(() => updateUsername("   ", ctx)).toThrowError("Username is required");
    expect(room.renameUser).not.toHaveBeenCalled();
  });

  it("rejects names longer than 30 characters", () => {
    const { room, ctx } = makeCtx();

    expect(() => updateUsername("x".repeat(31), ctx)).toThrowError(/30 characters/);
    expect(room.renameUser).not.toHaveBeenCalled();
  });

  it("rejects names already in use", () => {
    const { room, ctx } = makeCtx();
    room.usernameAvailable.mockReturnValue(false);

    expect(() => updateUsername("taken", ctx)).toThrowError("Username already in use");
    expect(room.renameUser).not.toHaveBeenCalled();
  });

  it("requires a logged-in user", () => {
    expect(() => updateUsername("name", {} as never)).toThrowError(
      "Invalid session. Please login again",
    );
  });
});

const makeRoomCtx = (overrides: Record<string, unknown> = {}) => {
  const game = {
    toJSON: vi.fn(() => ({ started: false })),
    rules: { pointsToWin: 8 },
    currentRound: { id: "round" },
    addDeck: vi.fn(),
    removeDeck: vi.fn(),
    updateRules: vi.fn(),
    endGame: vi.fn(),
    playCards: vi.fn(),
    undoPlay: vi.fn(),
    requestNewHand: vi.fn(),
    pickWinner: vi.fn(),
    skipBlackCardAsCzar: vi.fn(),
    voteToSkip: vi.fn(),
  };
  const user = { id: "u1", username: "alice", hand: new Map([["c1", { id: "c1" }]]) };
  const room = {
    id: "room-1",
    game,
    players: { findPlayer: vi.fn((id: string) => (id === "u2" ? { displayName: "Bob" } : undefined)) },
    activeUsers: [user],
    usernameAvailable: vi.fn(() => true),
    registerUser: vi.fn(() => user),
    renameUser: vi.fn(),
    setDiscordName: vi.fn(),
    removeUser: vi.fn(),
    kick: vi.fn(),
    startGame: vi.fn(),
    describe: vi.fn((u: { id: string }) => ({ id: u.id, described: true })),
  };
  return { game, room, user, ctx: { room, user, claims: { sub: "u1", username: "alice" }, ...overrides } as never };
};

describe("access control", () => {
  const anonymous = { room: { game: {} } } as never;
  const calls: [string, () => unknown][] = [
    ["me", () => resolvers.Query.me({}, {}, anonymous)],
    ["players", () => resolvers.Query.players({}, {}, anonymous)],
    ["game", () => resolvers.Query.game({}, {}, anonymous)],
    ["gamePassword", () => resolvers.Query.gamePassword({}, {}, anonymous)],
    ["myHand", () => resolvers.Query.myHand({}, {}, anonymous)],
    ["decks", () => resolvers.Query.decks({}, {}, anonymous)],
    ["kickPlayer", () => resolvers.Mutation.kickPlayer({}, { userId: "x" }, anonymous)],
    ["importDeck", () => resolvers.Mutation.importDeck({}, { deckId: "x" }, anonymous)],
    ["addDeck", () => resolvers.Mutation.addDeck({}, { deckId: "x" }, anonymous)],
    ["removeDeck", () => resolvers.Mutation.removeDeck({}, { deckId: "x" }, anonymous)],
    ["updateRules", () => resolvers.Mutation.updateRules({}, { rules: {} }, anonymous)],
    ["startGame", () => resolvers.Mutation.startGame({}, {}, anonymous)],
    ["endGame", () => resolvers.Mutation.endGame({}, {}, anonymous)],
    ["playCards", () => resolvers.Mutation.playCards({}, { cards: [] }, anonymous)],
    ["pickWinner", () => resolvers.Mutation.pickWinner({}, { cardId: "x" }, anonymous)],
    ["logout", () => resolvers.Mutation.logout({}, {}, anonymous)],
    ["refreshToken", () => resolvers.Mutation.refreshToken({}, {}, anonymous)],
  ];

  // Wrapped in an async function so sync throws and async rejections are treated alike.
  it.each(calls)("%s rejects unauthenticated callers", async (_name, call) => {
    await expect((async () => call())()).rejects.toThrow("Invalid session. Please login again");
  });
});

describe("queries", () => {
  it("describes the caller and the active players through the room", () => {
    const { ctx } = makeRoomCtx();
    expect(resolvers.Query.me({}, {}, ctx)).toEqual({ id: "u1", described: true });
    expect(resolvers.Query.players({}, {}, ctx)).toEqual([{ id: "u1", described: true }]);
  });

  it("returns the room's game, the caller's hand and the decks", async () => {
    const { ctx } = makeRoomCtx();
    mocks.fetchAllDecks.mockResolvedValue([{ id: "d1" }]);
    expect(resolvers.Query.game({}, {}, ctx)).toEqual({ started: false });
    expect(resolvers.Query.myHand({}, {}, ctx)).toEqual([{ id: "c1" }]);
    await expect(resolvers.Query.decks({}, {}, ctx)).resolves.toEqual([{ id: "d1" }]);
  });

  it("lets the admin key read without a user", () => {
    const { room } = makeRoomCtx();
    expect(resolvers.Query.game({}, {}, { room, admin: true } as never)).toEqual({ started: false });
  });

  it("returns the game password from the environment", () => {
    vi.stubEnv("GAME_PASSWORD", "pw");
    const { ctx } = makeRoomCtx();
    expect(resolvers.Query.gamePassword({}, {}, ctx)).toBe("pw");
    vi.unstubAllEnvs();
  });

  it("reshapes round maps into lists", () => {
    const round = { plays: { u1: [{ id: "c" }] }, votesToSkip: { u1: true } } as never;
    expect(resolvers.GameRound.plays(round)).toEqual([{ userId: "u1", cards: [{ id: "c" }] }]);
    expect(resolvers.GameRound.votesToSkip(round)).toEqual([{ userId: "u1", vote: true }]);
  });
});

describe("login and rejoin", () => {
  beforeEach(() => vi.stubEnv("GAME_PASSWORD", "pw"));
  afterEach(() => vi.unstubAllEnvs());

  const login = (args: { username: string; password: string }, ctx: never) =>
    resolvers.Mutation.login({}, args, ctx);

  it("validates the credentials", () => {
    const { ctx } = makeRoomCtx();
    expect(() => login({ username: "", password: "pw" }, ctx)).toThrowError("Username is required");
    expect(() => login({ username: "a", password: "" }, ctx)).toThrowError("Password is required");
    expect(() => login({ username: "a", password: "bad" }, ctx)).toThrowError("Invalid password");
  });

  it("rejects usernames that are taken", () => {
    const { ctx, room } = makeRoomCtx();
    room.usernameAvailable.mockReturnValue(false);
    expect(() => login({ username: "a", password: "pw" }, ctx)).toThrowError("Username already in use");
  });

  it("registers the user and returns a token with their profile", () => {
    const { ctx, room } = makeRoomCtx();
    const result = login({ username: "  alice ", password: "pw" }, ctx);
    expect(room.registerUser).toHaveBeenCalledWith("alice");
    expect(result.user).toEqual({ id: "u1", described: true });
    expect(verifyToken(result.token)).toMatchObject({ sub: "u1", username: "alice" });
  });

  it("rejoin requires a valid token", () => {
    const { room } = makeRoomCtx();
    expect(() => resolvers.Mutation.rejoin({}, {}, { room } as never)).toThrowError("Invalid session");
  });

  it("rejoin reuses the restored user", () => {
    const { ctx, room } = makeRoomCtx();
    const result = resolvers.Mutation.rejoin({}, {}, ctx);
    expect(room.registerUser).not.toHaveBeenCalled();
    expect(result.user).toEqual({ id: "u1", described: true });
  });

  it("rejoin asks for a new name when the old one was taken", () => {
    const { room, ctx } = makeRoomCtx({ user: undefined });
    try {
      resolvers.Mutation.rejoin({}, {}, ctx);
      throw new Error("expected rejoin to throw");
    } catch (error) {
      expect(error).toMatchObject({ extensions: { code: "USERNAME_TAKEN" } });
    }
    expect(room.registerUser).not.toHaveBeenCalled();
  });

  it("rejoin registers a replacement name under the same identity", () => {
    const { room, ctx } = makeRoomCtx({
      user: undefined,
      claims: { sub: "u1", username: "alice", discordName: "Al" },
    });
    resolvers.Mutation.rejoin({}, { username: " newname " }, ctx);
    expect(room.registerUser).toHaveBeenCalledWith("newname", "u1", "Al");
  });

  it("refreshToken issues a token for the caller", () => {
    const { ctx } = makeRoomCtx();
    expect(verifyToken(resolvers.Mutation.refreshToken({}, {}, ctx))).toMatchObject({ sub: "u1" });
  });
});

describe("profile and membership mutations", () => {
  it("sets a trimmed Discord name, or clears it when blank", () => {
    const { ctx, room, user } = makeRoomCtx();
    resolvers.Mutation.updateDiscordName({}, { discordName: "  Al " }, ctx);
    expect(room.setDiscordName).toHaveBeenCalledWith(user, "Al");
    resolvers.Mutation.updateDiscordName({}, { discordName: "  " }, ctx);
    expect(room.setDiscordName).toHaveBeenLastCalledWith(user, undefined);
  });

  it("rejects long Discord names", () => {
    const { ctx } = makeRoomCtx();
    expect(() => resolvers.Mutation.updateDiscordName({}, { discordName: "x".repeat(31) }, ctx)).toThrowError(
      /30 characters/,
    );
  });

  it("logs out and kicks through the room", () => {
    const { ctx, room, user } = makeRoomCtx();
    expect(resolvers.Mutation.logout({}, {}, ctx)).toBe(true);
    expect(room.removeUser).toHaveBeenCalledWith(user);
    expect(resolvers.Mutation.kickPlayer({}, { userId: "u9" }, ctx)).toBe(true);
    expect(room.kick).toHaveBeenCalledWith("u9");
  });
});

describe("game mutations", () => {
  it("manages decks and rules, dropping null rule values", async () => {
    const { ctx, game } = makeRoomCtx();
    await resolvers.Mutation.addDeck({}, { deckId: "d1" }, ctx);
    resolvers.Mutation.removeDeck({}, { deckId: "d1" }, ctx);
    const rules = resolvers.Mutation.updateRules(
      {},
      { rules: { pointsToWin: 5, pointsToWinBy: null as never } },
      ctx,
    );

    expect(game.addDeck).toHaveBeenCalledWith("d1");
    expect(game.removeDeck).toHaveBeenCalledWith("d1");
    expect(game.updateRules).toHaveBeenCalledWith({ pointsToWin: 5 });
    expect(rules).toBe(game.rules);
  });

  it("starts the game, optionally announcing it", async () => {
    const { ctx, room } = makeRoomCtx();
    await resolvers.Mutation.startGame({}, {}, ctx);
    expect(room.startGame).toHaveBeenLastCalledWith({ announce: false });
    await resolvers.Mutation.startGame({}, { announceToDiscord: true }, ctx);
    expect(room.startGame).toHaveBeenLastCalledWith({ announce: true });
  });

  it("ends the game", () => {
    const { ctx, game } = makeRoomCtx();
    expect(resolvers.Mutation.endGame({}, {}, ctx)).toBe(true);
    expect(game.endGame).toHaveBeenCalled();
  });

  it("routes player actions to the game as the calling user", () => {
    const { ctx, game, user } = makeRoomCtx();
    const cards = [{ id: "c1", text: "" }];

    resolvers.Mutation.playCards({}, { cards }, ctx);
    resolvers.Mutation.undoPlay({}, {}, ctx);
    resolvers.Mutation.requestNewHand({}, {}, ctx);
    resolvers.Mutation.pickWinner({}, { cardId: "c1" }, ctx);
    resolvers.Mutation.skipBlackCard({}, {}, ctx);
    resolvers.Mutation.voteToSkipBlackCard({}, { vote: true }, ctx);

    expect(game.playCards).toHaveBeenCalledWith(user, cards);
    expect(game.undoPlay).toHaveBeenCalledWith(user);
    expect(game.requestNewHand).toHaveBeenCalledWith(user);
    expect(game.pickWinner).toHaveBeenCalledWith(user, "c1");
    expect(game.skipBlackCardAsCzar).toHaveBeenCalledWith(user);
    expect(game.voteToSkip).toHaveBeenCalledWith(user, true);
  });

  it("shares the current round using player display names", async () => {
    const { ctx, game } = makeRoomCtx();
    await expect(resolvers.Mutation.shareRoundToDiscord({}, {}, ctx)).resolves.toBe(true);

    const [round, nameOf] = mocks.shareRoundToDiscord.mock.calls[0]!;
    expect(round).toBe(game.currentRound);
    expect(nameOf("u2")).toBe("Bob");
    expect(nameOf("nobody")).toBe("Unknown");
  });

  describe("importDeck", () => {
    beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

    it("returns the imported deck", async () => {
      const { ctx } = makeRoomCtx();
      mocks.importDeck.mockResolvedValue({ id: "d1" });
      await expect(resolvers.Mutation.importDeck({}, { deckId: "x" }, ctx)).resolves.toEqual({ id: "d1" });
    });

    it("surfaces duplicate imports but hides other failures", async () => {
      const { ctx } = makeRoomCtx();
      mocks.importDeck.mockRejectedValueOnce(new Error("Deck already imported"));
      await expect(resolvers.Mutation.importDeck({}, { deckId: "x" }, ctx)).rejects.toThrow("Deck already imported");
      mocks.importDeck.mockRejectedValueOnce(new Error("secret internals"));
      await expect(resolvers.Mutation.importDeck({}, { deckId: "x" }, ctx)).rejects.toThrow("Failed to import deck");
    });
  });
});

describe("subscriptions", () => {
  it("scopes broadcast subscriptions to the caller's room", async () => {
    const { ctx } = makeRoomCtx();
    const events = resolvers.Subscription.game.subscribe({}, {}, ctx);
    const next = events.next();
    await publishToRoom("room-1", "game", { started: true } as never);
    expect((await next).value).toEqual({ game: { started: true } });
    await events.return?.();
  });

  it("starts the profile subscription with the current profile", async () => {
    const { ctx } = makeRoomCtx();
    const events = resolvers.Subscription.myProfile.subscribe({}, {}, ctx);
    expect((await events.next()).value).toEqual({ myProfile: { id: "u1", described: true } });
    await events.return?.();
  });

  it("delivers hand updates to the user only", async () => {
    const { ctx } = makeRoomCtx();
    const hand = resolvers.Subscription.myHand.subscribe({}, {}, ctx);
    const given = resolvers.Subscription.givenCards.subscribe({}, {}, ctx);
    const handNext = hand.next();
    const givenNext = given.next();
    await publishToUser("u1", "myHand", []);
    await publishToUser("u1", "givenCards", []);
    expect((await handNext).value).toEqual({ myHand: [] });
    expect((await givenNext).value).toEqual({ givenCards: [] });
    await Promise.all([hand.return?.(), given.return?.()]);
  });

  it("requires a user for personal subscriptions", () => {
    expect(() => resolvers.Subscription.myHand.subscribe({}, {}, { room: {} } as never)).toThrowError(
      "Invalid session",
    );
  });
});
