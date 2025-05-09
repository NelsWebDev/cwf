import { IconCardsFilled, IconLogout,  IconSettingsFilled, IconStar } from '@tabler/icons-react';
import { Button, Container, CSSProperties, Group, Modal } from '@mantine/core';
import { useAuth, useGame } from '../hooks';
import SettingsPane from './SettingsPane';
import { useState } from 'react';
import ThemeSelector from './ThemeSelector';

const navButtonStyle: CSSProperties = {
  color: 'var(--mantine-color-white)',
  background: "transparent",
}

export function HeaderMenu() {
  const { gameStarted, startGame, endGame } = useGame();
  const [opened, setOpened] = useState(false);
  const { logout } = useAuth();
  const show = () => setOpened(true);
  return (
    <>
      {opened && (<Modal size="xl"
        opened={opened} onClose={() =>

          setOpened(false)} title="Settings" centered>
        <SettingsPane />
      </Modal>)}
      <header style={{
        height: "56px",
        marginBottom: "30px",
        backgroundColor: "light-dark(var(--mantine-color-blue-6), var(--mantine-color-dark-8))",
        borderBottom: "1px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4))"
      }}>
        <Container size="md">
          <div style={{
            height: "56px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span id="logo" style={{ color: "white" }}>Cards With Friends</span>
            <Group gap={5} visibleFrom="sm">
              {!gameStarted && (
                <Button size="md"
                  style={navButtonStyle}
                  leftSection={<IconCardsFilled size={16} />}
                  color="yellow" onClick={startGame}>
                  Start
                </Button>
              )}
              {gameStarted && (<Button size="md"
                style={navButtonStyle}
                leftSection={<IconStar size={16} />} onClick={endGame}
              >
                End Game
              </Button>)}
              <Button
                style={navButtonStyle}
                size="md" leftSection={<IconSettingsFilled size={16} />} onClick={show}>
                Settings
              </Button>
              <ThemeSelector/>
              <Button size="md" style={navButtonStyle} leftSection={<IconLogout size={16} />} color="red" onClick={logout}>
                Logout
              </Button>
            </Group>
          </div>
        </Container>
      </header>
    </>
  );
}