import type { GameUser } from "../session/GameUser";
import {
  CardState,
  DEFAULT_RULES,
  type CardDeck,
  type Game as GameJSON,
  type Rules,
  type User,
  type WhiteCard,
} from "@repo/shared/types";
import { BlackCardPile, WhiteCardPile } from "./CardPiles";
import type { CardSource, GameEvents, Roster } from "./contracts";
import { pickNextCzar } from "./czar";
import { GameRound, type RoundObserver } from "./GameRound";
import { Scoreboard } from "./Scoreboard";

export const HAND_SIZE = 10;
export const MIN_PLAYERS = 3;
/** How long the winner stays on screen before the next round begins. */
const WINNER_DISPLAY_MS = 8_000;

export type GameDependencies = {
  roster: Roster;
  events: GameEvents;
  cards: CardSource;
};

/**
 * One game of Cards Against Humanity: its settings, the card piles, the score and the
 * sequence of rounds. It knows nothing about connections, GraphQL or the database; those
 * are reached through the injected roster, events and card source.
 */
export class Game {
  rules: Rules = { ...DEFAULT_RULES };
  decks: CardDeck[] = [];

  private readonly roster: Roster;
  private readonly events: GameEvents;
  private readonly cardSource: CardSource;

  private readonly scoreboard = new Scoreboard();
  private blackCards = new BlackCardPile();
  private whiteCards = new WhiteCardPile();
  private czar?: GameUser;
  private round?: GameRound;
  private starting = false;
  private nextRoundTimer?: NodeJS.Timeout;

  private readonly roundObserver: RoundObserver = {
    roundChanged: () => this.emitChange(),
    winnerAwarded: (winnerId) => this.onWinnerAwarded(winnerId),
    skipRequested: () => this.skipBlackCard(),
  };

  constructor({ roster, events, cards }: GameDependencies) {
    this.roster = roster;
    this.events = events;
    this.cardSource = cards;
  }

  get started() {
    return this.round !== undefined;
  }

  get currentRound() {
    return this.round;
  }

  get currentCardCzar() {
    return this.czar;
  }

  pointsOf(userId: string) {
    return this.scoreboard.pointsOf(userId);
  }

  // ---- Settings (only while no game is running) ----

  async addDeck(deckId: string) {
    if (this.decks.some((deck) => deck.id === deckId)) return;
    this.assertNotStarted();
    const deck = await this.cardSource.fetchDeck(deckId);
    if (!deck) {
      throw new Error("Deck not found");
    }
    this.decks.push(deck);
    this.events.decksChanged(this.decks);
  }

  removeDeck(deckId: string) {
    this.assertNotStarted();
    const index = this.decks.findIndex((deck) => deck.id === deckId);
    if (index === -1) return;
    this.decks.splice(index, 1);
    this.events.decksChanged(this.decks);
  }

  updateRules(changes: Partial<Rules>) {
    this.assertNotStarted();
    this.rules = { ...this.rules, ...changes };
    this.events.rulesChanged(this.rules);
  }

  // ---- Lifecycle ----

  async start() {
    if (this.started || this.starting) {
      throw new Error("Game has already started");
    }
    if (this.roster.activePlayers.length < MIN_PLAYERS) {
      throw new Error("Not enough players");
    }

    this.starting = true;
    try {
      await this.deal();
    } finally {
      this.starting = false;
    }
  }

  endGame() {
    const winner = this.roster.allPlayers.find((player) => player.id === this.scoreboard.leaderId);

    this.stopTimers();
    this.round = undefined;
    this.czar = undefined;
    this.scoreboard.clear();
    this.blackCards = new BlackCardPile();
    this.whiteCards = new WhiteCardPile();
    this.roster.allPlayers.forEach((player) => player.clearHand());

    this.events.gameEnded(winner?.username ?? "");
    this.emitChange();
  }

  /** Gives someone who joins a running game a hand of their own. */
  dealHandTo(player: GameUser) {
    if (!this.started) return;
    player.replaceHand(this.whiteCards.draw(HAND_SIZE));
  }

  // ---- Player actions ----

  playCards(player: GameUser, cards: WhiteCard[]) {
    this.requireRound().playWhiteCards(player, cards);
  }

  undoPlay(player: GameUser) {
    this.requireRound().undoPlay(player);
  }

  pickWinner(player: GameUser, cardId: string) {
    const round = this.requireRound();
    this.assertIsCzar(round, player);
    round.selectWinner(cardId);
  }

  voteToSkip(player: GameUser, vote: boolean) {
    this.requireRound().voteToSkip(player, vote);
  }

  skipBlackCardAsCzar(player: GameUser) {
    this.assertIsCzar(this.requireRound(), player);
    this.skipBlackCard();
  }

  /**
   * Swaps a player's whole hand for new cards in exchange for sitting out the
   * current round. Limited to `rules.newHandsPerGame` per player per game (0 disables it).
   */
  requestNewHand(player: GameUser) {
    const round = this.requireRound();
    round.assertCanSitOut(player);
    if (this.newHandsRemaining(player) <= 0) {
      throw new Error("No new hands remaining");
    }

    // Draw first so a failure leaves the player's hand untouched.
    const newCards = this.whiteCards.draw(HAND_SIZE);
    player.hand.forEach((card) => {
      if (card.isCustom) card.text = "";
      card.state = CardState.PLAYED_PREVIOUSLY;
    });
    player.replaceHand(newCards);
    player.newHandsUsed++;
    round.sitOut(player);
  }

  /** Throws away the current black card, returns everyone's submissions and starts a fresh round. */
  skipBlackCard({ replaceCzar = false } = {}) {
    const round = this.requireRound();
    round.blackCard.state = CardState.SKIPPED;
    const czar = replaceCzar ? pickNextCzar(this.roster.activePlayers, this.czar) : round.cardCzar;
    const blackCard = this.blackCards.draw();
    round.returnAllPlays();
    this.beginRound(czar, blackCard);
  }

  // ---- Views ----

  newHandsRemaining(player: GameUser) {
    return Math.max(0, this.rules.newHandsPerGame - player.newHandsUsed);
  }

  describePlayer(player: GameUser): User {
    return {
      id: player.id,
      username: player.username,
      isActive: player.isActive,
      points: this.pointsOf(player.id),
      isCardCzar: this.czar?.id === player.id,
      discordName: player.discordName ?? null,
      newHandsRemaining: this.newHandsRemaining(player),
    };
  }

  toJSON(): GameJSON {
    return {
      started: this.started,
      rules: this.rules,
      decks: this.decks,
      currentRound: this.round?.toJSON(),
      players: this.roster.activePlayers.map((player) => this.describePlayer(player)),
    };
  }

  // ---- Internals ----

  private async deal() {
    const players = this.roster.activePlayers;
    const { blackCards, whiteCards } = await this.cardSource.fetchCards({
      deckIds: this.decks.map((deck) => deck.id),
      singleAnswerOnly: !this.rules.allowMultipleAnswerBlackCards,
    });

    const { pointsToWin, numberOfCustomCards } = this.rules;
    const roundsAtMost = players.length * (pointsToWin - 1) + 1;
    if (blackCards.length < roundsAtMost) {
      throw new Error("Not enough black cards");
    }
    // Every player's opening hand, plus what each non-czar draws to replace their played cards.
    const whiteCardsNeeded = HAND_SIZE * players.length + roundsAtMost * (players.length - 1);

    // Everything is validated before any state changes, so a failure leaves the game as it was.
    const whitePile = WhiteCardPile.assemble(whiteCards, {
      size: whiteCardsNeeded,
      customCards: numberOfCustomCards,
    });
    this.blackCards = new BlackCardPile(blackCards);
    this.whiteCards = whitePile;

    players.forEach((player) => player.addCardsToHand(this.whiteCards.draw(HAND_SIZE)));

    const blackCard = this.blackCards.draw();
    this.beginRound(pickNextCzar(players, this.czar), blackCard);
  }

  private nextRound() {
    const round = this.requireRound();
    const dealt = round.expectedPlayers.map((player) => ({
      player,
      cards: this.whiteCards.draw(round.blackCard.pick),
    }));
    dealt.forEach(({ player, cards }) => player.addCardsToHand(cards));

    const czar = pickNextCzar(this.roster.activePlayers, this.czar);
    this.beginRound(czar, this.blackCards.draw());
  }

  private beginRound(czar: GameUser, blackCard: GameRound["blackCard"]) {
    this.stopTimers();
    this.czar = czar;
    this.round = new GameRound(blackCard, czar, this.roster, this.roundObserver);
    this.emitChange();
  }

  private onWinnerAwarded(winnerId: string) {
    this.scoreboard.award(winnerId);
    this.events.winnerSelected(winnerId);

    // Leave the winner on screen for a while before moving on.
    this.nextRoundTimer = setTimeout(() => {
      this.nextRoundTimer = undefined;
      if (!this.started) return;
      if (this.scoreboard.hasWinner(this.rules)) {
        this.endGame();
      } else {
        this.nextRound();
      }
    }, WINNER_DISPLAY_MS);
  }

  private stopTimers() {
    clearTimeout(this.nextRoundTimer);
    this.nextRoundTimer = undefined;
    this.round?.dispose();
  }

  private emitChange() {
    this.events.gameChanged(this.toJSON());
  }

  private requireRound() {
    if (!this.round) {
      throw new Error("Game has not started");
    }
    return this.round;
  }

  private assertNotStarted() {
    if (this.started) {
      throw new Error("Game already started");
    }
  }

  private assertIsCzar(round: GameRound, player: GameUser) {
    if (round.cardCzar.id !== player.id) {
      throw new Error("You are not the card czar");
    }
  }
}
