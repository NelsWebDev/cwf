import type { Dispatch, ReactElement, SetStateAction} from "react"
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_RULES, RoundStatus } from "../types";
import type { CardDeck, GameRound, GameService, Rules, User, WhiteCard } from "../types";
import { useApolloClient, useQuery, useSubscription } from "@apollo/client/react";
import { useAuth, useModal, useMutate } from "../hooks";
import {
    ADD_DECK_MUTATION, DECKS_QUERY, DECKS_SUBSCRIPTION, END_GAME_MUTATION, GAME_ENDED_SUBSCRIPTION, GAME_QUERY,
    GAME_SUBSCRIPTION, GIVEN_CARDS_SUBSCRIPTION, HOLD_GAME_SUBSCRIPTION, IMPORT_DECK_MUTATION, KICK_PLAYER_MUTATION,
    MY_HAND_QUERY, MY_HAND_SUBSCRIPTION, PICK_WINNER_MUTATION, PLAY_CARDS_MUTATION, PLAYER_JOINED_SUBSCRIPTION,
    PLAYER_LEFT_SUBSCRIPTION, REMOVE_DECK_MUTATION, RULES_SUBSCRIPTION, SHARE_ROUND_TO_DISCORD_MUTATION, SKIP_BLACK_CARD_MUTATION, START_GAME_MUTATION,
    UNDO_PLAY_MUTATION, UPDATE_RULES_MUTATION, VOTE_TO_SKIP_MUTATION, WINNER_SELECTED_SUBSCRIPTION, toGame,
} from "../graphql/operations";
import type { GqlGame } from "../graphql/operations";
import { getErrorMessage } from "../utils";
import { Button, Input, Stack, Text } from "@mantine/core";
import { GameServiceContext } from "./Contexts";
import { isURL } from "../utils";



const NotEnoughPlayers = ({ endGame }: { endGame: () => void }) => {
    return (
        <>
            <Text 
            style={{ lineHeight: "1rem" }}>There are now less than three players. Please wait til someone joins, or press "End Game"</Text>
            <Button onClick={endGame} mt="lg">
                End Game
            </Button>
        </>
    )
}

type CustomCardModalProps = {
    setSelectedWhiteCard: (whiteCard: WhiteCard | undefined) => void;
    setPlayedCards: Dispatch<SetStateAction<WhiteCard[]>>;
    selectedWhiteCard: WhiteCard;
}

const CustomCardModal = ({ setSelectedWhiteCard, setPlayedCards, selectedWhiteCard }: CustomCardModalProps) => {

    const [text, setText] = useState<string>("");
    const { closeModal } = useModal();



    const handleSubmit = () => {
        let txt = text.trim();
        if (!txt) {
            setSelectedWhiteCard(undefined);
            closeModal();
            return;
        }

        if(isURL(txt)) {
            txt = '[img]' + txt + '[/img]';
        }
        selectedWhiteCard.text = txt;
        setPlayedCards((prev) => [...prev, selectedWhiteCard]);
        setSelectedWhiteCard(undefined);
        closeModal();
    }

    return (
        <Stack>
            <Input id="custom-card-input" error={!text.trim()} placeholder="Custom card text...." type="text" onKeyDown={e => {
                if (e.key === "Enter") {
                    handleSubmit();
                }
            }} value={text} onChange={(e) => setText(e.currentTarget.value)} autoFocus={true} />
            <Button c="white" disabled={!text.trim()} onClick={handleSubmit}>Play</Button>
        </Stack>
    )
}


const GameServiceProvider = ({ children }: { children: ReactElement }) => {

    const { user } = useAuth();
    const client = useApolloClient();
    const mutate = useMutate();

    const [players, setPlayers] = useState<User[]>([]);
    const [rules, setRules] = useState<Rules>({ ...DEFAULT_RULES });
    const [cardDecks, setCardDecks] = useState<CardDeck[]>([]);
    const [selectedWhiteCard, setSelectedWhiteCard] = useState<WhiteCard | undefined>(undefined);
    const [currentRound, setCurrentRound] = useState<GameRound>();
    const [myHand, setMyHand] = useState<WhiteCard[]>([]);
    const [addDeckError, setAddDeckError] = useState<string | undefined>(undefined);
    const [addedDeck, setAddedDeck] = useState<CardDeck | undefined>(undefined);
    const [allDecks, setAllDecks] = useState<CardDeck[]>([]);
    const { showModal } = useModal();
    const [playedCards, setPlayedCards] = useState<WhiteCard[]>([]);

    const gameStarted = useMemo(() => !!currentRound, [currentRound]);
    const currentBlackCard = useMemo(() => currentRound?.blackCard, [currentRound]);

    const playSelectedCard = () => {
        if (!selectedWhiteCard) {
            showModal({ title: "No card selected", message: "Please select a card to play", autoclose: 3_000 });
            return;
        }

        if (currentRound?.status !== RoundStatus.WAITING_FOR_PLAYERS) {
            showModal({ title: "Game not in play", message: "You can't play a card right now", autoclose: 3_000 });
            return;
        }

        if (currentRound?.cardCzarId === user?.id) {
            showModal({ title: "Card czar can't play", message: "You can't play a card as the card czar", autoclose: 3_000 });
            return;
        }

        if (selectedWhiteCard.isCustom) {
            showModal({
                title: "Custom card",
                message: "",
                element: <CustomCardModal
                    selectedWhiteCard={selectedWhiteCard}
                    setPlayedCards={setPlayedCards}
                    setSelectedWhiteCard={setSelectedWhiteCard}
                />,
                canClose: true,
            });
        } else {
            setPlayedCards(prev => [...prev, selectedWhiteCard]);
            setSelectedWhiteCard(undefined);
        }
    }

    useEffect(() => {
        if (currentRound?.status === RoundStatus.WAITING_FOR_PLAYERS) {
            if (playedCards.length === currentBlackCard?.pick) {
                playCards(playedCards);
            }
        }
    }, [playedCards.length, currentRound?.status, currentBlackCard?.pick]);


    const applyGame = (game: GqlGame) => {
        const { rules, players, decks, currentRound } = toGame(game);
        setCardDecks(decks);
        setRules(rules);
        setPlayers(players);
        setCurrentRound(currentRound);
    }

    // Initial state. Live changes arrive through the subscriptions below.
    const { data: gameData } = useQuery(GAME_QUERY);
    const { data: handData } = useQuery(MY_HAND_QUERY);
    const { data: allDecksData, error: allDecksError } = useQuery(DECKS_QUERY);

    useEffect(() => {
        if (gameData) applyGame(gameData.game);
    }, [gameData]);

    useEffect(() => {
        if (handData) setMyHand(handData.myHand);
    }, [handData]);

    useEffect(() => {
        if (allDecksData) setAllDecks(allDecksData.decks);
    }, [allDecksData]);

    useEffect(() => {
        if (allDecksError) {
            showModal({ title: "Error", message: "Failed to fetch decks", autoclose: 3_000 });
        }
    }, [allDecksError]);

    const subscriptionOptions = { fetchPolicy: "no-cache" } as const;

    useSubscription(GAME_SUBSCRIPTION, {
        ...subscriptionOptions,
        onData: ({ data }) => data.data && applyGame(data.data.game),
    });
    useSubscription(RULES_SUBSCRIPTION, {
        ...subscriptionOptions,
        onData: ({ data }) => data.data && setRules(data.data.rules),
    });
    useSubscription(DECKS_SUBSCRIPTION, {
        ...subscriptionOptions,
        onData: ({ data }) => data.data && setCardDecks(data.data.decks),
    });
    useSubscription(PLAYER_JOINED_SUBSCRIPTION, {
        ...subscriptionOptions,
        onData: ({ data }) => {
            const joined = data.data?.playerJoined;
            if (joined) {
                setPlayers((prev) => [...prev.filter((p) => p.id !== joined.id), joined]);
            }
        },
    });
    useSubscription(PLAYER_LEFT_SUBSCRIPTION, {
        ...subscriptionOptions,
        onData: ({ data }) => {
            const userId = data.data?.playerLeft;
            if (userId) {
                setPlayers((prev) => prev.filter((p) => p.id !== userId));
            }
        },
    });
    useSubscription(MY_HAND_SUBSCRIPTION, {
        ...subscriptionOptions,
        onData: ({ data }) => data.data && setMyHand(data.data.myHand),
    });
    useSubscription(GIVEN_CARDS_SUBSCRIPTION, {
        ...subscriptionOptions,
        onData: ({ data }) => {
            const cards = data.data?.givenCards;
            if (cards) {
                setMyHand(prev => [...prev, ...cards]);
            }
        },
    });
    useSubscription(GAME_ENDED_SUBSCRIPTION, {
        ...subscriptionOptions,
        onData: ({ data }) => {
            if (!data.data) return;
            const username = data.data.gameEnded;
            setSelectedWhiteCard(undefined);
            setMyHand([]);
            showModal({ title: "Game ended", message: "The game has ended" + (username ? ` and ${username} won` : ""), element: <></>, autoclose: 3_000 });
        },
    });
    useSubscription(HOLD_GAME_SUBSCRIPTION, {
        ...subscriptionOptions,
        onData: ({ data }) => {
            if (data.data) {
                showModal({ title: "Game on hold", element: <NotEnoughPlayers endGame={endGame} />, canClose: false });
            }
        },
    });
    useSubscription(WINNER_SELECTED_SUBSCRIPTION, {
        ...subscriptionOptions,
        onData: ({ data }) => {
            const czarId = data.data?.winnerSelected;
            if (!czarId) return;
            setCurrentRound((prev) => {
                return {
                    ...prev as GameRound,
                    winnerId: czarId,
                    status: RoundStatus.SHOWING_WINNER,
                }
            });
            setPlayers((prev) => {
                return prev.map((player) => {
                    if (player.id === czarId) {
                        return {
                            ...player,
                            points: player.points + 1,
                        }
                    }
                    return player;
                });
            });
        },
    });

    const setRule = <K extends keyof Rules>(key: K, value: Rules[K]) => {
        mutate(UPDATE_RULES_MUTATION, { rules: { [key]: value } });
    }

    const startGame = () => {
        if (gameStarted) {
            showModal({ title: "Game already started", message: "You can't start the game again", autoclose: 3_000 });
            return;
        }
        const numberOfBlackCards = cardDecks.reduce((acc, deck) => acc + deck.numberOfBlackCards, 0);
        const numberOfWhiteCards = cardDecks.reduce((acc, deck) => acc + deck.numberOfWhiteCards, 0);
        const minBlackCards = (players.length * rules.pointsToWin) - 1;
        const minWhiteCards = (players.length * rules.pointsToWin) - 1 + (players.length * 10);
        if (numberOfBlackCards < minBlackCards || numberOfWhiteCards < minWhiteCards) {
            showModal({ title: "Not enough cards", message: `You need at least ${minBlackCards} black cards and ${minWhiteCards} white cards to start the game`, autoclose: 5_000 });
            return;
        }

        mutate(START_GAME_MUTATION, undefined, "Failed to start game");
    }

    const importDeck = async (deckId: string): Promise<CardDeck | undefined> => {
        if (!deckId) {
            setAddDeckError("Please enter a deck ID");
            return undefined;
        }
        setAddedDeck(undefined);
        const formattedID = deckId.trim().replace("https://cast.clrtd.com/deck/", "").replace("https://cast.clrtd.com/account/edit/", "")
        if (!formattedID.match(/[A-Z0-9]{5}/)) {
            setAddDeckError("Invalid deck ID");
            return undefined;
        }

        setAddDeckError(undefined);
        try {
            const { data } = await client.mutate({
                mutation: IMPORT_DECK_MUTATION,
                variables: { deckId: formattedID },
            });
            const deck = data?.importDeck;
            if (!deck) {
                return undefined;
            }
            setAddedDeck(deck);
            setAllDecks((prev) => prev.some((d) => d.id === deck.id) ? prev : [...prev, deck]);
            return deck;
        } catch (error) {
            setAddDeckError(getErrorMessage(error));
            return undefined;
        }
    }
    const endGame = () => {
        mutate(END_GAME_MUTATION);
    }

    const playCards = (cards: WhiteCard[]) => {
        setPlayedCards(cards);
        mutate(PLAY_CARDS_MUTATION, { cards: cards.map(({ id, text }) => ({ id, text })) }).then((result) => {
            if (!result) {
                setPlayedCards([]);
                setSelectedWhiteCard(undefined);
            }
        });
    }

    const undoPlay = () => {
        setPlayedCards([]);
        setSelectedWhiteCard(undefined);
        mutate(UNDO_PLAY_MUTATION);
    }

    const realPlays = useMemo(() => {
        if (currentRound?.status !== RoundStatus.WAITING_FOR_PLAYERS || currentRound?.cardCzarId === user?.id || !playedCards.length) {
            return currentRound?.plays ?? {};
        }
        return {
            ...currentRound?.plays,
            [user?.id as string]: playedCards
        }
    }, [currentRound?.plays, currentRound?.status, playedCards.length])

    useMemo(() => {
        setPlayedCards([]);
    }, [currentRound?.status]);
    const pickWinner = (cardId: string) => {
        mutate(PICK_WINNER_MUTATION, { cardId });
    }

    const value: GameService = {
        players,
        currentBlackCard,
        rules,
        cardDecks,
        selectedWhiteCard,
        gameStarted,
        currentRound: currentRound ? {
            ...currentRound as GameRound,
            plays: realPlays,
        } : undefined,
        myHand,
        addedDeck,
        addDeckError,
        allDecks,
        isCardCzar: currentRound?.cardCzarId === user?.id,
        importDeck,
        setRule,
        setSelectedWhiteCard,
        addDeck: (deckId: string) => { mutate(ADD_DECK_MUTATION, { deckId }); },
        removeDeck: (deckId: string) => { mutate(REMOVE_DECK_MUTATION, { deckId }); },
        startGame,
        endGame,
        kickPlayer: (userId: string) => { mutate(KICK_PLAYER_MUTATION, { userId }); },
        undoPlay,
        pickWinner,
        playSelectedCard,
        playedCards,
        setRules: (rules: Partial<Rules>) => { mutate(UPDATE_RULES_MUTATION, { rules }); },
        shareRoundToDiscord: async () => !!(await mutate(SHARE_ROUND_TO_DISCORD_MUTATION))?.shareRoundToDiscord,
        skipBlackCard: () => { mutate(SKIP_BLACK_CARD_MUTATION); },
        voteToSkipBlackCard: () => { mutate(VOTE_TO_SKIP_MUTATION, { vote: true }); },
    }


    return (
        <GameServiceContext.Provider value={value}>
            {children}
        </GameServiceContext.Provider>
    );
}
export default GameServiceProvider;