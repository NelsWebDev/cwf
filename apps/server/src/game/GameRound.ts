import type { GameUser } from "../session/GameUser";
import {
  CardState,
  RoundStatus,
  type BlackCard,
  type GameRound as GameRoundJSON,
  type WhiteCard,
} from "@repo/shared/types";
import type { Roster } from "./contracts";
import { shuffle } from "./shuffle";

/** How long players get to undo before the last submission is revealed. */
const UNDO_WINDOW_MS = 5_000;

/** Notified about the things a round cannot decide on its own. */
export interface RoundObserver {
  roundChanged(): void;
  winnerAwarded(winnerId: string): void;
  skipRequested(): void;
}

/** A single black card being played out: submissions, then picking a winner. */
export class GameRound {
  readonly id = crypto.randomUUID();
  status = RoundStatus.WAITING_FOR_PLAYERS;
  winnerId?: string;
  sharedToDiscord = false;

  private submissions = new Map<string, WhiteCard[]>();
  private skipVotes = new Map<string, boolean>();
  private sittingOutIds = new Set<string>();
  private revealTimer?: NodeJS.Timeout;

  constructor(
    readonly blackCard: BlackCard,
    readonly cardCzar: GameUser,
    private readonly roster: Roster,
    private readonly observer: RoundObserver,
  ) {}

  get cardCzarId() {
    return this.cardCzar.id;
  }

  get plays(): Record<string, WhiteCard[]> {
    return Object.fromEntries(this.submissions);
  }

  get votesToSkip(): Record<string, boolean> {
    return Object.fromEntries(this.skipVotes);
  }

  get sittingOut() {
    return [...this.sittingOutIds];
  }

  /** Active, non-czar players who are expected to submit cards this round. */
  get expectedPlayers() {
    return this.roster.activePlayers.filter(
      (player) => player.id !== this.cardCzar.id && !this.sittingOutIds.has(player.id),
    );
  }

  playWhiteCards(player: GameUser, played: WhiteCard[]) {
    this.assertCanSubmit(player, "play");
    if (this.sittingOutIds.has(player.id)) {
      throw new Error("You are sitting out this round");
    }
    if (this.submissions.has(player.id)) {
      throw new Error("User already played");
    }

    const cards = played.map((playedCard) => {
      const card = player.hand.get(playedCard.id);
      if (!card) {
        throw new Error("User does not have this card");
      }
      if (card.isCustom) {
        card.text = playedCard.text;
      }
      return card;
    });

    this.submissions.set(player.id, cards);
    player.removeCardsFromHand(cards);
    this.revealWhenAllPlayed();
    this.observer.roundChanged();
  }

  undoPlay(player: GameUser) {
    this.assertCanSubmit(player, "undo play");
    const cards = this.submissions.get(player.id);
    if (cards) {
      this.submissions.delete(player.id);
      player.addCardsToHand(blankCustomCards(cards));
    }
    this.observer.roundChanged();
  }

  assertCanSitOut(player: GameUser) {
    if (player.id === this.cardCzar.id) {
      throw new Error("Card czar cannot sit out");
    }
    if (this.status !== RoundStatus.WAITING_FOR_PLAYERS) {
      throw new Error("Cannot sit out in this phase");
    }
    if (this.sittingOutIds.has(player.id)) {
      throw new Error("Already sitting out");
    }
    if (this.submissions.has(player.id)) {
      throw new Error("Undo your play before sitting out");
    }
  }

  /** Removes the player from this round. If only one player is left to play, they win it. */
  sitOut(player: GameUser) {
    this.assertCanSitOut(player);
    this.sittingOutIds.add(player.id);
    this.skipVotes.delete(player.id);

    const remaining = this.expectedPlayers;
    if (remaining.length === 1) {
      this.awardWin(remaining[0]!.id);
    } else {
      this.revealWhenAllPlayed();
    }
    this.observer.roundChanged();
  }

  voteToSkip(player: GameUser, vote: boolean) {
    if (this.status !== RoundStatus.WAITING_FOR_PLAYERS) {
      throw new Error("Cannot vote to skip in this phase");
    }
    if (player.id === this.cardCzar.id) {
      throw new Error("Card czar cannot vote to skip");
    }
    if (this.sittingOutIds.has(player.id)) {
      throw new Error("You are sitting out this round");
    }
    this.skipVotes.set(player.id, vote);

    const yesVotes = [...this.skipVotes.values()].filter(Boolean).length;
    this.observer.roundChanged();
    if (yesVotes / this.expectedPlayers.length > 0.5) {
      this.observer.skipRequested();
    }
  }

  selectWinner(cardId: string) {
    const winnerId = [...this.submissions].find(([, cards]) =>
      cards.some((card) => card.id === cardId),
    )?.[0];
    if (!winnerId) {
      throw new Error("Card not found");
    }
    if (this.status !== RoundStatus.SELECTING_WINNER) {
      throw new Error("Not in selecting winner phase");
    }
    if (!this.roster.findPlayer(winnerId)?.isActive) {
      throw new Error("User not found");
    }
    this.awardWin(winnerId);
  }

  /** Hands every submission back to its player, e.g. because the round is being skipped. */
  returnAllPlays() {
    for (const [userId, cards] of this.submissions) {
      this.roster.findPlayer(userId)?.addCardsToHand(blankCustomCards(cards));
    }
    this.submissions.clear();
  }

  /** Stops anything scheduled by this round; call when the round is replaced. */
  dispose() {
    clearTimeout(this.revealTimer);
    this.revealTimer = undefined;
  }

  toJSON(): GameRoundJSON {
    return {
      id: this.id,
      blackCard: this.blackCard,
      cardCzarId: this.cardCzarId,
      status: this.status,
      winnerId: this.winnerId,
      votesToSkip: this.votesToSkip,
      sittingOut: this.sittingOut,
      plays: this.visiblePlays(),
    };
  }

  private assertCanSubmit(player: GameUser, action: string) {
    if (player.id === this.cardCzar.id) {
      throw new Error("Card czar cannot play");
    }
    if (this.status !== RoundStatus.WAITING_FOR_PLAYERS) {
      throw new Error(`Cannot ${action} in this phase`);
    }
  }

  private awardWin(winnerId: string) {
    this.winnerId = winnerId;
    this.status = RoundStatus.SHOWING_WINNER;
    this.blackCard.state = CardState.PLAYED_PREVIOUSLY;
    this.observer.winnerAwarded(winnerId);
  }

  /** Once everyone has played, wait out the undo window and then shuffle and reveal the plays. */
  private revealWhenAllPlayed() {
    if (this.submissions.size !== this.expectedPlayers.length) return;

    clearTimeout(this.revealTimer);
    this.revealTimer = setTimeout(() => {
      this.revealTimer = undefined;
      if (
        this.status === RoundStatus.WAITING_FOR_PLAYERS &&
        this.submissions.size === this.expectedPlayers.length
      ) {
        this.submissions = new Map(shuffle([...this.submissions]));
        this.status = RoundStatus.SELECTING_WINNER;
        this.observer.roundChanged();
      }
    }, UNDO_WINDOW_MS);
  }

  /** Plays stay face-down (empty) until the czar starts choosing. */
  private visiblePlays(): Record<string, WhiteCard[]> {
    if (this.status === RoundStatus.WAITING_FOR_PLAYERS) {
      return Object.fromEntries([...this.submissions.keys()].map((userId) => [userId, []]));
    }
    return this.plays;
  }
}

/** Custom cards are written by the player, so their text is wiped once they go back to a hand. */
const blankCustomCards = (cards: WhiteCard[]) => {
  cards.forEach((card) => {
    if (card.isCustom) card.text = "";
  });
  return cards;
};
