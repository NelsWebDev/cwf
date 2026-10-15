import { afterEach, describe, expect, it, vi } from "vitest";
import { makeRoster } from "../testing/fakes";
import { pickNextCzar } from "./czar";

describe("pickNextCzar", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects an empty player list", () => {
    expect(() => pickNextCzar([])).toThrow("No players");
  });

  it("picks randomly when there is no czar yet", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const { players } = makeRoster(3);
    expect(pickNextCzar(players)).toBe(players[2]);
  });

  it("rotates and wraps around", () => {
    const { players } = makeRoster(3);
    expect(pickNextCzar(players, players[0])).toBe(players[1]);
    expect(pickNextCzar(players, players[2])).toBe(players[0]);
  });

  it("falls back to the first player when the czar is gone", () => {
    const { players } = makeRoster(3);
    const gone = { ...players[0]!, id: "gone" } as (typeof players)[number];
    expect(pickNextCzar(players, gone)).toBe(players[0]);
  });
});
