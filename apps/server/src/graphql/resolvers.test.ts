import { describe, expect, it, vi } from "vitest";

vi.mock("../CardManager", () => ({ CardManager: {} }));
vi.mock("../utils/cardImporter", () => ({ importDeck: vi.fn() }));
vi.mock("../utils/shareRound", () => ({ shareRoundToDiscord: vi.fn() }));

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
