import type { Roster } from "../game/contracts";
import type { GameUser } from "../session/GameUser";

/** Everyone who has joined a room, connected or not. */
export class PlayerRegistry implements Roster {
  private readonly players = new Map<string, GameUser>();

  get allPlayers() {
    return [...this.players.values()];
  }

  get activePlayers() {
    return this.allPlayers.filter((player) => player.isActive);
  }

  findPlayer(userId: string) {
    return this.players.get(userId);
  }

  add(player: GameUser) {
    this.players.set(player.id, player);
  }

  remove(userId: string) {
    this.players.delete(userId);
  }

  isUsernameAvailable(username: string, exceptUserId?: string) {
    const wanted = username.toLowerCase();
    return !this.allPlayers.some(
      (player) => player.id !== exceptUserId && player.username.toLowerCase() === wanted,
    );
  }
}
