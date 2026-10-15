import { PrismaCardSource } from "./PrismaCardSource";
import { GameRoom } from "./room/GameRoom";
import { discordAnnouncer } from "./room/discordAnnouncer";
import { PubSubRoomEvents } from "./room/PubSubRoomEvents";
import { RoomManager } from "./room/RoomManager";
import { prismaClient } from "./singletons";

/** Composition root for rooms: the one place where the game is wired to the database, pubsub and Discord. */
export const rooms = new RoomManager(
  (id) =>
    new GameRoom(id, {
      events: new PubSubRoomEvents(id),
      cards: new PrismaCardSource(prismaClient),
      announcer: discordAnnouncer,
    }),
);
