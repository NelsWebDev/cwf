import { useCallback, useEffect, useRef, useState } from "react";
import { ActionIcon, Alert, Badge, Box, Button, Group, Loader, Modal, SimpleGrid, Stack, Switch, Text, Textarea, TextInput, Title } from "@mantine/core";
import { IconArrowBackUp, IconCheck, IconPencil, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { DECK_LIMITS, calculatePick } from "@repo/shared/deckRules";
import { Link, useNavigate, useParams } from "react-router";
import { ApiError, deckApi, type DeckDetail } from "./api";
import { plainButtonStyle } from "./styles";
import { getErrorMessage } from "../utils";

type Kind = "black" | "white";
type CardRow = { id: string; text: string };

const cardInk = (kind: Kind) => (kind === "black" ? "#fff" : "#000");
const iconStyle = (kind: Kind) => ({ background: "transparent", color: cardInk(kind) });

const cardColors = (kind: Kind) =>
  kind === "black"
    ? { background: "#000", color: "#fff", border: "1px solid #444" }
    : { background: "#fff", color: "#000", border: "1px solid #ccc" };

const CardShell = ({ kind, children, footer }: { kind: Kind; children: React.ReactNode; footer: React.ReactNode }) => (
  <Box style={{ ...cardColors(kind), borderRadius: 6, display: "flex", flexDirection: "column", minHeight: 200 }}>
    <Box p="sm" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {children}
    </Box>
    <Group
      justify="flex-end"
      gap={4}
      px="xs"
      py={4}
      style={{ borderTop: `1px solid ${kind === "black" ? "#444" : "#ccc"}`, minHeight: 36 }}
    >
      {footer}
    </Group>
  </Box>
);

const PickLabel = ({ kind, text }: { kind: Kind; text: string }) => (
  <Text size="xs" fw={700} c={cardInk(kind)} style={{ opacity: 0.8 }}>
    PICK {calculatePick(text)}
  </Text>
);

const CardEditor = ({
  kind,
  initialText,
  placeholder,
  isNew,
  onSubmit,
  onCancel,
}: {
  kind: Kind;
  initialText: string;
  placeholder: string;
  isNew?: boolean;
  onSubmit: (text: string) => Promise<void>;
  onCancel?: () => void;
}) => {
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canSubmit = text.trim().length > 0;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      await onSubmit(text);
      if (isNew) {
        setText("");
        // Stay in the blank card so several can be added in a row.
        inputRef.current?.focus();
      }
    } catch {
      // The page already shows the error; keep the text so it can be retried.
    } finally {
      setBusy(false);
    }
  };

  return (
    <CardShell
      kind={kind}
      footer={
        <>
          {onCancel && (
            <ActionIcon variant="transparent" style={iconStyle(kind)} aria-label="Cancel" onClick={onCancel}>
              <IconX size={16} />
            </ActionIcon>
          )}
          <ActionIcon
            variant="transparent"
            style={{ ...iconStyle(kind), opacity: canSubmit ? 1 : 0.4 }}
            aria-label={isNew ? "Add card (Ctrl/Cmd+Enter)" : "Save card (Ctrl/Cmd+Enter)"}
            title={isNew ? "Add card (Ctrl/Cmd+Enter)" : "Save card (Ctrl/Cmd+Enter)"}
            disabled={!canSubmit}
            loading={busy}
            onClick={() => void submit()}
          >
            {isNew ? <IconPlus size={18} /> : <IconCheck size={16} />}
          </ActionIcon>
        </>
      }
    >
      <Textarea
        ref={inputRef}
        variant="unstyled"
        autosize
        minRows={4}
        maxLength={DECK_LIMITS.cardText}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void submit();
          }
        }}
        styles={{
          input: {
            color: cardInk(kind),
            background: "rgba(128,128,128,0.25)",
            padding: 6,
            borderRadius: 4,
            "--input-placeholder-color": kind === "black" ? "#aaa" : "#666",
          },
        }}
      />
      <Group justify={kind === "black" ? "space-between" : "flex-end"} mt="auto" pt={4}>
        {kind === "black" && <PickLabel kind={kind} text={text} />}
        <Text size="xs" c={cardInk(kind)} style={{ opacity: 0.8 }}>
          {text.length} / {DECK_LIMITS.cardText}
        </Text>
      </Group>
    </CardShell>
  );
};

const CardTile = ({
  kind,
  card,
  onSave,
  onDelete,
}: {
  kind: Kind;
  card: CardRow;
  onSave: (text: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) => {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (editing) {
    return (
      <CardEditor
        kind={kind}
        initialText={card.text}
        placeholder=""
        onCancel={() => setEditing(false)}
        onSubmit={async (text) => {
          await onSave(text);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <CardShell
      kind={kind}
      footer={
        <>
          <ActionIcon variant="transparent" style={iconStyle(kind)} aria-label="Edit card" onClick={() => setEditing(true)}>
            <IconPencil size={16} />
          </ActionIcon>
          <ActionIcon
            variant="transparent"
            style={{ background: "transparent", color: "#e03131" }}
            aria-label="Delete card"
            loading={deleting}
            onClick={() => {
              setDeleting(true);
              onDelete()
                .catch(() => undefined)
                .finally(() => setDeleting(false));
            }}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </>
      }
    >
      <Text c={cardInk(kind)} fw={500} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {card.text}
      </Text>
      {kind === "black" && (
        <Box mt="auto" pt={4}>
          <PickLabel kind={kind} text={card.text} />
        </Box>
      )}
    </CardShell>
  );
};

const DeletedTile = ({
  kind,
  card,
  recent,
  onRestore,
}: {
  kind: Kind;
  card: CardRow;
  recent?: boolean;
  onRestore: () => Promise<void>;
}) => {
  const [restoring, setRestoring] = useState(false);
  const label = recent ? "Undo" : "Restore";
  return (
    <Box
      style={{
        ...cardColors(kind),
        border: `2px dashed ${kind === "black" ? "#888" : "#999"}`,
        borderRadius: 6,
        display: "flex",
        flexDirection: "column",
        minHeight: 200,
      }}
    >
      <Box p="sm" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <Badge color="red" variant="filled" w="fit-content">
          Deleted
        </Badge>
        <Text
          c={cardInk(kind)}
          fw={500}
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", opacity: 0.55, textDecoration: "line-through" }}
        >
          {card.text}
        </Text>
      </Box>
      <Group justify="flex-end" px="xs" py={4} style={{ borderTop: `1px dashed ${kind === "black" ? "#888" : "#999"}`, minHeight: 36 }}>
        <Button
          size="compact-sm"
          variant="light"
          color="green"
          leftSection={<IconArrowBackUp size={14} />}
          loading={restoring}
          onClick={() => {
            setRestoring(true);
            onRestore()
              .catch(() => undefined)
              .finally(() => setRestoring(false));
          }}
        >
          {label}
        </Button>
      </Group>
    </Box>
  );
};

const CardColumn = ({
  kind,
  cards,
  deletedCards,
  showDeleted,
  max,
  onAdd,
  onSave,
  onDelete,
  onRestore,
}: {
  kind: Kind;
  cards: CardRow[];
  deletedCards: CardRow[];
  showDeleted: boolean;
  max: number;
  onAdd: (text: string) => Promise<void>;
  onSave: (id: string, text: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
}) => {
  // Cards deleted during this visit stay in place as an "Undo" tile so a misclick is easy to reverse.
  const [recent, setRecent] = useState<{ card: CardRow; index: number }[]>([]);
  const live = [...cards].reverse();
  const liveIds = new Set(cards.map((c) => c.id));
  const pending = recent.filter((r) => !liveIds.has(r.card.id));
  const recentIds = new Set(pending.map((r) => r.card.id));

  const items: { card: CardRow; recent: boolean }[] = live.map((card) => ({ card, recent: false }));
  for (const r of [...pending].sort((a, b) => a.index - b.index)) {
    items.splice(Math.min(r.index, items.length), 0, { card: r.card, recent: true });
  }
  const otherDeleted = deletedCards.filter((c) => !recentIds.has(c.id));

  const remove = async (card: CardRow) => {
    const index = live.findIndex((c) => c.id === card.id);
    await onDelete(card.id);
    setRecent((prev) => [...prev.filter((r) => r.card.id !== card.id), { card, index }]);
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between" style={{ borderBottom: "2px solid currentColor" }}>
        <Title order={3}>{kind === "black" ? "Black Cards" : "White Cards"}</Title>
        <Text>
          {cards.length}/{max}
        </Text>
      </Group>
      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
        <CardEditor
          isNew
          kind={kind}
          initialText=""
          placeholder={kind === "black" ? "Epic Black Card (use ___ for blanks)" : "Epic White Card"}
          onSubmit={onAdd}
        />
        {items.map(({ card, recent: isRecent }) =>
          isRecent ? (
            <DeletedTile key={card.id} kind={kind} card={card} recent onRestore={() => onRestore(card.id)} />
          ) : (
            <CardTile
              key={card.id}
              kind={kind}
              card={card}
              onSave={(text) => onSave(card.id, text)}
              onDelete={() => remove(card)}
            />
          ),
        )}
      </SimpleGrid>
      {showDeleted && (
        <Stack gap="sm">
          <Text fw={600} c="dimmed">
            Deleted {kind} cards ({otherDeleted.length})
          </Text>
          {otherDeleted.length === 0 && (
            <Text size="sm" c="dimmed">
              No other deleted cards.
            </Text>
          )}
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            {otherDeleted.map((card) => (
              <DeletedTile key={card.id} kind={kind} card={card} onRestore={() => onRestore(card.id)} />
            ))}
          </SimpleGrid>
        </Stack>
      )}
    </Stack>
  );
};

const ManageDeckPage = () => {
  const { deckId = "" } = useParams();
  const navigate = useNavigate();
  const [deck, setDeck] = useState<DeckDetail>();
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  const apply = useCallback((next: DeckDetail) => {
    setDeck(next);
    setName(next.name);
    setDescription(next.description ?? "");
  }, []);

  useEffect(() => {
    deckApi
      .getDeck(deckId)
      .then(({ deck }) => apply(deck))
      .catch((e) => (e instanceof ApiError && e.status === 404 ? setNotFound(true) : setError(getErrorMessage(e))));
  }, [deckId, apply]);

  // Card edits keep the details form untouched so unsaved name/description changes aren't lost.
  const mutateCards = async (request: () => Promise<{ deck: DeckDetail }>) => {
    setError("");
    try {
      const { deck: next } = await request();
      setDeck(next);
    } catch (e) {
      setError(getErrorMessage(e));
      throw e;
    }
  };

  if (notFound) {
    return (
      <Stack>
        <Alert color="red">Deck not found.</Alert>
        <Button component={Link} to="/decks" w="fit-content">
          Back to decks
        </Button>
      </Stack>
    );
  }
  if (!deck) return error ? <Alert color="red">{error}</Alert> : <Loader />;

  const detailsChanged = name !== deck.name || description !== (deck.description ?? "");

  const saveDetails = async () => {
    setSaving(true);
    setError("");
    try {
      apply((await deckApi.updateDeck(deck.id, { name, description })).deck);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await deckApi.deleteDeck(deck.id);
      void navigate("/decks");
    } catch (e) {
      setError(getErrorMessage(e));
      setConfirmingDelete(false);
      setDeleting(false);
    }
  };

  return (
    <Stack gap="lg">
      <Modal opened={confirmingDelete} onClose={() => !deleting && setConfirmingDelete(false)} title="Delete deck?" centered>
        <Stack>
          <Text>
            "{deck.name}" and all of its cards will be permanently deleted. This cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" style={plainButtonStyle} disabled={deleting} onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button color="red" loading={deleting} onClick={() => void remove()}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Group justify="space-between">
        <Title order={2}>{deck.name}</Title>
        <Group>
          <Button color="red" variant="outline" style={plainButtonStyle} onClick={() => setConfirmingDelete(true)}>
            Delete
          </Button>
          <Button component={Link} to="/decks" variant="default" style={plainButtonStyle}>
            Back
          </Button>
        </Group>
      </Group>
      {error && (
        <Alert color="red" withCloseButton onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      <Stack gap="xs">
        <TextInput
          label="Name"
          maxLength={DECK_LIMITS.name}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          rightSection={<Text size="xs">{name.length} / {DECK_LIMITS.name}</Text>}
          rightSectionWidth={60}
        />
        <Textarea
          label="Description"
          maxLength={DECK_LIMITS.description}
          autosize
          minRows={2}
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          description={`${description.length} / ${DECK_LIMITS.description}`}
        />
        <Button w="fit-content" loading={saving} disabled={!detailsChanged || !name.trim()} onClick={() => void saveDetails()}>
          Save
        </Button>
      </Stack>
      <Switch
        label={`Show deleted cards (${deck.deletedBlackCards.length + deck.deletedWhiteCards.length})`}
        checked={showDeleted}
        onChange={(e) => setShowDeleted(e.currentTarget.checked)}
      />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
        <CardColumn
          kind="black"
          cards={deck.blackCards}
          deletedCards={deck.deletedBlackCards}
          showDeleted={showDeleted}
          max={DECK_LIMITS.blackCards}
          onAdd={(text) => mutateCards(() => deckApi.addCard(deck.id, "black", text))}
          onSave={(id, text) => mutateCards(() => deckApi.updateCard(deck.id, "black", id, text))}
          onDelete={(id) => mutateCards(() => deckApi.deleteCard(deck.id, "black", id))}
          onRestore={(id) => mutateCards(() => deckApi.restoreCard(deck.id, "black", id))}
        />
        <CardColumn
          kind="white"
          cards={deck.whiteCards}
          deletedCards={deck.deletedWhiteCards}
          showDeleted={showDeleted}
          max={DECK_LIMITS.whiteCards}
          onAdd={(text) => mutateCards(() => deckApi.addCard(deck.id, "white", text))}
          onSave={(id, text) => mutateCards(() => deckApi.updateCard(deck.id, "white", id, text))}
          onDelete={(id) => mutateCards(() => deckApi.deleteCard(deck.id, "white", id))}
          onRestore={(id) => mutateCards(() => deckApi.restoreCard(deck.id, "white", id))}
        />
      </SimpleGrid>
    </Stack>
  );
};

export default ManageDeckPage;
