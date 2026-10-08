import { useState } from "react";
import { Button, Group, Text, Container, Grid,  Title, Stack, Box } from "@mantine/core";
import { useAuth, useGame, useModal } from "../hooks";
import SettingsPane from "./SettingsPane";
import BlackCard from "./BlackCard";
import { CardState, RoundStatus } from "../types";
import WhiteCard from "./WhiteCard";

const RoundArea = () => {
    const { gameStarted, currentRound, isCardCzar, selectedWhiteCard, } = useGame();

    if (!gameStarted) {
        return (
            <Container>
                <Title order={2}>Game Settings</Title>
                <SettingsPane />
            </Container>
        );
    }

    return (
        <Grid columns={12} grow mt="xl">
            <Grid.Col span={3}>
                <Stack gap="md">
                    <BlackCard />
                    <Group gap="xs" wrap="nowrap" w="350px">
                        <PlayCardButton />
                        <NewHandButton />
                    </Group>
                    <SelectWinnerButton />
                    <ShareToDiscordButton />
                </Stack>
            </Grid.Col>
            <Grid.Col span={9}>
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                        alignItems: "flex-start"
                    }}
                >
                    {currentRound &&
                        Object.entries(currentRound.plays).map(([userId, cards]) => {
                            return (
                                <Box p="sm">
                                    {cards.length === 0 && (
                                        <WhiteCard
                                        data={{
                                            id: "",
                                            deckIds: [],
                                            text: "",
                                            createdAt: new Date(),
                                            updatedAt: new Date(),
                                            isCustom: false,
                                            state: CardState.IN_USE,
                                        }}
                                        />
                                    )}

                                    {
                                        cards.map((card) => (
                                            <WhiteCard
                                                ownerId={currentRound.status === RoundStatus.SHOWING_WINNER ? userId : undefined}
                                                key={card.id}
                                                data={card}
                                                selected={
                                                    (selectedWhiteCard?.id === card.id && isCardCzar) ||
                                                    currentRound?.winnerId === userId
                                                }
                                                disabled={
                                                    !isCardCzar || currentRound.status !== RoundStatus.SELECTING_WINNER
                                                }
                                                animate={
                                                    isCardCzar && currentRound.status === RoundStatus.SELECTING_WINNER
                                                }
                                            />
                                        ))
                                    }
                                </Box>
                            )
                        }

                        )}
                </div>
            </Grid.Col>


        </Grid>
    );
};

const SelectWinnerButton = () => {
    const { user } = useAuth();
    const { currentRound, selectedWhiteCard, pickWinner } = useGame();

    if (user?.id !== currentRound?.cardCzarId) return null;
    if (currentRound?.status !== RoundStatus.SELECTING_WINNER) return null;

    return (
        <Button
            size="md"
            w="350px"
            disabled={!selectedWhiteCard}
            onClick={() => {
                if (selectedWhiteCard) {
                    pickWinner(selectedWhiteCard.id);
                }
            }}
            c="white"
        >
            Select Winner
        </Button>
    );
};

const ShareToDiscordButton = () => {
    const { currentRound, shareRoundToDiscord } = useGame();
    const [sharedRoundId, setSharedRoundId] = useState<string>();
    const [loading, setLoading] = useState(false);

    if (currentRound?.status !== RoundStatus.SHOWING_WINNER) return null;
    // Rounds won automatically (everyone else sat out) have no cards to share.
    if (!Object.values(currentRound.plays).some((cards) => cards.length > 0)) return null;

    return (
        <Button
            size="md"
            w="350px"
            loading={loading}
            disabled={sharedRoundId === currentRound.id}
            onClick={async () => {
                setLoading(true);
                if (await shareRoundToDiscord()) setSharedRoundId(currentRound.id);
                setLoading(false);
            }}
            c="white"
        >
            {sharedRoundId === currentRound.id ? "Shared to Discord" : "Share to Discord"}
        </Button>
    );
};

const PlayCardButton = () => {
    const {
        selectedWhiteCard,
        playSelectedCard,
        undoPlay,
        isCardCzar,
        currentRound,
        playedCards,
    } = useGame();
    
    
    if (isCardCzar || currentRound?.status !== RoundStatus.WAITING_FOR_PLAYERS) return null;
    
    if(playedCards.length === currentRound.blackCard.pick) {
        return (
            <Button
                size="sm"
            style={{ flex: 1 }}
                onClick={undoPlay}
                c="white"
            >
                Undo
            </Button>
        )
    }
    return (
        <Button
            size="sm"
            style={{ flex: 1 }}
            disabled={!selectedWhiteCard}
            onClick={playSelectedCard}
            c="white"
        >
            Play Card
        </Button>
    );
};

export default RoundArea;

const NewHandButton = () => {
    const { isCardCzar, currentRound, players, requestNewHand } = useGame();
    const { user } = useAuth();
    const { showModal, closeModal } = useModal();

    if (!user || isCardCzar || currentRound?.status !== RoundStatus.WAITING_FOR_PLAYERS) return null;
    if (currentRound.sittingOut.includes(user.id)) {
        return <Text ta="center" size="sm"
            style={{ flex: 1 }}>You are sitting out this round</Text>;
    }

    const remaining = players.find((p) => p.id === user.id)?.newHandsRemaining ?? 0;
    if (remaining <= 0) return null;
    const hasPlayed = (currentRound.plays[user.id]?.length ?? 0) > 0;
    const confirm = () => showModal({
        title: "Get a new hand?",
        element: (
            <Stack>
                <Text>
                    You will sit out this round and lose all of your current cards in exchange
                    for an entirely new hand. This cannot be undone. You have {remaining} new
                    hand{remaining === 1 ? "" : "s"} left this game.
                </Text>
                <Button color="red" onClick={() => { closeModal(); requestNewHand(); }}>
                    Sit out and get new hand
                </Button>
                <Button variant="default" onClick={closeModal}>Cancel</Button>
            </Stack>
        ),
    });

    return (
        <Button
            size="sm"
            style={{ flex: 1 }}
            c="white"
            disabled={hasPlayed}
            onClick={confirm}
        >
            New Hand ({remaining} left)
        </Button>
    );
};
