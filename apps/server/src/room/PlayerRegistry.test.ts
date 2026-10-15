import { describe, expect, it } from "vitest";
import { makeRoster } from "../testing/fakes";

describe("PlayerRegistry", () => {
  it("separates active players from everyone", () => {
    const { roster, players } = makeRoster(3);
    players[1]!.isActive = false;
    expect(roster.allPlayers).toHaveLength(3);
    expect(roster.activePlayers).toEqual([players[0], players[2]]);
  });

  it("finds, adds and removes players", () => {
    const { roster, players } = makeRoster(1);
    expect(roster.findPlayer("p1")).toBe(players[0]);
    roster.remove("p1");
    expect(roster.findPlayer("p1")).toBeUndefined();
  });

  it("matches usernames case-insensitively, optionally excluding one player", () => {
    const { roster } = makeRoster(2);
    expect(roster.isUsernameAvailable("P1")).toBe(false);
    expect(roster.isUsernameAvailable("P1", "p1")).toBe(true);
    expect(roster.isUsernameAvailable("p1", "p2")).toBe(false);
    expect(roster.isUsernameAvailable("zed")).toBe(true);
  });
});
