import { prismaClient } from "../singletons";
import { CardManager } from "../CardManager";
import { Prisma } from "@prisma/client";


type OriginalDeckFormat = {
  error: number;
  name: string;
  description: string;
  watermark: string;
  calls: { text: string[] }[];
  responses: { text: string[] }[];
}

export const parseDeckToPrismaCreate = (deck: OriginalDeckFormat) : Prisma.DeckCreateInput => {
  const blackCards = deck.calls.map((call) => {
    let formattedString = "";
    const numberOfBlanks = call.text.length - 1;
  
    const lastIndex = call.text.length - 1;
    const text = call.text.map((part, index) => {
      if(part.trim() === "" && index !== lastIndex) {
        formattedString += " _________ ";
        return;
      }
      formattedString += part;
      if(index !== lastIndex) {
        formattedString += " _________ ";
      }  
      formattedString = formattedString.replace(/(_+)\s+([!?,.])/g, '$1$2').trim();
    });

    return {text: formattedString, pick: numberOfBlanks};
  });
  return {
    name: deck.name,
    description: deck.description,
    importedDeckId: deck.watermark,
    blackCards: {create: blackCards},
    whiteCards: {create: deck.responses.map((response) => ({
      text: response.text[0],
    }))},
  }
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
  const json: OriginalDeckFormat = await response.json();
  if (! (json.name && "description" in json && Array.isArray(json.calls) && Array.isArray(json.responses))) {
    throw new Error("Invalid deck format from URL");
  }
  const deck = parseDeckToPrismaCreate(json);

  const existingDeck = await prismaClient.deck.findFirst({
    where: {
      importedDeckId: deck.importedDeckId,
    },
  });

  const newDeck = await prismaClient.$transaction(async (tx) => {
    if (existingDeck) {
      await tx.deck.delete({
        where: { id: existingDeck.id },
      });
    }

    const newDeck  = await tx.deck.create({
      data: deck,
      include: {_count: {select: {blackCards: true, whiteCards: true}}},
    });

    return CardManager.deckFromPrismaQuery(newDeck);
  });

  return newDeck;


};