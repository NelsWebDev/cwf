export type User = {
    id: string;
    username:string;
    isActive: boolean;
    points: number;
    isCardCzar: boolean;
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
}

export type CardDeck = {
    id: string;
    name: string;
    description?: string;
    numberOfWhiteCards: number;
    numberOfBlackCards: number;
    createdAt: Date;
    updatedAt: Date;
}

export type Rules = {
    pointsToWin: number;
    canUndo: boolean;
    numberOfCustomCards: number;
    maxNumberOfPlayers: number;
    allowMultipleAnswerBlackCards: boolean;
}

export const DEFAULT_RULES: Rules = {
    pointsToWin: 8,
    canUndo: true,
    numberOfCustomCards: 0,
    maxNumberOfPlayers: 10,
    allowMultipleAnswerBlackCards: true,
}


export enum CardState  {
    IN_USE = "IN_USE",
    PLAYED_PREVIOUSLY = "PLAYED_PREVIOUSLY",
    SKIPPED = "SKIPPED",
    AVAILABLE = "AVAILABLE",
}
export type BlackCard = {
    id: string;
    deckId: string;
    text: string;
    pick: number;
    state: CardState;
    createdAt: Date;
    updatedAt: Date;
}

export type WhiteCard = {
    id: string;
    deckId?: string;
    text: string;
    isCustom: boolean;
    state: CardState;
    createdAt: Date;
    updatedAt: Date;
}

type ClientEmittedEvents = {
    "kickPlayer": string;
    "playCards": WhiteCard[];
    "pickWinner": string;
    "logout": void;
    "addDeck": string;
    "removeDeck": string;
    "updateRules": Partial<Rules>;
    "startGame": void;
    "endGame": void;
    "getPlayers": void;
    "getGame": void;
    "myHand": void;
    "skipBlackCard": void;
    "voteToSkipBlackCard": boolean;
    "undoPlay": void;
}

type ServerEmittedEvents = {

    "myProfile": User;
    "myHand": WhiteCard[];
    "playerJoined": User;
    "playerLeft": string;
    "players": User[];
    "rules": Rules;
    "decks": CardDeck[];
    "game": Game;
    "serverMessage": ServerMessage;
    "givenCards": WhiteCard[];
    "playerPlayed": User['id'];
    "gameEnded": User['username'];
    "closeModal": void;
    "holdGame": void;
}
export type ServerMessage = {
    title?: string;
    message: string;
    autoclose?: number;
    canClose?: boolean;
}

export type LoginResponse = {
    success: boolean;
    user?: User;
    error?: string;
}


export type ClientEmittedEventFunctions = {
    [K in keyof ClientEmittedEvents]: ClientEmittedEvents[K] extends void ? () => void : (arg: ClientEmittedEvents[K]) => void;
}

export type ServerEmittedEventFunctions = {
    [K in keyof ServerEmittedEvents]: ServerEmittedEvents[K] extends void ? () => void : (arg: ServerEmittedEvents[K]) => void;
}