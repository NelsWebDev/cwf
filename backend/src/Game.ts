import { GameRound } from "./GameRound";
import { GameUser } from "./session/GameUser";
import { ioServer, prismaClient, socketManager } from "./singletons";
import {
  BlackCard,
  CardDeck,
  CardState,
  DEFAULT_RULES,
  Rules,
  WhiteCard,
  Game as TGame,
} from "./types";
import { CardManager } from "./CardManager";

export class Game {
  started: boolean = false;
  rules: Rules = { ...DEFAULT_RULES };
  _blackCards: BlackCard[] = [];
  _whiteCards: WhiteCard[] = [];
  _currentCzar?: GameUser | undefined;
  _points: Map<string, number> = new Map();
  addedDecks: CardDeck[] = [];
  _currentRound?: GameRound | undefined;

  async addDeck(deckId: string) {
    if (this.addedDecks.some((d) => d.id === deckId)) {
      return;
    }
    if (this.started) {
      throw new Error("Game already started");
    }
    const deck = await CardManager.fetchDeck({ id: deckId });
    if (!deck) {
      throw new Error("Deck not found");
    }
    this.addedDecks.push(deck);
    ioServer.emit("decks", this.addedDecks);
  }
  removeDeck(deckId: string) {
    if (this.started) {
      throw new Error("Game already started");
    }
    const index = this.addedDecks.findIndex((d) => d.id === deckId);
    if (index === -1) {
      return;
    }
    this.addedDecks.splice(index, 1);
    ioServer.emit("decks", this.addedDecks);
  }
  updateRules(rules: Partial<Rules>) {
    if (this.started) {
      throw new Error("Game already started");
    }
    this.rules = { ...this.rules, ...rules };
    ioServer.emit("rules", this.rules);
  }

  async start() {
    if (this.started) {
      throw new Error("Game has already started");
    }
    if (socketManager.activeUsers.length < 3) {
      throw new Error("Not enough players");
    }

    const { blackCards, whiteCards } = await this.fetchCards();
    this._blackCards = blackCards;
    this._whiteCards = whiteCards;

    const minBlackCards = this.players.length * this.rules.pointsToWin - 1;
    const minWhiteCards =
      this.players.length * this.rules.pointsToWin -
      1 +
      this.players.length * 10;
    if (blackCards.length < minBlackCards) {
      throw new Error("Not enough black cards");
    }
    if (whiteCards.length < minWhiteCards) {
      throw new Error("Not enough white cards");
    }

    this._whiteCards.push(
      ...CardManager.makeBlankWhiteCards(this.rules.numberOfCustomCards),
    );
    this.shuffleBlackCards();
    this.shuffleWhiteCards();

    const cardsForPlayers = this.drawWhiteCards(this.players.length * 10);
    this.players.forEach((player) => {
      const cards = cardsForPlayers.splice(0, 10);
      const socket = socketManager.activeUsers.find((s) => s.id === player.id);
      if (socket) {
        cards.forEach((card) => (card.state = CardState.IN_USE));
        socket.addCardsToHand(cards);
        return;
      }
    });

    this.started = true;
    const blackCard = this.drawBlackCard();
    this.moveToNextCzar();
    this._currentRound = new GameRound(blackCard, this.currentCardCzar);
    ioServer.emit("game", this.toJSON());
  }

  endGame() {
    const winningPlayer = this.winningPlayer();
    this._currentCzar = undefined;
    this._points.clear();
    this._whiteCards = [];
    this._blackCards = [];
    this.started = false;
    this._currentRound = undefined;
    socketManager.gameUsers.forEach((user) => {
      user.clearHand();
    });
    ioServer.emit("gameEnded", winningPlayer?.username || "");
    ioServer.emit("game", this.toJSON());
  }

  winningPlayer() {
    const highScore = Math.max(...Array.from(this._points.values()));
    const winner = Array.from(this._points.entries()).find(
      ([, points]) => points === highScore,
    );
    if (!winner) {
      return undefined;
    }
    const user = socketManager.gameUsers.get(winner[0]);
    if (!user) {
      return undefined;
    }
    return user;
  }

  shuffleBlackCards() {
    const cardsToReset = this._blackCards.filter(
      (card) =>
        card.state === CardState.AVAILABLE ||
        card.state === CardState.PLAYED_PREVIOUSLY,
    );
    cardsToReset.forEach((card) => (card.state = CardState.AVAILABLE));
    this._blackCards = this._blackCards.sort(() => Math.random() - 0.5);
  }

  shuffleWhiteCards() {
    const cardsToReset = this._whiteCards.filter(
      (card) =>
        card.state === CardState.AVAILABLE ||
        (card.state === CardState.PLAYED_PREVIOUSLY && !card.isCustom),
    );
    cardsToReset.forEach((card) => (card.state = CardState.AVAILABLE));
    this._whiteCards = this._whiteCards.sort(() => Math.random() - 0.5);
  }

  private async fetchCards() {
    const addedDeckIds = this.addedDecks.map((deck) => deck.id);
    const [blackCards, whiteCards] = await Promise.all([
      prismaClient.blackCard
        .findMany({
          where: {
            deckId: {
              in: addedDeckIds,
            },
            ...(this.rules.allowMultipleAnswerBlackCards ? {} : { pick: 1 }),
          },
          orderBy: {
            createdAt: "asc",
          },
        })
        .then((cards) =>
          cards.map<BlackCard>((card) => ({
            ...card,
            state: CardState.AVAILABLE,
          })),
        ),
      prismaClient.whiteCard
        .findMany({
          where: {
            deckId: {
              in: addedDeckIds,
            },
          },
        })
        .then((cards) =>
          cards.map<WhiteCard>((card) => ({
            ...card,
            state: CardState.AVAILABLE,
            isCustom: false,
          })),
        ),
    ]);
    return { blackCards, whiteCards };
  }

  get players() {
    return [...socketManager.activeUsers.map((user) => user.toJSON())];
  }

  getPoints(userId: string) {
    return this._points.get(userId) || 0;
  }

  get currentCardCzar(): GameUser {
    return this._currentCzar;
  }

  get currentRound(): GameRound | undefined {
    return this._currentRound;
  }
  toJSON(): TGame {
    return {
      started: this.started,
      rules: this.rules,
      decks: this.addedDecks,
      currentRound: this._currentRound?.toJSON(),
      players: socketManager.activeUsers.map((user) => user.toJSON()),
    };
  }

  getNextCzar() {
    if (socketManager.activeUsers.length === 0) {
      throw new Error("No players");
    }
    if (!this._currentCzar) {
      const randomId = Math.floor(
        Math.random() * socketManager.activeUsers.length,
      );
      return socketManager.activeUsers[randomId];
    }

    const indexOfCurrentCzar = socketManager.activeUsers.findIndex(
      (user) => user.id === this._currentCzar?.id,
    );
    if (indexOfCurrentCzar === -1) {
      return socketManager.activeUsers[0];
    }

    const nextCzarIndex =
      (indexOfCurrentCzar + 1) % socketManager.activeUsers.length;
    const czar = socketManager.activeUsers[nextCzarIndex];
    if (!czar) {
      throw new Error("No players");
    }
    return czar;
  }
  moveToNextCzar() {
    this._currentCzar = this.getNextCzar();
  }

  drawBlackCard() {
    const card = this._blackCards.find(
      (card) => card.state === CardState.AVAILABLE,
    );
    card.state = CardState.IN_USE;
    return card;
  }

  drawWhiteCards(number: number) {
    const cardsToReturn: WhiteCard[] = [];
    if (this.availableWhiteCards.length < number) {
      const moreNeededCards = number - this.availableWhiteCards.length;

      this.availableWhiteCards.forEach((card) => {
        card.state = CardState.IN_USE;
      });

      cardsToReturn.push(...this.availableWhiteCards);
      this.shuffleWhiteCards();

      try {
        this.shuffleWhiteCards();
        const availableCards2 = this.availableWhiteCards;
        if (availableCards2.length < moreNeededCards) {
          throw new Error("Not enough cards");
        }
      } catch (err) {
        console.error(err);
        cardsToReturn.forEach((card) => (card.state = CardState.AVAILABLE));
        throw err;
      }
    } else {
      cardsToReturn.push(...this.availableWhiteCards.slice(0, number));
    }

    cardsToReturn.forEach((card) => {
      card.state = CardState.IN_USE;
    });
    return cardsToReturn;
  }

  get availableWhiteCards() {
    return [
      ...this._whiteCards.filter((card) => card.state === CardState.AVAILABLE),
    ];
  }

  skipBlackCard() {
    const currentRound = this._currentRound;
    currentRound.blackCard.state = CardState.SKIPPED;
    const cardCzar = currentRound.cardCzar;
    const blackCard = this.drawBlackCard();
    for (const [userId, cards] of Object.entries(currentRound.plays)) {
      for (const card of cards) {
        if (card.isCustom) {
          card.text = "";
        }
      }
      socketManager.gameUsers.get(userId)?.addCardsToHand(cards);
    }

    this._currentRound = new GameRound(blackCard, cardCzar);
    ioServer.emit("game", this.toJSON());
  }

  nextRound() {
    if (!this.started) return;
    const currentRound = this._currentRound;
    const pick = currentRound.blackCard.pick;
    const cardsToAdd: [GameUser, WhiteCard[]][] = socketManager.activeUsers
      .filter((u) => u.id !== currentRound.cardCzar.id)
      .map((user) => [user, this.drawWhiteCards(pick)]);

    cardsToAdd.forEach(([user, cards]) => {
      user.addCardsToHand(cards);
    });

    this.moveToNextCzar();
    const blackCard = this.drawBlackCard();
    this._currentRound = new GameRound(blackCard, this.currentCardCzar);
    ioServer.emit("game", this.toJSON());
  }

  emitJSON() {
    ioServer.emit("game", this.toJSON());
  }
}
