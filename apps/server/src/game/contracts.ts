import type { BlackCard, CardDeck, Game, Rules, User, WhiteCard } from "@repo/shared/types";
import type { GameUser } from "../session/GameUser";

/** What a game announces to the outside world; implemented by the transport layer. */
export interface GameEvents {
  gameChanged(game: Game): void;
  decksChanged(decks: CardDeck[]): void;
  rulesChanged(rules: Rules): void;
  winnerSelected(winnerId: string): void;
  gameEnded(winnerName: string): void;
  /** Too few players are connected to carry on. */
  gameOnHold(): void;
}

/** Changes to a player's cards, which only that player gets to see. */
export interface HandEvents {
  handReplaced(userId: string, hand: WhiteCard[]): void;
  cardsDealt(userId: string, cards: WhiteCard[]): void;
}

/** Everything a room can broadcast to its members. */
export interface RoomEvents extends GameEvents, HandEvents {
  profileChanged(userId: string, profile: User): void;
  closeModal(): void;
  playerJoined(player: User): void;
  playerLeft(userId: string): void;
}

/** The people a game is played with. */
export interface Roster {
  readonly allPlayers: GameUser[];
  readonly activePlayers: GameUser[];
  findPlayer(userId: string): GameUser | undefined;
}

export type CardQuery = {
  deckIds: string[];
  singleAnswerOnly: boolean;
};

/** Where decks and their cards come from. */
export interface CardSource {
  fetchDeck(deckId: string): Promise<CardDeck | null>;
  fetchCards(query: CardQuery): Promise<{ blackCards: BlackCard[]; whiteCards: WhiteCard[] }>;
}
