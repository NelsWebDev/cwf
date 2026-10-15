import { describe, expect, it } from "vitest";
import { publishToRoom, publishToUser, subscribeToRoom, subscribeToUser } from "./pubsub";

describe("pubsub", () => {
  it("delivers room events keyed by the subscription field name", async () => {
    const events = subscribeToRoom("r1", "rules");
    const next = events.next();
    await publishToRoom("r1", "rules", { pointsToWin: 3 } as never);
    expect((await next).value).toEqual({ rules: { pointsToWin: 3 } });
    await events.return?.();
  });

  it("keeps rooms isolated from each other", async () => {
    const other = subscribeToRoom("r2", "gameEnded");
    const mine = subscribeToRoom("r1", "gameEnded");
    const otherNext = other.next();
    const mineNext = mine.next();

    await publishToRoom("r1", "gameEnded", "alice");

    expect((await mineNext).value).toEqual({ gameEnded: "alice" });
    const result = await Promise.race([otherNext, new Promise((r) => setTimeout(() => r("quiet"), 20))]);
    expect(result).toBe("quiet");
    await Promise.all([other.return?.(), mine.return?.()]);
  });

  it("delivers user events only to that user", async () => {
    const events = subscribeToUser("u1", "myHand");
    const next = events.next();
    await publishToUser("u2", "myHand", []);
    await publishToUser("u1", "myHand", [{ id: "c" } as never]);
    expect((await next).value).toEqual({ myHand: [{ id: "c" }] });
    await events.return?.();
  });
});
