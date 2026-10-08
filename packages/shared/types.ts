export type User = {
    id: string;
    username:string;
    isActive: boolean;
    points: number;
    isCardCzar: boolean;
    discordId?: string | null;
    newHandsRemaining: number;
}

export type Game = {
    started: boolean;
    decks: CardDeck[];
    rules: Rules;
    players: User[];
    currentRound?: GameRound;
}

export enum RoundStatus {
    WAITING_FOR_PLAYERS = "WAITING_FOR_PLAYERS",
    SHOWING_WINNER = "SHOWING_WINNER",
    SELECTING_WINNER = "SELECTING_WINNER",
}

export type GameRound = {
    id: string;
    blackCard: BlackCard;
    cardCzarId: string;
    status: RoundStatus;
    winnerId?: string;
    plays: {
        [key: string]:  WhiteCard[];
    }
    votesToSkip: {
        [key: string]: boolean;
    }
    sittingOut: string[];
}

export type CardDeck = {
    id: string;
    name: string;
    description?: string;
    numberOfWhiteCards: number;
    numberOfBlackCards: number;
    importedDeckId?: string;
    createdAt: Date;
    updatedAt: Date;
}

export type Rules = {
    pointsToWin: number;
    pointsToWinBy: number;
    canUndo: boolean;
    numberOfCustomCards: number;
    newHandsPerGame: number;
    maxNumberOfPlayers: number;
    allowMultipleAnswerBlackCards: boolean;
    announceToDiscord: boolean;
}

export const DEFAULT_RULES: Rules = {
    pointsToWin: 8,
    pointsToWinBy: 1,
    canUndo: true,
    numberOfCustomCards: 0,
    newHandsPerGame: 0,
    maxNumberOfPlayers: 10,
    allowMultipleAnswerBlackCards: true,
    announceToDiscord: true,
}


export enum CardState  {
    IN_USE = "IN_USE",
    PLAYED_PREVIOUSLY = "PLAYED_PREVIOUSLY",
    SKIPPED = "SKIPPED",
    AVAILABLE = "AVAILABLE",
}
export type BlackCard = {
    id: string;
    deckIds: string[];
    text: string;
    pick: number;
    state: CardState;
    createdAt: Date;
    updatedAt: Date;
}

export type WhiteCard = {
    id: string;
    deckIds: string[];
    text: string;
    isCustom: boolean;
    state: CardState;
    createdAt: Date;
    updatedAt: Date;
}

export type ServerMessage = {
    title?: string;
    message: string;
    autoclose?: number;
    canClose?: boolean;
}
