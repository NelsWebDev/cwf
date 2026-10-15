import { CardState, type BlackCard, type WhiteCard } from "@repo/shared/types";
import { shuffle } from "./shuffle";

export const makeBlankWhiteCards = (count: number): WhiteCard[] =>
  Array.from({ length: count }, () => ({
    id: crypto.randomUUID(),
    deckIds: [],
    text: "",
    state: CardState.AVAILABLE,
    createdAt: new Date(),
    updatedAt: new Date(),
    isCustom: true,
  }));

/** The prompts of a game. Draws the next unused card, reshuffling the discards once the pile runs out. */
export class BlackCardPile {
  private cards: BlackCard[];

  constructor(cards: BlackCard[] = []) {
    this.cards = cards;
    this.shuffle();
  }

  get size() {
    return this.cards.length;
  }

  draw(): BlackCard {
    let card = this.nextAvailable();
    if (!card) {
      this.shuffle();
      card = this.nextAvailable();
    }
    if (!card) {
      throw new Error("No black cards left to draw");
    }
    card.state = CardState.IN_USE;
    return card;
  }

  /** Makes every card that is not currently on the table drawable again, in a new order. */
  private shuffle() {
    this.cards
      .filter((card) => card.state !== CardState.IN_USE)
      .forEach((card) => (card.state = CardState.AVAILABLE));
    shuffle(this.cards);
  }

  private nextAvailable() {
    return this.cards.find((card) => card.state === CardState.AVAILABLE);
  }
}

export type WhiteCardPileOptions = {
  /** Total number of cards the game needs to be able to deal. */
  size: number;
  /** How many blank, player-written cards to mix into the pile. */
  customCards: number;
};

/** The answers of a game. Hands out cards and recycles used ones when it would otherwise run dry. */
export class WhiteCardPile {
  private cards: WhiteCard[];

  constructor(cards: WhiteCard[] = []) {
    this.cards = cards;
  }

  /**
   * Builds a shuffled pile of `size` cards with the blank custom cards spread among the ones
   * that will be dealt first; any surplus cards are kept at the bottom as a reserve.
   */
  static assemble(deckCards: WhiteCard[], { size, customCards }: WhiteCardPileOptions): WhiteCardPile {
    shuffle(deckCards);
    const splitAt = size - customCards;
    const top = shuffle([...deckCards.slice(0, splitAt), ...makeBlankWhiteCards(customCards)]);
    const cards = [...top, ...deckCards.slice(splitAt)].map((card) => ({
      ...card,
      state: CardState.AVAILABLE,
    }));

    if (cards.length < size) {
      throw new Error(`Need ${size} white cards but only got ${cards.length}`);
    }
    return new WhiteCardPile(cards);
  }

  get size() {
    return this.cards.length;
  }

  get available() {
    return this.cards.filter((card) => card.state === CardState.AVAILABLE);
  }

  /**
   * Takes `count` cards out of the pile and marks them in use. If the pile runs dry, discarded
   * cards are recycled to make up the difference; nothing is taken if there still aren't enough.
   */
  draw(count: number): WhiteCard[] {
    const drawn = this.available.slice(0, count);
    drawn.forEach((card) => (card.state = CardState.IN_USE));

    const missing = count - drawn.length;
    if (missing > 0) {
      this.recycle();
      const extra = this.available.slice(0, missing);
      if (extra.length < missing) {
        drawn.forEach((card) => (card.state = CardState.AVAILABLE));
        throw new Error("Not enough cards");
      }
      extra.forEach((card) => (card.state = CardState.IN_USE));
      drawn.push(...extra);
    }
    return drawn;
  }

  /** Returns discarded cards to the pile. Custom cards are one-offs and are never reused. */
  recycle() {
    this.cards
      .filter((card) => card.state === CardState.PLAYED_PREVIOUSLY && !card.isCustom)
      .forEach((card) => (card.state = CardState.AVAILABLE));
    shuffle(this.cards);
  }
}
