import { Accordion, Card, Table, Text, Title } from "@mantine/core";
import { useGame } from "../hooks";
import { GameRound, RoundStatus, User } from "../types";

const getPlayerState = (player: User, currentRound?: GameRound) => {
  if (player.isCardCzar && currentRound?.status !== RoundStatus.SHOWING_WINNER) {
    return (
      <Text fw="bold" display="inline">
        {currentRound?.status === RoundStatus.SELECTING_WINNER ? "Voting..." : "Card Czar"}
      </Text>
    );
  }

  if (currentRound?.status === RoundStatus.SHOWING_WINNER && currentRound.winnerId === player.id) {
    return (
      <Text fw="bold" display="inline">
        Winner!
      </Text>
    );
  }

  if (currentRound?.status !== RoundStatus.WAITING_FOR_PLAYERS) {
    return "";
  }

  return !(player.id in currentRound.plays) ? (
    <Text display="inline">Selecting...</Text>
  ) : "";
};

const Scoreboard = () => {
  const { players, currentRound } = useGame();

  return (
    <Card
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "400px",
        zIndex: 5,
        maxHeight: "30vh",
        backgroundColor: "light-dark(white, var(--mantine-color-dark-6))",
        boxShadow: "none",
        border: "none",
        padding: 0,
      }}
    >
      <Accordion
        defaultValue="scoreboard"
        variant="contained"
        styles={{
          item: { backgroundColor: "inherit" },
          control: { backgroundColor: "inherit" },
          panel: { backgroundColor: "inherit" },
        }}
      >
        <Accordion.Item value="scoreboard">
          <Accordion.Control>
            <Title order={3}>Scoreboard</Title>
          </Accordion.Control>
          <Accordion.Panel>
            <div style={{ maxHeight: "20vh", overflowY: "auto" }}>
              <Table
                withColumnBorders={false}
                striped={false}
                highlightOnHover={false}
                style={{
                  backgroundColor: "inherit",
                }}
              >
                <Table.Tbody>
                  {players.map((player) => (
                    <Table.Tr
                      key={"scoreboard-" + player.id}
                      style={{ backgroundColor: "inherit" }}
                    >
                      <Table.Td style={{ margin: 0, paddingTop: 0, paddingBottom: 0 }}>
                        <Text fw="bold">{player.username}</Text>
                        <Text fw="normal">{player.points} Points</Text>
                      </Table.Td>
                      <Table.Td align="right" valign="middle">
                        <Text size="sm">{getPlayerState(player, currentRound)}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Card>
  );
};

export default Scoreboard;
