import { GameUser } from "./session/GameUser";
import { game, ioServer, socketManager } from "./singletons";
import {
  BlackCard,
  CardState,
  RoundStatus,
  GameRound as TGameGround,
  WhiteCard,
} from "./types";
export class GameRound implements TGameGround {
  public readonly id: string;
  status: RoundStatus = RoundStatus.WAITING_FOR_PLAYERS;
  winnerId?: string;
  _plays: Map<string, WhiteCard[]> = new Map();
  _votesToSkip: Map<string, boolean> = new Map();
  constructor(
    public readonly blackCard: BlackCard,
    public readonly cardCzar: GameUser,
  ) {
    this.id = crypto.randomUUID();
  }
  get plays() {
    return Object.fromEntries(this._plays.entries());
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

    if (this._plays.has(userId)) {
      throw new Error("User already played");
    }

    const cards = whiteCards.map((playedCard) => {
      if (!user.hand.has(playedCard.id)) {
        throw new Error("User does not have this card");
      }
      const card = user.hand.get(playedCard.id);
      if (card.isCustom) {
        card.text = playedCard.text;
      }
      return card;
    });

    this._plays.set(userId, cards);
    user.removeWhiteCardsFromHand(cards);
    if (this._plays.size === socketManager.activeUsers.length - 1) {
      setTimeout(() => {
        if (this._plays.size === socketManager.activeUsers.length - 1) {
          this.status = RoundStatus.SELECTING_WINNER;
          game.emitJSON();
        }
      }, 5_000);
      // selecting winner time
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

    const winnerPoints = game.getPoints(userId) + 1;

    game._points.set(userId, winnerPoints);
    console.log(`User ${userId} has ${winnerPoints} points`);

    this.winnerId = userId;
    this.status = RoundStatus.SHOWING_WINNER;
    ioServer.emit("winnerSelected", this.winnerId);
    this.blackCard.state = CardState.PLAYED_PREVIOUSLY;

    setTimeout(() => {
      if (!game.started) return;
      const highScore = Math.max(...Array.from(game._points.values()));

      if (highScore >= game.rules.pointsToWin) {
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
    const { id, blackCard, cardCzarId, status, winnerId, votesToSkip } = this;
    return {
      id,
      blackCard,
      cardCzarId,
      status,
      winnerId,
      votesToSkip,
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
    this._votesToSkip.set(userId, vote);

    const votes = [...this._votesToSkip.values()];
    const yesVotes = votes.filter((v) => v).length;
    const percentYes = yesVotes / (socketManager.activeUsers.length - 1);

    console.log("vote recorded", percentYes);
    game.emitJSON();
    if (percentYes > 0.5) {
      game.skipBlackCard();
      console.log("skipping black card");
    }
  }
}
