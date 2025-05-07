import { ReactElement } from "react";
import { BlackCard, CardDeck, ClientEmittedEventFunctions, GameRound, Rules, ServerEmittedEventFunctions, ServerMessage, User, WhiteCard } from "./shared";
import { Socket as IOSocket } from "socket.io-client";

export type Socket = IOSocket<ServerEmittedEventFunctions, ClientEmittedEventFunctions>;
export type AuthService = {
    login: (username: string, password: string) => void;
    logout: () => void;
    isAuthenticated: boolean;
    isAuthenticating: boolean;
    errorMessage: string;
    user?: Omit<User, "isCardCzar">;
    socket: Socket;
    disconnected: boolean;
    reconnect: () => void;
    kickPlayer: (userId: string) => void;
}

export type GameService = {
    players: User[];
    gameStarted: boolean;
    currentBlackCard?: BlackCard|undefined;
    rules: Rules;
    cardDecks: CardDeck[];
    selectedWhiteCard?: WhiteCard|undefined;
    currentRound?: GameRound|undefined;
    myHand: WhiteCard[];    
    addedDeck?: CardDeck|undefined;
    allDecks: CardDeck[];
    addDeckError?: string|undefined;
    isCardCzar: boolean;
    importDeck: (deckId: string) => void;
    setSelectedWhiteCard: (card: WhiteCard|undefined) => void;
    addDeck: (deckId: string) => void;
    removeDeck: (deckId: string) => void;
    startGame: () => void;
    endGame: () => void;
    kickPlayer: (userId: string) => void;
    playCards: (cards: WhiteCard[]) => void;
    undoPlay: () => void;
    pickWinner: (winngCardId: string) => void;
    setRules: (rules: Partial<Rules>) => void;
    setRule: <K extends keyof Rules>(key: K, value: Rules[K]) => void;
    skipBlackCard: () => void;
    voteToSkipBlackCard: (vote: boolean) => void;

}

export type ModalService = {
    isModalOpen: boolean;
    showModal: (props: ShowModalProps) => void;
    closeModal: () => void;
}

export type ShowModalProps = ServerMessage | (Omit<ServerMessage, "message"> & {
    element: ReactElement
})

export * from "./shared";