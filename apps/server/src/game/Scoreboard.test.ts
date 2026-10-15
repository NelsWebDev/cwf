import { describe, expect, it } from "vitest";
import { Scoreboard } from "./Scoreboard";

describe("Scoreboard", () => {
  it("counts points per player, starting at zero", () => {
    const board = new Scoreboard();
    expect(board.pointsOf("a")).toBe(0);
    board.award("a");
    expect(board.award("a")).toBe(2);
    expect(board.pointsOf("a")).toBe(2);
  });

  it("reports the leader, the earliest scorer winning ties", () => {
    const board = new Scoreboard();
    expect(board.leaderId).toBeUndefined();
    board.award("a");
    board.award("b");
    expect(board.leaderId).toBe("a");
    board.award("b");
    expect(board.leaderId).toBe("b");
  });

  it("needs both the target score and the winning margin", () => {
    const board = new Scoreboard();
    const rules = { pointsToWin: 2, pointsToWinBy: 2 };
    board.award("a");
    board.award("a");
    expect(board.hasWinner(rules)).toBe(true);
    board.award("b");
    expect(board.hasWinner(rules)).toBe(false);
    board.award("a");
    expect(board.hasWinner(rules)).toBe(true);
  });

  it("clears all points", () => {
    const board = new Scoreboard();
    board.award("a");
    board.clear();
    expect(board.pointsOf("a")).toBe(0);
    expect(board.leaderId).toBeUndefined();
  });
});
