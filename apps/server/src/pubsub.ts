import { PubSub } from "graphql-subscriptions";
import type { CardDeck, Game, Rules, User, WhiteCard } from "@repo/shared/types";

/** Events broadcast to every connected client. Keys match the GraphQL subscription field names. */
export type BroadcastEvents = {
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
export type UserEvents = {
  myProfile: User;
  myHand: WhiteCard[];
  givenCards: WhiteCard[];
};

const pubsub = new PubSub();

const userTopic = (name: keyof UserEvents, userId: string) => `${name}:${userId}`;

export const publish = <K extends keyof BroadcastEvents>(name: K, payload: BroadcastEvents[K]) =>
  pubsub.publish(name, { [name]: payload });

export const publishToUser = <K extends keyof UserEvents>(userId: string, name: K, payload: UserEvents[K]) =>
  pubsub.publish(userTopic(name, userId), { [name]: payload });

export const subscribe = (name: keyof BroadcastEvents) => pubsub.asyncIterableIterator(name);

export const subscribeToUser = (userId: string, name: keyof UserEvents) =>
  pubsub.asyncIterableIterator(userTopic(name, userId));
