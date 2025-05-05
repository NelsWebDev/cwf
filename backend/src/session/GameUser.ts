import { game, ioServer, socketManager, } from "../singletons";
import { RoundStatus, User, WhiteCard } from "../types";

export class GameUser {
    readonly id: string;
    private _username: string;
    private _isActive: boolean = false;
    private _timemoutDestroy?: NodeJS.Timeout|undefined;
    private _hand: Map<string, WhiteCard> = new Map();

    constructor(username: string) {
        this.id = crypto.randomUUID();
        this._username = username;
        this.isActive = false;
        if(game.started) {
            const cards = game.drawWhiteCards(10);
            this._hand = new Map(cards.map((card) => [card.id, card]));
        }
    }

    get username() {
        return this._username;
    }

    set isActive(isActive: boolean) {
        // nothing has changed
        if(this._isActive === isActive) {
            return;
        }

        this._isActive = isActive;
        if(isActive) {
            if(this._timemoutDestroy) {
                clearTimeout(this._timemoutDestroy);
                this._timemoutDestroy = undefined;
            }
        } 
        else {
            console.log(`User ${this.username} is inactive`);

            if(socketManager.activeUsers.length < 3 && game?.started) {
                ioServer.emit("holdGame");
            }

            this._timemoutDestroy = setTimeout(() => {
                this._timemoutDestroy = undefined;
                console.log(`User ${this.username} deleted due to inactivity`);
                socketManager.gameUsers.delete(this.id);
            }, 1_000 * 30);
        }
    }

    get isActive() {
        return this._isActive;
    }

    async fetchSockets() {
        return this.room.fetchSockets();
    }

    async disconnect() {
        const sockets = await this.fetchSockets();
        for (const socket of sockets) {
            socket.disconnect();
        }
    }

    async kick() {
        const sockets = await this.fetchSockets();
        for (const socket of sockets) {
            socket.disconnect();
        }
    }

    valueOf() {
        return this.id;
    }

    toJSON() : User {
        return {
            id: this.id,
            username: this.username,
            isActive: this.isActive,
            points: game.getPoints(this.id),
            isCardCzar: game.currentCardCzar?.id === this.id,
        }
    }
    removeWhiteCardsFromHand(whiteCards: WhiteCard[]) : WhiteCard[];
    removeWhiteCardsFromHand(whiteCardIds: string[]) : WhiteCard[];
    removeWhiteCardsFromHand(whiteCards: string[]|WhiteCard[]) {
        if(whiteCards.length === 0) {
            return Array.from(this.hand.values());
        }
        if(typeof whiteCards[0] === "string") {
            for (const whiteCardId of whiteCards as string[]) {
                this._hand.delete(whiteCardId);
            }
        }
        else {
            for (const whiteCard of whiteCards as WhiteCard[]) {
                this._hand.delete(whiteCard.id);
            }
        }
        this.room.emit("myHand", Array.from(this.hand.values()));
        return Array.from(this.hand.values());
    }

    playWhiteCards(whiteCards: WhiteCard[]) {
       return game.currentRound?.playWhiteCards(this.id, whiteCards);
    }

    undoPlay() {
       return game._currentRound?.undoPlay(this.id);
    }

    selectWinner(winnerId: string) {
        if(game.currentRound.cardCzar.id !== this.id) {
            throw new Error("You are not the card czar");
        }
        return game.currentRound?.selectWinner(winnerId);
    }

    
    get room() {
        return ioServer.to(this.id);
    }

    get hand() {
        return this._hand;
    }
    addCardsToHand(whiteCards: WhiteCard[]) {
        for (const whiteCard of whiteCards) {
            this._hand.set(whiteCard.id, whiteCard);
        }
        this.room.emit("givenCards", whiteCards);
    }
    async emitMyHand() {
        this.room.emit("myHand", Array.from(this.hand.values()));
    }
    clearHand() {
        this._hand.clear();
    }
}
