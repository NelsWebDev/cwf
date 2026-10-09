import { Prisma } from "./prisma/generated/client";
export type PopulatedDeck = Prisma.DeckGetPayload<{
  include: {
    _count: {
      select: {
        blackCards: true;
        whiteCards: true;
      };
    };
  };
}>;

export * from "@repo/shared/types";
