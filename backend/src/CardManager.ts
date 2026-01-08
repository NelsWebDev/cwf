import { BlackCard, Prisma } from "@prisma/client";
import { prismaClient } from "./singletons";
import { CardDeck, CardState, WhiteCard } from "./types";

export const deckInclude: Prisma.DeckInclude = {
  _count: {
    select: {
      blackCards: true,
      whiteCards: true,
    },
  },
};

type PopulatedDeck = Prisma.DeckGetPayload<{
  include: typeof deckInclude;
}>;

type UpdateDeckProps = {
  id: string;
} & Partial<{
  name: string;
  description: string;
  whiteCards: {
    id?: WhiteCard['id'],
    text: WhiteCard['text'],
  }[];
  blackCards: {
    id?: BlackCard['id'],
    text: BlackCard['text'],
    pick: BlackCard['pick'],
  }[];
}>

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
  static async deleteDeck(deckId: string): Promise<void> {
    await prismaClient.deck.delete({
      where: {
        id: deckId,
      },
    });
  }

  static async updateDeck(props: UpdateDeckProps): Promise<CardDeck | undefined> {
    const { id, name, description, whiteCards, blackCards } = props;
    const existingDeck = await prismaClient.deck.findUnique({
      where: { id },
    });
    if (!existingDeck) {
      return undefined;
    }

    const updatedDeck = await prismaClient.deck.update({
      where: { id },
      data: {
        name: name ?? undefined,
        description: description ?? undefined,
        whiteCards: whiteCards ? {
          upsert: whiteCards.map((card) => ({
            where: { id: card.id || '' },
            create: {
              text: card.text,
              state: CardState.AVAILABLE,
            },
            update: {
              text: card.text,
            },
          })),
        } : undefined,
        blackCards: blackCards ? {
          upsert: blackCards.map((card) => ({
            where: { id: card.id || undefined },
            create: {
              text: card.text,
              pick: card.pick,
            },
            update: {
              text: card.text,
              pick: card.pick,
            },
          })),
        } : undefined,
      },
      include: deckInclude,
    });

    return CardManager.deckFromPrismaQuery(updatedDeck);
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
      include: deckInclude,
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
