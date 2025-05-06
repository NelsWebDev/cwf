import { Prisma } from "@prisma/client";
import { GameUser } from "../session/GameUser";
import {
  ClientEmittedEventFunctions,
  ServerEmittedEventFunctions,
} from "./shared";
import { Socket as IOSocket } from "socket.io";

export type Socket = IOSocket<
  ClientEmittedEventFunctions,
  ServerEmittedEventFunctions,
  object,
  GameUser
>;

export type EventHandlers = {
  [K in keyof ClientEmittedEventFunctions as `on${Capitalize<K>}`]: ClientEmittedEventFunctions[K] extends (
    ...args: infer A
  ) => unknown
    ? (socket: Socket, ...args: A) => void
    : never;
};

export type PopulatedDeck = Prisma.DeckGetPayload<{
  include: {
    _count: {
      select: {
        blackCards: true;
        whiteCards: true;
      };
    };
  };
}>;

export * from "./shared";
