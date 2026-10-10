import { Anchor, Button, Center, Container, Group, Loader, Text } from "@mantine/core";
import { Link, Navigate, Route, Routes } from "react-router";
import { DeckAuthProvider } from "./DeckAuthProvider";
import { useDeckAuth } from "./deckAuthContext";
import { headerButtonStyle } from "./styles";
import AuthPage from "./AuthPage";
import DeckListPage from "./DeckListPage";
import CreateDeckPage from "./CreateDeckPage";
import ManageDeckPage from "./ManageDeckPage";

const DeckRoutes = () => {
  const { account, loading, logout } = useDeckAuth();

  if (loading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }
  if (!account) return <AuthPage />;

  return (
    <>
      <header
        style={{
          backgroundColor: "light-dark(var(--mantine-color-blue-6), var(--mantine-color-dark-8))",
          marginBottom: 30,
        }}
      >
        <Container size="md" h={56}>
          <Group justify="space-between" h="100%">
            <Group gap="lg">
              <Anchor component={Link} to="/decks" c="white" fw={600}>
                My Decks
              </Anchor>
              <Anchor component={Link} to="/" c="white" size="sm">
                Back to game
              </Anchor>
            </Group>
            <Group gap="sm">
              <Text c="white" size="sm" visibleFrom="sm">
                {account.email}
              </Text>
              <Button size="xs" variant="outline" style={headerButtonStyle} onClick={() => void logout()}>
                Log out
              </Button>
            </Group>
          </Group>
        </Container>
      </header>
      <Container size="xl" pb="xl">
        <Routes>
          <Route index element={<DeckListPage />} />
          <Route path="create" element={<CreateDeckPage />} />
          <Route path=":deckId" element={<ManageDeckPage />} />
          <Route path="*" element={<Navigate to="/decks" replace />} />
        </Routes>
      </Container>
    </>
  );
};

const DecksApp = () => (
  <DeckAuthProvider>
    <DeckRoutes />
  </DeckAuthProvider>
);

export default DecksApp;
