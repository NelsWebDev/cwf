import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  publish: vi.fn(),
  publishToUser: vi.fn(),
  game: {
    started: false,
    players: [],
    getPoints: vi.fn(() => 0),
    drawWhiteCards: vi.fn(() => []),
    currentCardCzar: undefined,
  },
  gameUsers: new Map(),
  activeUsers: [] as unknown[],
  closeConnections: vi.fn(),
}));

vi.mock("../singletons", () => ({
  game: mocks.game,
  socketManager: {
    gameUsers: mocks.gameUsers,
    get activeUsers() {
      return mocks.activeUsers;
    },
    closeConnections: mocks.closeConnections,
  },
}));

vi.mock("../pubsub", () => ({
  publish: mocks.publish,
  publishToUser: mocks.publishToUser,
}));

import { GameUser } from "./GameUser";
import { CardState, type WhiteCard } from "@repo/shared/types";

const makeCard = (id: string): WhiteCard => ({
  id,
  deckIds: [],
  text: `Answer ${id}`,
  isCustom: false,
  state: CardState.IN_USE,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

describe("GameUser hand updates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.publish.mockClear();
    mocks.publishToUser.mockClear();
    mocks.game.started = false;
    mocks.game.players = [];
    mocks.game.getPoints.mockClear();
    mocks.game.drawWhiteCards.mockClear();
    mocks.gameUsers.clear();
    mocks.activeUsers.length = 0;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("publishes the complete hand after removing played cards", () => {
    const user = new GameUser("player");
    const first = makeCard("first");
    const second = makeCard("second");
    user.addCardsToHand([first, second]);
    mocks.publishToUser.mockClear();

    user.removeWhiteCardsFromHand([first]);

    expect(mocks.publishToUser).toHaveBeenCalledWith(user.id, "myHand", [second]);
  });

  it("publishes added cards to the user after updating the server hand", () => {
    const user = new GameUser("player");
    const heldCard = makeCard("held");
    const returnedCard = makeCard("returned");
    user.addCardsToHand([heldCard]);

    user.addCardsToHand([returnedCard]);

    expect(user.hand.get(returnedCard.id)).toBe(returnedCard);
    expect(mocks.publishToUser).toHaveBeenLastCalledWith(user.id, "givenCards", [
      returnedCard,
    ]);
  });
});
