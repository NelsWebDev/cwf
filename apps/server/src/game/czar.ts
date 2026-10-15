import type { GameUser } from "../session/GameUser";

/**
 * The player who judges the next round: the one after the current czar in seating order,
 * the first player if the current czar has left, or a random one when there is no czar yet.
 */
export function pickNextCzar(players: GameUser[], current?: GameUser): GameUser {
  if (players.length === 0) {
    throw new Error("No players");
  }
  if (!current) {
    return players[Math.floor(Math.random() * players.length)]!;
  }
  const index = players.findIndex((player) => player.id === current.id);
  return index === -1 ? players[0]! : players[(index + 1) % players.length]!;
}
