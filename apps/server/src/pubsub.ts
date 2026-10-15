import { PubSub } from "graphql-subscriptions";
import type { CardDeck, Game, Rules, User, WhiteCard } from "@repo/shared/types";

/** Events broadcast to every member of a room. Keys match the GraphQL subscription field names. */
export type RoomTopics = {
  decks: CardDeck[];
  rules: Rules;
  game: Game;
  gameEnded: string;
  winnerSelected: string;
  closeModal: boolean;
  holdGame: boolean;
  playerJoined: User;
  playerLeft: string;
};

/** Events delivered to a single user. Keys match the GraphQL subscription field names. */
export type UserTopics = {
  myProfile: User;
  myHand: WhiteCard[];
  givenCards: WhiteCard[];
};

const pubsub = new PubSub();

const roomTopic = (roomId: string, name: keyof RoomTopics) => `room:${roomId}:${name}`;
const userTopic = (userId: string, name: keyof UserTopics) => `user:${userId}:${name}`;

export const publishToRoom = <K extends keyof RoomTopics>(roomId: string, name: K, payload: RoomTopics[K]) =>
  pubsub.publish(roomTopic(roomId, name), { [name]: payload });

export const publishToUser = <K extends keyof UserTopics>(userId: string, name: K, payload: UserTopics[K]) =>
  pubsub.publish(userTopic(userId, name), { [name]: payload });

export const subscribeToRoom = (roomId: string, name: keyof RoomTopics) =>
  pubsub.asyncIterableIterator(roomTopic(roomId, name));

export const subscribeToUser = (userId: string, name: keyof UserTopics) =>
  pubsub.asyncIterableIterator(userTopic(userId, name));
