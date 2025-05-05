import { socketManager } from "../singletons";
import { EventHandlers } from "../types";

export const UserEventHandlers: Pick<
  EventHandlers,
  "onGetPlayers" | "onKickPlayer" | "onLogout"
> = {
  onGetPlayers: (socket) => {
    socket.emit(
      "players",
      socketManager.activeUsers.map((u) => u.toJSON()),
    );
  },
  onKickPlayer: (_, userId) => {
    socketManager.gameUsers.get(userId)?.kick();
  },
  onLogout: (socket) => {
    socket.data.kick();
    socketManager.gameUsers.delete(socket.data.id);
  },
};
