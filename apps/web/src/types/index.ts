import type { ReactElement } from "react";
import type { BlackCard, CardDeck, GameRound, Rules, ServerMessage, User, WhiteCard } from "@repo/shared/types";

export type AuthService = {
    login: (username: string, password: string) => void;
    logout: () => void;
    updateUsername: (username: string) => Promise<string | undefined>;
    isAuthenticated: boolean;
    isAuthenticating: boolean;
    errorMessage: string;
    user?: Omit<User, "isCardCzar">;
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
    playedCards: WhiteCard[];
    importDeck: (deckId: string) => Promise<CardDeck | undefined>;
    setSelectedWhiteCard: (card: WhiteCard|undefined) => void;
    addDeck: (deckId: string) => void;
    removeDeck: (deckId: string) => void;
    startGame: () => void;
    endGame: () => void;
    kickPlayer: (userId: string) => void;
    undoPlay: () => void;
    pickWinner: (winngCardId: string) => void;
    setRules: (rules: Partial<Rules>) => void;
    setRule: <K extends keyof Rules>(key: K, value: Rules[K]) => void;
    skipBlackCard: () => void;
    shareRoundToDiscord: () => Promise<boolean>;
    voteToSkipBlackCard: (vote: boolean) => void;
    playSelectedCard: () => void;
}

export type ModalService = {
    isModalOpen: boolean;
    showModal: (props: ShowModalProps) => void;
    closeModal: () => void;
}

export type ShowModalProps = ServerMessage | (Omit<ServerMessage, "message"> & {
    element: ReactElement
})

export * from "@repo/shared/types";