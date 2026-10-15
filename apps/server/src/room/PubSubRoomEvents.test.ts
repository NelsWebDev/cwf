import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ publishToRoom: vi.fn(), publishToUser: vi.fn() }));
vi.mock("../pubsub", () => mocks);

import { PubSubRoomEvents } from "./PubSubRoomEvents";

describe("PubSubRoomEvents", () => {
  const events = new PubSubRoomEvents("room-1");
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["gameChanged", { started: true }, "game"],
    ["decksChanged", [{ id: "d" }], "decks"],
    ["rulesChanged", { pointsToWin: 1 }, "rules"],
    ["winnerSelected", "u1", "winnerSelected"],
    ["gameEnded", "alice", "gameEnded"],
    ["playerJoined", { id: "u1" }, "playerJoined"],
    ["playerLeft", "u1", "playerLeft"],
  ] as const)("publishes %s to the room's %s topic", (method, payload, topic) => {
    (events[method] as (arg: unknown) => void)(payload);
    expect(mocks.publishToRoom).toHaveBeenCalledWith("room-1", topic, payload);
  });

  it("publishes flag events", () => {
    events.gameOnHold();
    events.closeModal();
    expect(mocks.publishToRoom).toHaveBeenCalledWith("room-1", "holdGame", true);
    expect(mocks.publishToRoom).toHaveBeenCalledWith("room-1", "closeModal", true);
  });

  it("publishes hand and profile changes to the user only", () => {
    events.handReplaced("u1", []);
    events.cardsDealt("u1", []);
    events.profileChanged("u1", { id: "u1" } as never);
    expect(mocks.publishToUser).toHaveBeenCalledWith("u1", "myHand", []);
    expect(mocks.publishToUser).toHaveBeenCalledWith("u1", "givenCards", []);
    expect(mocks.publishToUser).toHaveBeenCalledWith("u1", "myProfile", { id: "u1" });
    expect(mocks.publishToRoom).not.toHaveBeenCalled();
  });
});
