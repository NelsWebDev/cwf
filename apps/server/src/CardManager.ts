import { Prisma } from "./prisma/generated/client";
import { prismaClient } from "./singletons";
import { CardDeck, CardState, WhiteCard } from "@repo/shared/types";

type PopulatedDeck = Prisma.DeckGetPayload<{
  include: {
    _count: {
      select: {
        blackCards: true;
        whiteCards: true;
      };
    };
  };
}>;

// Counts and lists only include cards that have not been soft-deleted.
export const liveBlackCards = { blackCard: { deletedAt: null } } satisfies Prisma.DeckBlackCardWhereInput;
export const liveWhiteCards = { whiteCard: { deletedAt: null } } satisfies Prisma.DeckWhiteCardWhereInput;
export const liveCardCounts = {
  select: {
    blackCards: { where: liveBlackCards },
    whiteCards: { where: liveWhiteCards },
  },
} satisfies Prisma.DeckCountOutputTypeDefaultArgs;

export class CardManager {
  static async fetchAllDecks(): Promise<CardDeck[]> {
    const decks = await prismaClient.deck.findMany({
      where: { deletedAt: null },
      include: { _count: liveCardCounts },
    });
    return decks.map(CardManager.deckFromPrismaQuery);
  }

  public static deckFromPrismaQuery(deck: PopulatedDeck): CardDeck {
    const {
      _count: { blackCards, whiteCards },
      description,
      ...data
    } = deck;
    return {
      ...data,
      importedDeckId: data.importedDeckId ?? undefined,
      description: description ?? undefined,
      numberOfBlackCards: blackCards,
      numberOfWhiteCards: whiteCards,
    };
  }

  public static async fetchDeck(where: Prisma.DeckWhereInput) {
    const query = await prismaClient.deck.findFirst({
      where: { ...where, deletedAt: null },
      include: { _count: liveCardCounts },
    });
    return query ? CardManager.deckFromPrismaQuery(query) : null;
  }
  static async deckExists(deckId: string) {
    return prismaClient.deck
      .findUnique({
        where: {
          id: deckId,
        },
        select: {
          id: true,
          deletedAt: true,
        },
      })
      .then((deck) => {
        return !!deck && !deck.deletedAt;
      });
  }

  static makeBlankWhiteCards(number: number): WhiteCard[] {
    return Array.from({ length: number }).map(() => ({
      id: crypto.randomUUID(),
      deckIds: [],
      text: "",
      state: CardState.AVAILABLE,
      createdAt: new Date(),
      updatedAt: new Date(),
      isCustom: true,
    }));
  }
}