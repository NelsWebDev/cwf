import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usernameAvailable: vi.fn(),
}));

vi.mock("../CardManager", () => ({ CardManager: {} }));
vi.mock("../singletons", () => ({
  game: {},
  socketManager: { usernameAvailable: mocks.usernameAvailable },
}));
vi.mock("../pubsub", () => ({ subscribe: vi.fn(), subscribeToUser: vi.fn() }));
vi.mock("../utils/cardImporter", () => ({ importDeck: vi.fn() }));
vi.mock("../utils/discordWebhook", () => ({ announceGameStart: vi.fn(), postImageToDiscord: vi.fn() }));
vi.mock("../utils/roundImage", () => ({ renderRoundImage: vi.fn() }));

import { resolvers } from "./resolvers";

const makeCtx = () => {
  const user = {
    id: "u1",
    rename: vi.fn(),
    toJSON: () => ({ id: "u1", username: "renamed" }),
  };
  return { user, ctx: { user } as never };
};

const updateUsername = (username: string, ctx: never) =>
  resolvers.Mutation.updateUsername({}, { username }, ctx);

describe("updateUsername mutation", () => {
  beforeEach(() => {
    mocks.usernameAvailable.mockReset().mockReturnValue(true);
  });

  it("renames the user with a trimmed name and returns the profile", () => {
    const { user, ctx } = makeCtx();

    const result = updateUsername("  renamed  ", ctx);

    expect(user.rename).toHaveBeenCalledWith("renamed");
    expect(mocks.usernameAvailable).toHaveBeenCalledWith("renamed", "u1");
    expect(result).toEqual({ id: "u1", username: "renamed" });
  });

  it("rejects blank names", () => {
    const { user, ctx } = makeCtx();

    expect(() => updateUsername("   ", ctx)).toThrowError("Username is required");
    expect(user.rename).not.toHaveBeenCalled();
  });

  it("rejects names longer than 30 characters", () => {
    const { user, ctx } = makeCtx();

    expect(() => updateUsername("x".repeat(31), ctx)).toThrowError(/30 characters/);
    expect(user.rename).not.toHaveBeenCalled();
  });

  it("rejects names already in use", () => {
    mocks.usernameAvailable.mockReturnValue(false);
    const { user, ctx } = makeCtx();

    expect(() => updateUsername("taken", ctx)).toThrowError("Username already in use");
    expect(user.rename).not.toHaveBeenCalled();
  });

  it("requires a logged-in user", () => {
    expect(() => updateUsername("name", {} as never)).toThrowError(
      "Invalid session. Please login again",
    );
  });
});
