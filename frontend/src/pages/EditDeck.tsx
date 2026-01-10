import {
    Button,
    CloseButton,
    Container,
    Grid,
    Group,
    Paper,
    Text,
    Textarea,
    TextInput,
    Title,
} from "@mantine/core";
import { useModals } from "@mantine/modals";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import type {
    PartialBlackCard as BlackCard,
    PopulatedCardDeck as PopulatedDeck,
    PartialWhiteCard as WhiteCard
} from "../types/shared";



type DeletedSlot<T> = {
    kind: "deleted";
    slotId: string; // stable key for rendering at this position
    card: T; // original card for undo
};

type Slot<T> = T | DeletedSlot<T>;

const isDeletedSlot = <T,>(x: Slot<T>): x is DeletedSlot<T> =>
    typeof x === "object" && x !== null && (x as any).kind === "deleted";

const fetchDeck = async (deckId: string): Promise<PopulatedDeck> => {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/decks/${deckId}`);
    return await res.json();
};

const countSoloUnderscores = (text: string): number => {
    if (!text.includes("_")) return 0;
    const matches = text.match(/_+/g);
    return matches ? matches.length : 0;
};

// ------------------ Inline Deleted Placeholder ------------------

const DeletedCardPlaceholder = memo(function DeletedCardPlaceholder({
    label,
    onUndo,
    variant,
}: {
    label: string;
    onUndo: () => void;
    variant: "light" | "dark";
}) {
    const bg = variant === "dark" ? "dark.6" : "gray.1";
    const textColor = variant === "dark" ? "gray.0" : "dark";

    return (
        <Paper
            withBorder
            radius="md"
            p="md"
            bg={bg}
            c={textColor}
            style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: "0.25rem",
                textAlign: "center",
            }}
        >
            <Text size="sm">{label}</Text>
            <Button variant="subtle" size="xs" onClick={onUndo} color={variant === "dark" ? "gray" : "blue"}>
                Undo
            </Button>
        </Paper>
    );
});

// ------------------ Memoized Card Items ------------------
// Textarea is UNCONTROLLED (defaultValue) and commits onBlur for performance.

const WhiteCardItem = memo(function WhiteCardItem({
    card,
    onDelete,
    onCommit,
}: {
    card: WhiteCard;
    onDelete: (id: string) => void;
    onCommit: (id: string, value: string) => void;
}) {
    const handleDelete = useCallback(() => onDelete(card.id), [card.id, onDelete]);

    const handleBlur = useCallback(
        (e: React.FocusEvent<HTMLTextAreaElement>) => {
            onCommit(card.id, e.currentTarget.value);
        },
        [card.id, onCommit]
    );

    return (
        <Paper
            withBorder
            shadow="sm"
            radius="md"
            p="md"
            bg="gray.0"
            style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                position: "relative",
                paddingTop: "2rem",
            }}
        >
            <CloseButton
                aria-label="Delete white card"
                size="sm"
                onClick={handleDelete}
                style={{ position: "absolute", top: 8, right: 8, zIndex: 10 }}
            />

            <Textarea
                key={`${card.id}:${card.text}`}
                defaultValue={card.text}
                onBlur={handleBlur}
                minRows={4}
                maxRows={8}
            />
        </Paper>
    );
});

const BlackCardItem = memo(function BlackCardItem({
    card,
    onDelete,
    onCommitText,
    onPickChange,
}: {
    card: BlackCard;
    onDelete: (id: string) => void;
    onCommitText: (id: string, value: string) => void;
    onPickChange: (id: string, value: string) => void;
}) {
    const handleDelete = useCallback(() => onDelete(card.id), [card.id, onDelete]);

    const handleBlur = useCallback(
        (e: React.FocusEvent<HTMLTextAreaElement>) => {
            onCommitText(card.id, e.currentTarget.value);
        },
        [card.id, onCommitText]
    );

    const handlePickChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => onPickChange(card.id, e.currentTarget.value),
        [card.id, onPickChange]
    );

    return (
        <Paper
            withBorder
            shadow="sm"
            radius="md"
            p="md"
            bg="dark.7"
            c="gray.0"
            style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                position: "relative",
                paddingTop: "2rem",
            }}
        >
            <CloseButton
                aria-label="Delete black card"
                size="sm"
                onClick={handleDelete}
                style={{ position: "absolute", top: 8, right: 8, zIndex: 10 }}
                variant="white"
            />

            <Textarea
                key={`${card.id}:${card.text}`}
                defaultValue={card.text}
                onBlur={handleBlur}
                minRows={4}
                maxRows={8}
            />

            <TextInput
                label="Pick"
                type="number"
                min={1}
                value={String(card.pick ?? 1)}
                onChange={handlePickChange}
            />
        </Paper>
    );
});

// ------------------ Main Component ------------------

export const EditDeck = () => {
    const { deckId } = useParams<{ deckId: string }>();
    const navigate = useNavigate();
    const modals = useModals();

    const [deck, setDeck] = useState<PopulatedDeck>();
    const [whiteSlots, setWhiteSlots] = useState<Slot<WhiteCard>[]>([]);
    const [blackSlots, setBlackSlots] = useState<Slot<BlackCard>[]>([]);

    // Timers per deleted placeholder (so undo can cancel, and new deletes don't leak timers)
    const whiteDeleteTimers = useRef(new Map<string, number>());
    const blackDeleteTimers = useRef(new Map<string, number>());

    const clearAllTimers = useCallback(() => {
        for (const t of whiteDeleteTimers.current.values()) window.clearTimeout(t);
        for (const t of blackDeleteTimers.current.values()) window.clearTimeout(t);
        whiteDeleteTimers.current.clear();
        blackDeleteTimers.current.clear();
    }, []);

    useEffect(() => {
        if (!deckId) return;

        fetchDeck(deckId).then((d) => {
            clearAllTimers();
            setDeck(d);
            setWhiteSlots(d.whiteCards);
            setBlackSlots(d.blackCards);
        });

        return () => {
            clearAllTimers();
        };
    }, [deckId, clearAllTimers]);

    const handleDeckFieldChange = useCallback((field: "name" | "description", value: string) => {
        setDeck((prev) => (prev ? { ...prev, [field]: value } : prev));
    }, []);

    const prependWhiteCard = useCallback(() => {
        const newCard: WhiteCard = { id: crypto.randomUUID(), text: "" };
        setWhiteSlots((prev) => [newCard, ...prev]);
    }, []);

    const prependBlackCard = useCallback(() => {
        const newCard: BlackCard = { id: crypto.randomUUID(), text: "", pick: 1 };
        setBlackSlots((prev) => [newCard, ...prev]);
    }, []);

    // Permanently remove helpers (by slotId, safe even if indices shifted)
    const permanentlyRemoveWhiteSlot = useCallback((slotId: string) => {
        setWhiteSlots((prev) => prev.filter((s) => !(isDeletedSlot(s) && s.slotId === slotId)));
        const timer = whiteDeleteTimers.current.get(slotId);
        if (timer) window.clearTimeout(timer);
        whiteDeleteTimers.current.delete(slotId);
    }, []);

    const permanentlyRemoveBlackSlot = useCallback((slotId: string) => {
        setBlackSlots((prev) => prev.filter((s) => !(isDeletedSlot(s) && s.slotId === slotId)));
        const timer = blackDeleteTimers.current.get(slotId);
        if (timer) window.clearTimeout(timer);
        blackDeleteTimers.current.delete(slotId);
    }, []);

    // Delete -> replace in place + schedule permanent removal in 3s
    const deleteWhiteCard = useCallback(
        (id: string) => {
            const slotId = crypto.randomUUID();

            setWhiteSlots((prev) => {
                const index = prev.findIndex((s) => !isDeletedSlot(s) && (s as WhiteCard).id === id);
                if (index === -1) return prev;

                const card = prev[index] as WhiteCard;
                const tombstone: DeletedSlot<WhiteCard> = { kind: "deleted", slotId, card };

                const next = [...prev];
                next[index] = tombstone;
                return next;
            });

            // schedule permanent removal
            const t = window.setTimeout(() => permanentlyRemoveWhiteSlot(slotId), 3000);
            whiteDeleteTimers.current.set(slotId, t);
        },
        [permanentlyRemoveWhiteSlot]
    );

    const deleteBlackCard = useCallback(
        (id: string) => {
            const slotId = crypto.randomUUID();

            setBlackSlots((prev) => {
                const index = prev.findIndex((s) => !isDeletedSlot(s) && (s as BlackCard).id === id);
                if (index === -1) return prev;

                const card = prev[index] as BlackCard;
                const tombstone: DeletedSlot<BlackCard> = { kind: "deleted", slotId, card };

                const next = [...prev];
                next[index] = tombstone;
                return next;
            });

            const t = window.setTimeout(() => permanentlyRemoveBlackSlot(slotId), 3000);
            blackDeleteTimers.current.set(slotId, t);
        },
        [permanentlyRemoveBlackSlot]
    );

    // Undo -> swap back and cancel timer
    const undoWhiteAtIndex = useCallback((index: number) => {
        setWhiteSlots((prev) => {
            const slot = prev[index];
            if (!slot || !isDeletedSlot(slot)) return prev;

            const timer = whiteDeleteTimers.current.get(slot.slotId);
            if (timer) window.clearTimeout(timer);
            whiteDeleteTimers.current.delete(slot.slotId);

            const next = [...prev];
            next[index] = slot.card;
            return next;
        });
    }, []);

    const undoBlackAtIndex = useCallback((index: number) => {
        setBlackSlots((prev) => {
            const slot = prev[index];
            if (!slot || !isDeletedSlot(slot)) return prev;

            const timer = blackDeleteTimers.current.get(slot.slotId);
            if (timer) window.clearTimeout(timer);
            blackDeleteTimers.current.delete(slot.slotId);

            const next = [...prev];
            next[index] = slot.card;
            return next;
        });
    }, []);

    // Commit handlers (onBlur only)
    const commitWhiteCardText = useCallback((id: string, value: string) => {
        setWhiteSlots((prev) => {
            const idx = prev.findIndex((s) => !isDeletedSlot(s) && (s as WhiteCard).id === id);
            if (idx === -1) return prev;

            const current = prev[idx] as WhiteCard;
            if (current.text === value) return prev;

            const next = [...prev];
            next[idx] = { ...current, text: value };
            return next;
        });
    }, []);

    const commitBlackCardText = useCallback((id: string, value: string) => {
        setBlackSlots((prev) => {
            const idx = prev.findIndex((s) => !isDeletedSlot(s) && (s as BlackCard).id === id);
            if (idx === -1) return prev;

            const current = prev[idx] as BlackCard;

            const pickFromText = countSoloUnderscores(value);
            const nextPick = pickFromText > 0 ? pickFromText : current.pick ?? 1;

            const sameText = current.text === value;
            const samePick = (current.pick ?? 1) === nextPick;
            if (sameText && samePick) return prev;

            const next = [...prev];
            next[idx] = { ...current, text: value, pick: nextPick };
            return next;
        });
    }, []);

    const handleBlackCardPickChange = useCallback((id: string, value: string) => {
        const parsed = parseInt(value, 10);
        const nextPick = Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;

        setBlackSlots((prev) => {
            const idx = prev.findIndex((s) => !isDeletedSlot(s) && (s as BlackCard).id === id);
            if (idx === -1) return prev;

            const current = prev[idx] as BlackCard;
            if ((current.pick ?? 1) === nextPick) return prev;

            const next = [...prev];
            next[idx] = { ...current, pick: nextPick };
            return next;
        });
    }, []);

    const handleSaveDeck = useCallback(() => {
        if (!deck) return;

        // exclude deleted placeholders (including those waiting to be removed)
        const whiteCards = whiteSlots.filter((s): s is WhiteCard => !isDeletedSlot(s));
        const blackCards = blackSlots.filter((s): s is BlackCard => !isDeletedSlot(s));

        const payload: PopulatedDeck = { ...deck, whiteCards, blackCards };

        fetch(`${import.meta.env.VITE_API_URL}/decks/${deck.id}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        })
            .then((res) => {
                if (!res.ok) throw new Error(`Failed to save deck: ${res.statusText}`);
                return res.json();
            })
            .then(() => {
                const modal = modals.openModal({
                    title: "Deck saved",
                    children: (
                        <Text>The deck has been successfully saved.</Text>
                    ),
                    centered: true,
                    size: "sm",
                    closeOnEscape: true,
                    onClose() {
                        navigate(`/decks/`);
                    },
                    withCloseButton: true,
                    closeOnClickOutside: true,
                });
                setTimeout(() => {
                    modals.closeModal(modal);
                }, 2_000);
            })
            .catch((err) => {
                console.error(err);
                alert(`Error saving deck: ${err.message}`);
            });


    }, [deck, whiteSlots, blackSlots]);

    const topWhiteIsBlank = useMemo(() => {
        const first = whiteSlots[0];
        return !!first && !isDeletedSlot(first) && !(first as WhiteCard).text.trim();
    }, [whiteSlots]);

    const topBlackIsBlank = useMemo(() => {
        const first = blackSlots[0];
        return !!first && !isDeletedSlot(first) && !(first as BlackCard).text.trim();
    }, [blackSlots]);

    if (!deck) return <div>Loading...</div>;

    return (
        <Container size="lg" py="xl">
            <Group justify="space-between" mb="md">
                <Title order={1}>Edit Deck</Title>
                <Button onClick={handleSaveDeck} variant="filled">
                    Save deck
                </Button>
            </Group>

            <Grid gutter="md" mb="xl">
                <Grid.Col span={{ base: 12, md: 6 }}>
                    <TextInput
                        label="Deck name"
                        value={deck.name}
                        onChange={(e) => handleDeckFieldChange("name", e.currentTarget.value)}
                    />
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 6 }}>
                    <TextInput
                        label="Deck description"
                        value={deck.description ?? ""}
                        onChange={(e) => handleDeckFieldChange("description", e.currentTarget.value)}
                    />
                </Grid.Col>
            </Grid>

            <Grid gutter="xl">
                {/* White cards section */}
                <Grid.Col span={{ base: 12, md: 6 }}>
                    <Group justify="space-between" mb="md">
                        <Title order={2} size="h3">
                            White Cards
                        </Title>
                        <Button size="xs" onClick={prependWhiteCard} disabled={topWhiteIsBlank}>
                            Add white card
                        </Button>
                    </Group>

                    <Grid gutter="lg">
                        {whiteSlots.map((slot, index) => (
                            <Grid.Col
                                key={isDeletedSlot(slot) ? `deleted:${slot.slotId}` : `card:${(slot as WhiteCard).id}`}
                                span={{ base: 12, sm: 6 }}
                            >
                                {isDeletedSlot(slot) ? (
                                    <DeletedCardPlaceholder
                                        label="Card deleted."
                                        onUndo={() => undoWhiteAtIndex(index)}
                                        variant="light"
                                    />
                                ) : (
                                    <WhiteCardItem
                                        card={slot as WhiteCard}
                                        onDelete={deleteWhiteCard}
                                        onCommit={commitWhiteCardText}
                                    />
                                )}
                            </Grid.Col>
                        ))}
                    </Grid>
                </Grid.Col>

                {/* Black cards section */}
                <Grid.Col span={{ base: 12, md: 6 }}>
                    <Group justify="space-between" mb="md">
                        <Title order={2} size="h3">
                            Black Cards
                        </Title>
                        <Button size="xs" onClick={prependBlackCard} disabled={topBlackIsBlank}>
                            Add black card
                        </Button>
                    </Group>

                    <Grid gutter="lg">
                        {blackSlots.map((slot, index) => (
                            <Grid.Col
                                key={isDeletedSlot(slot) ? `deleted:${slot.slotId}` : `card:${(slot as BlackCard).id}`}
                                span={{ base: 12, sm: 6 }}
                            >
                                {isDeletedSlot(slot) ? (
                                    <DeletedCardPlaceholder
                                        label="Card deleted."
                                        onUndo={() => undoBlackAtIndex(index)}
                                        variant="dark"
                                    />
                                ) : (
                                    <BlackCardItem
                                        card={slot as BlackCard}
                                        onDelete={deleteBlackCard}
                                        onCommitText={commitBlackCardText}
                                        onPickChange={handleBlackCardPickChange}
                                    />
                                )}
                            </Grid.Col>
                        ))}
                    </Grid>
                </Grid.Col>
            </Grid>
        </Container>
    );
};

export default EditDeck;
