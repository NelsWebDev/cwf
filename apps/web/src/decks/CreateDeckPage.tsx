import { useState, type FormEvent } from "react";
import { Alert, Button, Group, Stack, Textarea, TextInput, Title } from "@mantine/core";
import { Link, useNavigate } from "react-router";
import { DECK_LIMITS } from "@repo/shared/deckRules";
import { plainButtonStyle } from "./styles";
import { deckApi } from "./api";
import { getErrorMessage } from "../utils";

const CreateDeckPage = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { deck } = await deckApi.createDeck(name, description);
      void navigate(`/decks/${deck.id}`);
    } catch (e) {
      setError(getErrorMessage(e));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)}>
      <Stack>
        <Title order={2}>Create deck</Title>
        {error && <Alert color="red">{error}</Alert>}
        <TextInput label="Name" required maxLength={DECK_LIMITS.name} value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <Textarea
          label="Description"
          maxLength={DECK_LIMITS.description}
          autosize
          minRows={2}
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
        <Group>
          <Button type="submit" loading={submitting}>
            Create
          </Button>
          <Button component={Link} to="/decks" variant="subtle" style={plainButtonStyle}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </form>
  );
};

export default CreateDeckPage;
