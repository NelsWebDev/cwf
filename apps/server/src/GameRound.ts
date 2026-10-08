import { GameUser } from "./session/GameUser";
import { game, socketManager } from "./singletons";
import { publish } from "./pubsub";
import {
  BlackCard,
  GameRound as TGameGround,
  WhiteCard,
  RoundStatus,
  CardState,
} from "@repo/shared/types";

export class GameRound implements TGameGround {
  public readonly id: string;
  status: RoundStatus = RoundStatus.WAITING_FOR_PLAYERS;
  winnerId?: string;
  sharedToDiscord = false;
  _plays: Map<string, WhiteCard[]> = new Map();
  _votesToSkip: Map<string, boolean> = new Map();
  _sittingOut: Set<string> = new Set();
  constructor(
    public readonly blackCard: BlackCard,
    public readonly cardCzar: GameUser,
  ) {
    this.id = crypto.randomUUID();
  }
  get plays() {
    return Object.fromEntries(this._plays.entries());
  }

  get sittingOut() {
    return [...this._sittingOut];
  }

  /** Active, non-czar players who are expected to submit cards this round. */
  get expectedPlayers() {
    return socketManager.activeUsers.filter(
      (u) => u.id !== this.cardCzar.id && !this._sittingOut.has(u.id),
    );
  }

  get votesToSkip() {
    return Object.fromEntries(this._votesToSkip.entries());
  }

  playWhiteCards(userId: string, whiteCards: WhiteCard[]) {
    const user: GameUser | undefined = socketManager.gameUsers.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    if (user.id === this.cardCzar.id) {
      throw new Error("Card czar cannot play");
    }
    if (this.status !== RoundStatus.WAITING_FOR_PLAYERS) {
      throw new Error("Cannot play in this phase");
    }
    if (this._sittingOut.has(userId)) {
      throw new Error("You are sitting out this round");
    }

    if (this._plays.has(userId)) {
      throw new Error("User already played");
    }

    const cards = whiteCards.map((playedCard) => {
      if (!user.hand.has(playedCard.id)) {
        throw new Error("User does not have this card");
      }
      const card = user.hand.get(playedCard.id);
      if (card?.isCustom) {
        card.text = playedCard.text;
      }
      return card as any as WhiteCard;
    });

    this._plays.set(userId, cards || []);
    user.removeWhiteCardsFromHand(cards);
    this.revealWhenAllPlayed();
    game.emitJSON();
  }

  private revealWhenAllPlayed() {
    if (this._plays.size !== this.expectedPlayers.length) return;
    // Give players time to undo, then randomize submissions before revealing them.
    const UNDO_TIMEOUT = 5_000;

    setTimeout(() => {
      if (
        this.status === RoundStatus.WAITING_FOR_PLAYERS &&
        this._plays.size === this.expectedPlayers.length
      ) {
        this.shufflePlays();
        this.status = RoundStatus.SELECTING_WINNER;
        game.emitJSON();
      }
    }, UNDO_TIMEOUT);
  }

  assertCanSitOut(userId: string) {
    if (!socketManager.gameUsers.has(userId)) {
      throw new Error("User not found");
    }
    if (userId === this.cardCzar.id) {
      throw new Error("Card czar cannot sit out");
    }
    if (this.status !== RoundStatus.WAITING_FOR_PLAYERS) {
      throw new Error("Cannot sit out in this phase");
    }
    if (this._sittingOut.has(userId)) {
      throw new Error("Already sitting out");
    }
    if (this._plays.has(userId)) {
      throw new Error("Undo your play before sitting out");
    }
  }

  /**
   * Removes the player from this round. If only one player is left to play,
   * they win the round automatically.
   */
  sitOut(userId: string) {
    this.assertCanSitOut(userId);
    this._sittingOut.add(userId);
    this._votesToSkip.delete(userId);

    const remaining = this.expectedPlayers;
    if (remaining.length === 1) {
      this.awardWin(remaining[0].id);
    } else {
      this.revealWhenAllPlayed();
    }
    game.emitJSON();
  }

  undoPlay(userId: string) {
    const user: GameUser | undefined = socketManager.gameUsers.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    if (user.id === this.cardCzar.id) {
      throw new Error("Card czar cannot play");
    }
    if (this.status !== RoundStatus.WAITING_FOR_PLAYERS) {
      throw new Error("Cannot undo play in this phase");
    }
    this.returnPlayersWhiteCards(userId);
    game.emitJSON();
  }
  returnPlayersWhiteCards(userId: string) {
    const user = socketManager.gameUsers.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    const whiteCards = this.plays[userId];
    if (!whiteCards) {
      return;
    }
    this._plays.delete(userId);
    whiteCards.forEach((w) => {
      if (w.isCustom) {
        w.text = "";
      }
    });
    user.addCardsToHand(whiteCards);
  }

  selectWinner(cardId: string) {
    const userId = Array.from(this._plays.entries()).find(
      ([, cards]) => cards.some((card) => card.id === cardId),
    )?.[0];
    if (!userId) {
      throw new Error("Card not found");
    }

    if (this.status !== RoundStatus.SELECTING_WINNER) {
      throw new Error("Not in selecting winner phase");
    }

    const user = socketManager.gameUsers.get(userId);

    if (!user?.isActive) {
      throw new Error("User not found");
    }

    this.awardWin(userId);
  }

  private awardWin(userId: string) {
    const winnerPoints = game.getPoints(userId) + 1;

    game._points.set(userId, winnerPoints);
    console.log(`User ${userId} has ${winnerPoints} points`);

    this.winnerId = userId;
    this.status = RoundStatus.SHOWING_WINNER;
    publish("winnerSelected", this.winnerId);
    this.blackCard.state = CardState.PLAYED_PREVIOUSLY;

    // Wait before going on to next round so people can see the winner.
    setTimeout(() => {
      if (!game.started) return;
      const scores = Array.from(game._points.values()).sort((a, b) => b - a);
      const highScore = scores[0] ?? 0;
      const secondPlaceScore = scores[1] ?? 0;

      if (
        highScore >= game.rules.pointsToWin &&
        highScore - secondPlaceScore >= game.rules.pointsToWinBy
      ) {
        game.endGame();
        return; // <-- important: prevent going to nextRound
      }

      game.nextRound();
    }, 8_000);
  }

  get cardCzarId() {
    return this.cardCzar.id;
  }

  toJSON(): TGameGround {
    const { id, blackCard, cardCzarId, status, winnerId, votesToSkip, sittingOut } = this;
    return {
      id,
      blackCard,
      cardCzarId,
      status,
      winnerId,
      votesToSkip,
      sittingOut,
      plays: this.getJSONPlays(),
    };
  }

  /**
   * @returns Plays that are censored if the game is in WAITING_FOR_PLAYERS state, or real ones
   */
  private getJSONPlays(): Record<string, WhiteCard[]> {
    if (this.status === RoundStatus.WAITING_FOR_PLAYERS) {
      return Object.fromEntries(
        Object.keys(this.plays).map((userId) => [userId, []]),
      );
    }
    return this.plays;
  }

  voteToSkip(userId: string, vote: boolean) {
    if (this.status !== RoundStatus.WAITING_FOR_PLAYERS) {
      throw new Error("Cannot vote to skip in this phase");
    }
    if (userId === this.cardCzar.id) {
      throw new Error("Card czar cannot vote to skip");
    }
    if (this._sittingOut.has(userId)) {
      throw new Error("You are sitting out this round");
    }
    this._votesToSkip.set(userId, vote);

    const votes = [...this._votesToSkip.values()];
    const yesVotes = votes.filter((v) => v).length;
    const percentYes = yesVotes / this.expectedPlayers.length;

    console.log("vote recorded", percentYes);
    game.emitJSON();
    if (percentYes > 0.5) {
      game.skipBlackCard();
      console.log("skipping black card");
    }
  }

  /**
 * Randomizes the display/selection order of submitted plays.
 * Keeps each user's submitted set of cards together.
 */
  private shufflePlays() {
    const shuffledEntries = Array.from(this._plays.entries());

    // Fisher-Yates shuffle
    for (let i = shuffledEntries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledEntries[i], shuffledEntries[j]] = [
        shuffledEntries[j],
        shuffledEntries[i],
      ];
    }

    this._plays = new Map(shuffledEntries);
  }
}
