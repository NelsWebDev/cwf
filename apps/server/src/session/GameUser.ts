import { game, socketManager } from "../singletons";
import { publish, publishToUser } from "../pubsub";
import { User, WhiteCard } from "../types";

export class GameUser {
  readonly id: string;
  private _username: string;
  private _discordId?: string;
  private _isActive: boolean = false;
  private _timemoutDestroy?: NodeJS.Timeout | undefined;
  private _hand: Map<string, WhiteCard> = new Map();
  newHandsUsed = 0;

  constructor(username: string) {
    this.id = crypto.randomUUID();
    this._username = username;
    this.isActive = false;
    if (game.started) {
      const cards = game.drawWhiteCards(10);
      this._hand = new Map(cards.map((card) => [card.id, card]));
    }
  }

  get newHandsRemaining() {
    return Math.max(0, (game.rules?.newHandsPerGame ?? 0) - this.newHandsUsed);
  }

  get username() {
    return this._username;
  }

  rename(username: string) {
    this._username = username;
    publishToUser(this.id, "myProfile", this.toJSON());
    publish("playerJoined", this.toJSON());
  }

  get discordId() {
    return this._discordId;
  }

  setDiscordId(discordId: string | undefined) {
    this._discordId = discordId;
    publishToUser(this.id, "myProfile", this.toJSON());
  }

  set isActive(isActive: boolean) {
    // nothing has changed
    if (this._isActive === isActive) {
      return;
    }

    this._isActive = isActive;
    if (isActive) {
      if (this._timemoutDestroy) {
        clearTimeout(this._timemoutDestroy);
        this._timemoutDestroy = undefined;
      }
    } else {
      console.log(`User ${this.username} is inactive`);

      if (socketManager.activeUsers.length < 3 && game?.started) {
        publish("holdGame", true);
      }

      this._timemoutDestroy = setTimeout(() => {
        this._timemoutDestroy = undefined;
        console.log(`User ${this.username} deleted due to inactivity`);
        socketManager.gameUsers.delete(this.id);
        if (game.players.length < 3 && game.started) {
          game.endGame();
        }
      }, 1_000 * 30);
    }
  }

  get isActive() {
    return this._isActive;
  }

  kick() {
    socketManager.closeConnections(this.id);
  }

  valueOf() {
    return this.id;
  }

  toJSON(): User {
    return {
      id: this.id,
      username: this.username,
      isActive: this.isActive,
      points: game.getPoints(this.id),
      isCardCzar: game.currentCardCzar?.id === this.id,
      discordId: this.discordId ?? null,
      newHandsRemaining: this.newHandsRemaining,
    };
  }
  removeWhiteCardsFromHand(whiteCards: WhiteCard[]): WhiteCard[];
  removeWhiteCardsFromHand(whiteCardIds: string[]): WhiteCard[];
  removeWhiteCardsFromHand(whiteCards: string[] | WhiteCard[]) {
    if (whiteCards.length === 0) {
      return Array.from(this.hand.values());
    }
    if (typeof whiteCards[0] === "string") {
      for (const whiteCardId of whiteCards as string[]) {
        this._hand.delete(whiteCardId);
      }
    } else {
      for (const whiteCard of whiteCards as WhiteCard[]) {
        this._hand.delete(whiteCard.id);
      }
    }
    publishToUser(this.id, "myHand", Array.from(this.hand.values()));
    return Array.from(this.hand.values());
  }

  playWhiteCards(whiteCards: WhiteCard[]) {
    return game.currentRound?.playWhiteCards(this.id, whiteCards);
  }

  undoPlay() {
    return game._currentRound?.undoPlay(this.id);
  }

  selectWinner(winningCardId: string) {
    if (game.currentRound?.cardCzar.id !== this.id) {
      throw new Error("You are not the card czar");
    }
    return game.currentRound?.selectWinner(winningCardId);
  }

  get hand() {
    return this._hand;
  }
  addCardsToHand(whiteCards: WhiteCard[]) {
    for (const whiteCard of whiteCards) {
      this._hand.set(whiteCard.id, whiteCard);
    }
    publishToUser(this.id, "givenCards", whiteCards);
  }
  replaceHand(whiteCards: WhiteCard[]) {
    this._hand = new Map(whiteCards.map((card) => [card.id, card]));
    publishToUser(this.id, "myHand", Array.from(this._hand.values()));
  }
  clearHand() {
    this._hand.clear();
    this.newHandsUsed = 0;
  }
}
