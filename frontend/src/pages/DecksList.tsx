import { Alert, Button, Container, Input, Modal, Table, Textarea, } from "@mantine/core";
import { Form, useForm } from "@mantine/form";
import { modals, useModals } from "@mantine/modals";
import { IconTrashFilled } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { CardDeck } from "../types";

const getDecks = async () => {
    try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/decks`);
        return await res.json() as Promise<CardDeck[]>;
    }
    catch (error) {
        console.error("Failed to fetch decks:", error);
        return [];
    }
}

const CreateModal = ({ decks, opened, setOpened }: { decks: CardDeck[], opened: boolean, setOpened: React.Dispatch<React.SetStateAction<boolean>> }) => {
    const navigate = useNavigate();
    const createModalReq = useMemo(() => async (values: { name: string; description: string }) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/decks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(values),
            });
            return res.json() as Promise<{ deck: CardDeck } | { error: string }>;
        }
        catch (error) {
            return { error: "Failed to create deck" }
        }
    }, []);

    const form = useForm({
        initialValues: {
            name: '',
            description: '',
        },
        validate: {
            name: (value) => (value.length < 1 ? 'Name is required' :
                decks.find(deck => deck.name === value) ? 'Deck name already in use' : null),
        },
        onSubmitPreventDefault: "always",
        clearInputErrorOnChange: true,
    });

    return (
        <Modal opened={opened} onClose={() => setOpened(false)} title="Create New Deck" centered>
            {Object.entries(form.errors).length > 0 && (
                <Alert itemType="error" my="md"> {
                    Object.entries(form.errors).map(([field, error]) => (
                        <div key={field}>{error}</div>
                    ))
                }</Alert>)}
            <Form form={form}
                onSubmit={async () => {
                    const req = await createModalReq({
                        name: form.values.name,
                        description: form.values.description
                    });
                    if ("error" in req) {
                        form.setErrors({ error: req.error });
                    }
                    else {
                        navigate("/decks/" + req.deck.id, {
                            relative: "path"
                        });
                        modals.closeAll();
                    }
                }}
            >
                <Input
                    name="Deck Name"
                    placeholder="Enter deck name"
                    {...form.getInputProps('name')}
                    error={form.errors.name}
                    withErrorStyles={true}
                    my="md"
                />
                <Textarea
                    name="Description"
                    placeholder="Enter deck description"
                    {...form.getInputProps('description')}
                    error={form.errors.description}
                    withErrorStyles={true}
                    my="md"
                />
                <Button
                    mt="md"
                    type={"submit"}
                >
                    Create Deck
                </Button>
            </Form>
        </Modal>
    )
}






export const DecksList = () => {
    const modals = useModals();
    const [decks, setDecks] = useState<CardDeck[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const navigate = useNavigate();
    useEffect(() => {
        getDecks().then(setDecks);
    }, [decks]);

    const performDelete = useMemo(() => async (deckId: string) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/decks/${deckId}`, {
                method: "DELETE",
            });
            if (res.status === 204) {
                const modal = modals.openModal({
                    title: 'Deck Deleted',
                    withCloseButton: false,
                    children: (
                        <p>The deck has been successfully deleted.</p>
                    ),
                    closeOnEscape: true,
                    closeOnClickOutside: true,
                });
                setTimeout(() => modals.closeModal(modal), 1_000);
                const filteredDecks = decks.filter((deck) => deck.id !== deckId);
                setDecks(filteredDecks);
                return true;
            }
            else {
                console.error("Failed to delete deck:", await res.text());
                return false;
            }
        }
        catch (error) {
            console.error("Failed to delete deck:", error);
            return false;
        }
    }, []);
    const deleteDeck = useMemo(() => async (deckId: string) => {
        modals.openConfirmModal({
            title: 'Delete Deck',
            children: (
                <p>Are you sure you want to delete this deck? This action cannot be undone.</p>
            ),
            labels: { confirm: 'Delete', cancel: 'Cancel' },
            onConfirm: async () => {
                await performDelete(deckId);
            },
        })
    }, [decks])

    const rows = decks.map((element) => (
        <Table.Tr key={element.id}>
            <Table.Td onClick={() => navigate(`/decks/${element.id}`)}>{element.name}</Table.Td>
            <Table.Td onClick={() => navigate(`/decks/${element.id}`)}>{element.description}</Table.Td>
            <Table.Td><Link to={`/decks/${element.id}`}>Edit</Link></Table.Td>
            <Table.Td><Button onClick={() => deleteDeck(element.id)} size="compact-sm" color="red"><IconTrashFilled /></Button></Table.Td>
        </Table.Tr>
    ));




    return (
        <Container>
            <CreateModal decks={decks} opened={showCreateModal} setOpened={setShowCreateModal} />
            <Button mb="md" onClick={() => setShowCreateModal(true)}>
                Create New Deck
            </Button>
            <Table>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Name</Table.Th>
                        <Table.Th>Description</Table.Th>
                        <Table.Th colSpan={2}>Actions</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{rows}</Table.Tbody>
            </Table>

        </Container>
    )
}