import { vi } from "vitest";
import { CardState, type BlackCard, type WhiteCard } from "@repo/shared/types";
import type { CardQuery, CardSource, RoomEvents } from "../game/contracts";
import { PlayerRegistry } from "../room/PlayerRegistry";
import { GameUser } from "../session/GameUser";

export const makeEvents = () => ({
  gameChanged: vi.fn(),
  decksChanged: vi.fn(),
  rulesChanged: vi.fn(),
  winnerSelected: vi.fn(),
  gameEnded: vi.fn(),
  gameOnHold: vi.fn(),
  handReplaced: vi.fn(),
  cardsDealt: vi.fn(),
  profileChanged: vi.fn(),
  closeModal: vi.fn(),
  playerJoined: vi.fn(),
  playerLeft: vi.fn(),
}) satisfies RoomEvents;

export const makeWhiteCard = (id: string, overrides: Partial<WhiteCard> = {}): WhiteCard => ({
  id,
  deckIds: ["deck-1"],
  text: `Answer ${id}`,
  isCustom: false,
  state: CardState.AVAILABLE,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...overrides,
});

export const makeBlackCard = (id: string, overrides: Partial<BlackCard> = {}): BlackCard => ({
  id,
  deckIds: ["deck-1"],
  text: `Prompt ${id}`,
  pick: 1,
  state: CardState.AVAILABLE,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...overrides,
});

export const makeWhiteCards = (count: number, prefix = "white") =>
  Array.from({ length: count }, (_, index) => makeWhiteCard(`${prefix}-${index}`));

export const makeBlackCards = (count: number) =>
  Array.from({ length: count }, (_, index) => makeBlackCard(`black-${index}`));

export const makeCardSource = (
  cards: { blackCards?: BlackCard[]; whiteCards?: WhiteCard[] } = {},
) => ({
  fetchDeck: vi.fn(async (id: string) => ({ id, name: id }) as never),
  fetchCards: vi.fn(async (_query: CardQuery) => ({
    blackCards: cards.blackCards ?? makeBlackCards(60),
    whiteCards: cards.whiteCards ?? makeWhiteCards(500),
  })),
}) satisfies CardSource;

/** A roster with `count` connected players named p1, p2, ... */
export const makeRoster = (count: number) => {
  const events = makeEvents();
  const roster = new PlayerRegistry();
  const players = Array.from({ length: count }, (_, index) => {
    const player = new GameUser({ username: `p${index + 1}`, id: `p${index + 1}` }, events);
    player.isActive = true;
    roster.add(player);
    return player;
  });
  return { roster, players, events };
};
