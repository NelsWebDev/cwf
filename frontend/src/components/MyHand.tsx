import { Accordion, Box, Center, Text } from "@mantine/core";
import { useAuth, useGame } from "../hooks";
import WhiteCard from "./WhiteCard";
import { useEffect, useState } from "react";
import { RoundStatus } from "../types";

const MyHand = () => {
  const { myHand, currentRound, gameStarted, selectedWhiteCard } = useGame();
  const { user } = useAuth();
  const isCardCzar = currentRound?.cardCzarId === user?.id;
  const [opened, setOpened] = useState(!isCardCzar);

  useEffect(() => {
    setOpened(!isCardCzar);
  }, [isCardCzar]);

  if (!gameStarted) {
    return null;
  }

  return (
    <>

      <Accordion
        value={opened ? "hand" : null}
        onChange={(value) => setOpened(value === "hand")}
        chevronSize={40} // << make the caret/arrow bigger (default is 24)
      >
        <Accordion.Item value="hand">
          <Accordion.Control
            styles={{
              label: { fontSize: '1.5rem', fontWeight: 600 }, // << bigger, bolder title
            }}
          >
            My Hand
          </Accordion.Control>
          <Accordion.Panel>
            <Box id="hand-container" style={{ position: 'relative' }}>
              <Box className="hand" style={{ display: 'inline-block' }}>
                {myHand.map((card) => (
                  <WhiteCard
                    key={card.id}
                    data={card}
                    selected={selectedWhiteCard?.id === card.id}
                    animate={!isCardCzar && currentRound?.status === RoundStatus.WAITING_FOR_PLAYERS}
                    disabled={isCardCzar || currentRound?.status !== RoundStatus.WAITING_FOR_PLAYERS}
                  />
                ))}
              </Box>

              {isCardCzar && (
                <>
                  <Box
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      zIndex: 1,
                      opacity: 0.2,
                    }}
                  />
                  <Center
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      zIndex: 2,
                      pointerEvents: 'none',
                    }}
                  >
                    <Text c="light-dark(black,white)" size="40px">
                      You are the Card Czar
                    </Text>
                  </Center>
                </>
              )}
            </Box>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </>
  );
};

export default MyHand;
