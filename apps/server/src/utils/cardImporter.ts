import { prismaClient } from "../singletons";
import { CardManager } from "../CardManager";
import { Prisma } from "../prisma/generated/client";


type OriginalDeckFormat = {
  error: number;
  name: string;
  description: string;
  watermark: string;
  calls: { text: string[] }[];
  responses: { text: string[] }[];
}

export const parseDeck = (deck: OriginalDeckFormat) => {
  const blackCards = deck.calls.map((call) => {
    const numberOfBlanks = call.text.length - 1;
    const text = call.text
      .map((part) => part.trim())
      .join(" _________ ")
      .replace(/(_+)\s+([!?,.])/g, "$1$2")
      .trim();

    return { text, pick: numberOfBlanks };
  });
  return {
    deck: {
      name: deck.name,
      description: deck.description,
      importedDeckId: deck.watermark,
      cahOfficial: false,
    } satisfies Prisma.DeckCreateInput,
    blackCards,
    whiteCards: deck.responses.map((response) => ({ text: response.text[0] })),
  };
}

export const importDeck = async (deckCode: string) => {
 
  const deckCodeREGEX = /[A-Z0-9]{5}/

  let code = deckCode.trim();
  if(code.length === 5) {
    if(!deckCodeREGEX.test(code)) {
      throw new Error("Invalid deck code");
    }
  } 
  else {
    const match = code.match(deckCodeREGEX);
    if(!match) {
      throw new Error("Invalid deck code");
    }
    code = match[0].trim();
    console.log("Deck code found in URL: ", code);
  }



  const url = `https://api.crcast.cc/v1/cc/decks/${code}/all`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch deck: ${response.statusText}`);
  }
  const json: OriginalDeckFormat = await response.json() as OriginalDeckFormat;
  if (! (json.name && "description" in json && Array.isArray(json.calls) && Array.isArray(json.responses))) {
    throw new Error("Invalid deck format from URL");
  }
  const parsed = parseDeck(json);

  const existingDeck = await prismaClient.deck.findFirst({
    where: {
      importedDeckId: parsed.deck.importedDeckId,
      cahOfficial: false,
    },
  });

  const newDeck = await prismaClient.$transaction(async (tx) => {
    if (existingDeck) {
      await tx.deck.delete({
        where: { id: existingDeck.id },
      });
    }

    const created = await tx.deck.create({ data: parsed.deck });

    // Cards are created explicitly (rather than via nested creates) so the
    // join rows are always inserted after the deck and cards exist.
    const whiteCards = await tx.whiteCard.createManyAndReturn({
      data: parsed.whiteCards,
      select: { id: true },
    });
    await tx.deckWhiteCard.createMany({
      data: whiteCards.map(({ id }) => ({ deckId: created.id, whiteCardId: id })),
    });

    const blackCards = await tx.blackCard.createManyAndReturn({
      data: parsed.blackCards,
      select: { id: true },
    });
    await tx.deckBlackCard.createMany({
      data: blackCards.map(({ id }) => ({ deckId: created.id, blackCardId: id })),
    });

    const newDeck = await tx.deck.findUniqueOrThrow({
      where: { id: created.id },
      include: { _count: { select: { blackCards: true, whiteCards: true } } },
    });

    return CardManager.deckFromPrismaQuery(newDeck);
  }, { timeout: 60_000 });

  return newDeck;


};