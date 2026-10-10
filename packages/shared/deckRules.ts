export const DECK_LIMITS = {
  name: 25,
  description: 200,
  cardText: 150,
  blackCards: 10000,
  whiteCards: 40000,
} as const;

// A blank is a run of three or more underscores.
export const countBlanks = (text: string): number => text.match(/_{3,}/g)?.length ?? 0;

export const calculatePick = (text: string): number => Math.max(1, countBlanks(text));
