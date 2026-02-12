import { Button, Container, Grid,  Title, Stack, Box } from "@mantine/core";
import { useAuth, useGame } from "../hooks";
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
                    <PlayCardButton />
                    <SelectWinnerButton />
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
                size="md"
                w="350px"
                onClick={undoPlay}
                c="white"
            >
                Undo
            </Button>
        )
    }
    return (
        <Button
            size="md"
            w="350px"
            disabled={!selectedWhiteCard}
            onClick={playSelectedCard}
            c="white"
        >
            Play Card
        </Button>
    );
};

export default RoundArea;
