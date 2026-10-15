import type { Rules } from "@repo/shared/types";

export class Scoreboard {
  private points = new Map<string, number>();

  pointsOf(userId: string) {
    return this.points.get(userId) ?? 0;
  }

  award(userId: string) {
    const total = this.pointsOf(userId) + 1;
    this.points.set(userId, total);
    return total;
  }

  clear() {
    this.points.clear();
  }

  /** The id of the player in front; the earliest to score wins a tie. */
  get leaderId(): string | undefined {
    let leader: string | undefined;
    let best = -Infinity;
    for (const [userId, points] of this.points) {
      if (points > best) {
        leader = userId;
        best = points;
      }
    }
    return leader;
  }

  /** Whether the leader has reached the target and is far enough ahead of second place. */
  hasWinner({ pointsToWin, pointsToWinBy }: Pick<Rules, "pointsToWin" | "pointsToWinBy">) {
    const [first = 0, second = 0] = [...this.points.values()].sort((a, b) => b - a);
    return first >= pointsToWin && first - second >= pointsToWinBy;
  }
}
