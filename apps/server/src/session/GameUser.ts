import type { HandEvents } from "../game/contracts";
import type { WhiteCard } from "@repo/shared/types";

export type PlayerProfile = {
  username: string;
  id?: string | undefined;
  discordName?: string | undefined;
};

/** A person in a room: who they are, whether they are connected, and the cards they hold. */
export class GameUser {
  readonly id: string;
  username: string;
  discordName?: string | undefined;
  isActive = false;
  /** How many times the player has swapped their hand this game. */
  newHandsUsed = 0;

  private _hand = new Map<string, WhiteCard>();

  constructor(
    { username, id = crypto.randomUUID(), discordName }: PlayerProfile,
    private readonly events: HandEvents,
  ) {
    this.id = id;
    this.username = username;
    this.discordName = discordName;
  }

  /** Name used in Discord announcements and shared round images; falls back to the username. */
  get displayName() {
    return this.discordName || this.username;
  }

  get hand() {
    return this._hand;
  }

  addCardsToHand(cards: WhiteCard[]) {
    for (const card of cards) {
      this._hand.set(card.id, card);
    }
    this.events.cardsDealt(this.id, cards);
  }

  removeCardsFromHand(cards: WhiteCard[]) {
    for (const card of cards) {
      this._hand.delete(card.id);
    }
    this.events.handReplaced(this.id, [...this._hand.values()]);
  }

  replaceHand(cards: WhiteCard[]) {
    this._hand = new Map(cards.map((card) => [card.id, card]));
    this.events.handReplaced(this.id, [...this._hand.values()]);
  }

  /** Empties the hand at the end of a game, without notifying the player. */
  clearHand() {
    this._hand.clear();
    this.newHandsUsed = 0;
  }
}
