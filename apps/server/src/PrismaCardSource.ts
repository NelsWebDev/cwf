import { CardState, type BlackCard, type WhiteCard } from "@repo/shared/types";
import { CardManager } from "./CardManager";
import type { CardQuery, CardSource } from "./game/contracts";
import type { PrismaClient } from "./prisma/generated/client";

/** Loads the decks and cards a game is played with from the database. */
export class PrismaCardSource implements CardSource {
  constructor(private readonly prisma: PrismaClient) {}

  fetchDeck(deckId: string) {
    return CardManager.fetchDeck({ id: deckId });
  }

  async fetchCards({ deckIds, singleAnswerOnly }: CardQuery) {
    const inDecks = { deletedAt: null, decksCards: { some: { deckId: { in: deckIds } } } };
    const [blackCards, whiteCards] = await Promise.all([
      this.prisma.blackCard.findMany({
        where: { ...inDecks, ...(singleAnswerOnly ? { pick: 1 } : {}) },
        include: { decksCards: { select: { deckId: true } } },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.whiteCard.findMany({
        where: inDecks,
        include: { decksCards: { select: { deckId: true } } },
      }),
    ]);

    return {
      blackCards: blackCards.map<BlackCard>(({ decksCards, ...card }) => ({
        ...card,
        deckIds: decksCards.map((d) => d.deckId),
        state: CardState.AVAILABLE,
      })),
      whiteCards: whiteCards.map<WhiteCard>(({ decksCards, ...card }) => ({
        ...card,
        deckIds: decksCards.map((d) => d.deckId),
        state: CardState.AVAILABLE,
        isCustom: false,
      })),
    };
  }
}
