import { GameRoom } from "./GameRoom";

export const DEFAULT_ROOM_ID = "default";

/** Looks up the room a request belongs to. Today there is a single room; more can be added by creating them here. */
export class RoomManager {
  private readonly rooms = new Map<string, GameRoom>();

  constructor(private readonly createRoom: (id: string) => GameRoom) {}

  get defaultRoom() {
    return this.getOrCreate(DEFAULT_ROOM_ID);
  }

  get(roomId: string) {
    return this.rooms.get(roomId);
  }

  getOrCreate(roomId: string) {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = this.createRoom(roomId);
      this.rooms.set(roomId, room);
    }
    return room;
  }
}
