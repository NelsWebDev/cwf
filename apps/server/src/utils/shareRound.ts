import { RoundStatus } from "@repo/shared/types";
import type { GameRound } from "../game/GameRound";
import { loadCardImages } from "./cardImages";
import { postImageToDiscord } from "./discordWebhook";
import { renderRoundImage } from "./roundImage";

/** Renders a finished round as an image and posts it to Discord, at most once per round. */
export async function shareRoundToDiscord(
  round: GameRound | undefined,
  nameOf: (userId: string) => string,
) {
  if (!round || round.status !== RoundStatus.SHOWING_WINNER) {
    throw new Error("There is no finished round to share");
  }
  const plays = Object.entries(round.plays);
  if (!plays.some(([, cards]) => cards.length > 0)) {
    throw new Error("This round has no played cards to share");
  }
  if (round.sharedToDiscord) {
    throw new Error("This round was already shared to Discord");
  }

  round.sharedToDiscord = true;
  try {
    const images = await loadCardImages(plays.flatMap(([, cards]) => cards.map((card) => card.text)));
    const image = renderRoundImage({
      images,
      blackCardText: round.blackCard.text,
      pick: round.blackCard.pick,
      plays: plays.map(([userId, cards]) => ({
        username: nameOf(userId),
        cards: cards.map((card) => card.text),
        isWinner: userId === round.winnerId,
      })),
    });
    await postImageToDiscord(image, "round.png");
  } catch (error) {
    round.sharedToDiscord = false;
    console.error("Failed to share round to Discord", error);
    throw new Error("Failed to share to Discord");
  }
}
