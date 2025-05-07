import { ReactElement, useEffect, useMemo, useState } from "react";
import { CardDeck, DEFAULT_RULES, GameRound, GameService, RoundStatus, Rules, User, WhiteCard } from "../types";
import { useAuth, useModal } from "../hooks";
import { Button, Text } from "@mantine/core";
import { GameServiceContext } from "./Contexts";



const NotEnoughPlayers = ({endGame}: {endGame: () => void}) => {
    return (
        <>
            <Text style={{lineHeight: "1rem"}}>There are now less than three players. Please wait til someone joins, or press "End Game"</Text>
            <Button onClick={endGame} mt="lg">
                End Game
            </Button>
        </>
    )
}

const GameServiceProvider = ({ children }: { children: ReactElement }) => {

    const { socket, user } = useAuth();

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



    useEffect(() => {
        socket.emit("getGame");
        socket.emit("myHand");
        socket.on('players', (data: User[]) => {
            setPlayers(data);
        });
        socket.on('rules', (data: Rules) => {
            setRules(data);
        });
        socket.on('decks', (decks) => {
            setCardDecks(decks);
        });

        socket.on("playerJoined", (data: User) => {
            setPlayers((prev) => [...prev, data]);
        });
        socket.on("playerLeft", (userId: string) => {
            setPlayers((prev) => prev.filter((p) => p.id !== userId));
        });
        socket.on("myHand", (hand: WhiteCard[]) => {
            setMyHand(hand);
            console.log(hand);
        });
        socket.on("game", ({ rules, players, decks, currentRound }) => {
            setCardDecks(decks);
            setRules(rules);
            setPlayers(players);
            setCurrentRound(currentRound);
        });

        socket.on("givenCards", (cards: WhiteCard[]) => {
            setMyHand(prev => [...prev, ...cards]);
        });
        socket.on("rules", (rules: Rules) => {
            setRules(rules);
        });

        socket.on("gameEnded", (username) => {
            setSelectedWhiteCard(undefined);
            setMyHand([]);
            showModal({ title: "Game ended", message: "The game has ended" + (username ? ` and ${username} won` : ""), element: <></>, autoclose: 3_000 });
        });

        socket.on("holdGame", () => {
            showModal({ title: "Game on hold", element: <NotEnoughPlayers endGame={endGame}/>, canClose: false });
        });

        socket.on("winnerSelected", (czarId) => {
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
        });

        return () => {
            socket.off('players');
            socket.off('rules');
            socket.off('decks');
            socket.off("playerJoined");
            socket.off("playerLeft");
            socket.off("game");
            socket.off("rules");
            socket.off("myHand");
            socket.off("givenCards");
            socket.off("winnerSelected");
        }



    }, [socket.connected]);

    const setRule = <K extends keyof Rules>(key: K, value: Rules[K]) => {
        socket.emit("updateRules", { [key]: value });
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

        socket.emit("startGame");
    }

    const importDeck = (deckId: string) => {
        if (!deckId) {
            setAddDeckError("Please enter a deck ID");
            return;
        }
        setAddedDeck(undefined);
        const formattedID = deckId.trim().replace("https://cast.clrtd.com/deck/", "").replace("https://cast.clrtd.com/account/edit/", "")
        if (!formattedID.match(/[A-Z0-9]{5}/)) {
            setAddDeckError("Invalid deck ID");
            return;
        }

        setAddDeckError(undefined);
        fetch(import.meta.env.VITE_API_URL + "/api/decks/import", {
            method: "POST",
            body: JSON.stringify({
                deckId: formattedID,
            }),
            headers: {
                "Content-Type": "application/json",
            }
        }).then((response) => {
            if (response.ok || response.status === 500) {
                response.json().then((data) => {
                    if (data.error) {
                        setAddDeckError(data.error);
                        return;
                    }
                    setAddedDeck(data.deck);
                    const alreadyAdded = allDecks.find((deck) => deck.id === data.deck.id);
                    if (!alreadyAdded) {
                        setAllDecks((prev) => {
                            const newDecks = [...prev, data.deck];
                            return newDecks;
                        });
                    }
                });
            }
        });
    }
    const endGame = () => {
        socket.emit("endGame");
    }

    const playCards = (cards: WhiteCard[]) => {
        socket.emit("playCards", cards);
        setPlayedCards(cards);
    }

    const undoPlay = () => {
        setPlayedCards([]);
        socket.emit("undoPlay");
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
    useMemo(() => {
        fetch(import.meta.env.VITE_API_URL + "/api/decks").then((response) => {
            if (response.ok) {
                response.json().then((data: CardDeck[]) => {
                    setAllDecks(data);
                });
            }
            else {
                showModal({ title: "Error", message: "Failed to fetch decks", autoclose: 3_000 });
            }
        });
    }, [])

    const pickWinner = (cardId: string) => {
        socket.emit("pickWinner", cardId);
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
        addDeck: socket.emit.bind(socket, "addDeck"),
        removeDeck: socket.emit.bind(socket, "removeDeck"),
        startGame,
        endGame, 
        kickPlayer: socket.emit.bind(socket, "kickPlayer"),
        playCards,
        undoPlay,
        pickWinner,
        setRules: (rules: Partial<Rules>) => socket.emit("updateRules", rules),
        skipBlackCard: () => socket.emit("skipBlackCard"),
        voteToSkipBlackCard: () => socket.emit("voteToSkipBlackCard", true),
    }


    return (
        <GameServiceContext.Provider value={value}>
            {children}
        </GameServiceContext.Provider>
    );
}
export default GameServiceProvider;