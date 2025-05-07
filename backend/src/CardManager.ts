import { Prisma } from "@prisma/client";
import { prismaClient } from "./singletons";
import { CardDeck, CardState, WhiteCard } from "./types";

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

export class CardManager {
  static async fetchAllDecks(): Promise<CardDeck[]> {
    const decks = await prismaClient.deck.findMany({
      include: {
        _count: {
          select: {
            blackCards: true,
            whiteCards: true,
          },
        },
      },
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
      description: description ?? undefined,
      numberOfBlackCards: blackCards,
      numberOfWhiteCards: whiteCards,
    };
  }

  public static async fetchDeck(where: Prisma.DeckWhereInput) {
    const query = await prismaClient.deck.findFirst({
      where,
      include: {
        _count: {
          select: {
            blackCards: true,
            whiteCards: true,
          },
        },
      },
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
        },
      })
      .then((deck) => {
        return !!deck;
      });
  }

  static makeBlankWhiteCards(number: number): WhiteCard[] {
    return Array.from({ length: number }).map(() => ({
      id: crypto.randomUUID(),
      deckId: undefined,
      text: "",
      state: CardState.AVAILABLE,
      createdAt: new Date(),
      updatedAt: new Date(),
      isCustom: true,
    }));
  }
}
