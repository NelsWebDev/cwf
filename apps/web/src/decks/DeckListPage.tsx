import { useEffect, useState } from "react";
import { Alert, Button, Card, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router";
import { deckApi, type DeckSummary } from "./api";
import { getErrorMessage } from "../utils";

const DeckListPage = () => {
  const [decks, setDecks] = useState<DeckSummary[]>();
  const [error, setError] = useState("");

  useEffect(() => {
    deckApi
      .listDecks()
      .then(({ decks }) => setDecks(decks))
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>My decks</Title>
        <Button component={Link} to="/decks/create">
          Create deck
        </Button>
      </Group>
      {error && <Alert color="red">{error}</Alert>}
      {!decks && !error && <Loader />}
      {decks?.length === 0 && <Text c="dimmed">You haven't created any decks yet.</Text>}
      {decks?.map((deck) => (
        <Card key={deck.id} withBorder component={Link} to={`/decks/${deck.id}`}>
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Text fw={600}>{deck.name}</Text>
              {deck.description && (
                <Text size="sm" c="dimmed" lineClamp={2}>
                  {deck.description}
                </Text>
              )}
            </div>
            <Text size="sm" c="dimmed" ta="right">
              {deck.numberOfBlackCards} black · {deck.numberOfWhiteCards} white
            </Text>
          </Group>
        </Card>
      ))}
    </Stack>
  );
};

export default DeckListPage;
