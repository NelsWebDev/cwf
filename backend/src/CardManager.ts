import { Prisma } from "@prisma/client";
import { prismaClient } from "./singletons";
import { CardDeck, CardState, PopulatedCardDeck, WhiteCard } from "./types";

export const deckInclude: Prisma.DeckInclude = {
  _count: {
    select: {
      blackCards: true,
      whiteCards: true,
    },
  },
};







export class CardManager {
  static async fetchAllDecks(): Promise<CardDeck[]> {
    const decks = await prismaClient.deck.findMany({
      include: deckInclude,
    });
    return decks.map(CardManager.deckFromPrismaQuery);
  }

  static async createDeck(deckName: string, description?: string): Promise<CardDeck> {
    const newDeck = await prismaClient.deck.create({
      data: {
        name: deckName,
        description: description,
      },
      include: deckInclude,
    });
    return CardManager.deckFromPrismaQuery(newDeck);
  }
  static async deleteDeck(deckId: string): Promise<CardDeck | undefined> {
    return prismaClient.deck.delete({
      where: {
        id: deckId,
      },
      include: deckInclude,
    }).then((deck) => deck ? CardManager.deckFromPrismaQuery(deck) : undefined);
  }


  static async updateDeck(props: PopulatedCardDeck): Promise<PopulatedCardDeck> {
    const { id, name, description } = props;
    const idsOfWhiteCards = props.whiteCards.map((card) => card.id);
    const idsOfBlackCards = props.blackCards.map((card) => card.id);


    await prismaClient.deck.update({
      where: {
        id,
      },
      data: {
        name,
        description,
        whiteCards: {
          deleteMany: {
            id: {
              notIn: idsOfWhiteCards,
            },
          },
          upsert: props.whiteCards.map((card) => ({
            where: { id: card.id },
            create: {
              text: card.text,
            },
            update: {
              text: card.text,
            },
          })),
        },
        blackCards: {
          deleteMany: {
            id: {
              notIn: idsOfBlackCards,
            },
          },
          upsert: props.blackCards.map((card) => ({
            where: { id: card.id },
            create: {
              id: card.id || undefined,
              text: card.text,
              pick: card.pick,
            },
            update: {
              pick: card.pick,
              state: card.state,
            },
          })),
        },
      },
      include: deckInclude,
    });

    return CardManager.getPopulatedDeck(props.id);

  }

  public static async getPopulatedDeck(id: string): Promise<PopulatedCardDeck> {
    const deck = await prismaClient.deck.findFirst({
      where: { id },
      include: {
        blackCards: true,
        whiteCards: true,
      },
    });
    const { blackCards, whiteCards, ...rest } = deck;
    return {
      ...rest,
      blackCards: blackCards,
      whiteCards: whiteCards,
    }
  }


  public static deckFromPrismaQuery(deck: Prisma.DeckGetPayload<{ include: typeof deckInclude }>): CardDeck {
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
      include: deckInclude,
    });
    return query ? CardManager.deckFromPrismaQuery(query) : null;
  }

  public static async fetchPopulatedDeck(where: Prisma.DeckWhereInput): Promise<PopulatedCardDeck | undefined> {
    const deck = await prismaClient.deck.findFirst({
      where,
      include: {
        blackCards: true,
        whiteCards: true,
      },
    });
    if (!deck) {
      return;
    }
    return deck as PopulatedCardDeck;
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
