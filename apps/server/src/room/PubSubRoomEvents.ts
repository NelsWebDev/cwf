import type { CardDeck, Game, Rules, User, WhiteCard } from "@repo/shared/types";
import type { RoomEvents } from "../game/contracts";
import { publishToRoom, publishToUser } from "../pubsub";

/** Delivers a room's events to its members' GraphQL subscriptions. */
export class PubSubRoomEvents implements RoomEvents {
  constructor(private readonly roomId: string) {}

  gameChanged(game: Game) {
    publishToRoom(this.roomId, "game", game);
  }

  decksChanged(decks: CardDeck[]) {
    publishToRoom(this.roomId, "decks", decks);
  }

  rulesChanged(rules: Rules) {
    publishToRoom(this.roomId, "rules", rules);
  }

  winnerSelected(winnerId: string) {
    publishToRoom(this.roomId, "winnerSelected", winnerId);
  }

  gameEnded(winnerName: string) {
    publishToRoom(this.roomId, "gameEnded", winnerName);
  }

  gameOnHold() {
    publishToRoom(this.roomId, "holdGame", true);
  }

  closeModal() {
    publishToRoom(this.roomId, "closeModal", true);
  }

  playerJoined(player: User) {
    publishToRoom(this.roomId, "playerJoined", player);
  }

  playerLeft(userId: string) {
    publishToRoom(this.roomId, "playerLeft", userId);
  }

  profileChanged(userId: string, profile: User) {
    publishToUser(userId, "myProfile", profile);
  }

  handReplaced(userId: string, hand: WhiteCard[]) {
    publishToUser(userId, "myHand", hand);
  }

  cardsDealt(userId: string, cards: WhiteCard[]) {
    publishToUser(userId, "givenCards", cards);
  }
}
