import { Button, Checkbox, Group, Input, NativeSelect, ScrollArea, SimpleGrid, Table, Tabs, Text, Title } from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconPlus, IconSearch, IconX } from "@tabler/icons-react";
import { Fragment, useMemo, useState } from "react";
import { useAuth, useGame } from "../hooks";
import PreferencesModal from "./PreferencesModal";



const MAIN_DECK_PREFIXES = ["CAH Main Deck:", "Cards Against Humanity: Main Deck"];
const CAH_PREFIX = "Cards Against Humanity:";
const CAH_MAIN_PREFIX = "CAH Main Deck:";

const isMainDeck = (name: string) => MAIN_DECK_PREFIXES.some((prefix) => name.startsWith(prefix));

const displayDeckName = (name: string) => {
    if (name.startsWith(CAH_MAIN_PREFIX)) return name.slice(CAH_MAIN_PREFIX.length).trim();
    if (name.startsWith(CAH_PREFIX)) return name.slice(CAH_PREFIX.length).trim();
    return name;
};

const SettingsPane = ({ showMySettings = false }: { showMySettings?: boolean }) => {

    return (
        <Tabs defaultValue={showMySettings ? "my" : "general"}
            styles={{
                tab: {
                    background: "light-dark(inherit, var(--mantine-color-dark-3))",
                }
            }}
        >
            <Tabs.List>
                {showMySettings && <Tabs.Tab value="my">My Settings</Tabs.Tab>}
                <Tabs.Tab value="general">
                    Rules
                </Tabs.Tab>
                <Tabs.Tab value="decks">Decks</Tabs.Tab>
                <Tabs.Tab value="import">Import Deck</Tabs.Tab>
                <Tabs.Tab value="players">Players</Tabs.Tab>
            </Tabs.List>
            {showMySettings && (
                <Tabs.Panel value="my" pt="lg">
                    <PreferencesModal />
                </Tabs.Panel>
            )}
            <Tabs.Panel value="general" pt="lg">
                <GeneralSettings />
            </Tabs.Panel>
            <Tabs.Panel value="decks" pt="lg">
                <DeckSettings />
            </Tabs.Panel>
            <Tabs.Panel value="import" pt="lg">
                <ImportDeckSettings />
            </Tabs.Panel>
            <Tabs.Panel value="players" pt="lg">
                <PlayerSettings />
            </Tabs.Panel>

        </Tabs>
    )

}

const GeneralSettings = () => {
    const { setRule, rules, gameStarted } = useGame();
    return (
        <>
            <SimpleGrid cols={2}>

                <Checkbox
                    disabled={gameStarted}
                    label="Allow Undo" checked={rules.canUndo} onChange={(e) => setRule("canUndo", e.currentTarget.checked)} />
                <Checkbox
                    disabled={gameStarted}
                    label="Cards With Multiple Answers" checked={rules.allowMultipleAnswerBlackCards} onChange={(e) => setRule("allowMultipleAnswerBlackCards", e.currentTarget.checked)} />
                <Checkbox
                    disabled={gameStarted}
                    label="Announce to Discord"
                    checked={rules.announceToDiscord}
                    onChange={(e) => setRule("announceToDiscord", e.currentTarget.checked)} />
            </SimpleGrid>
            <SimpleGrid cols={2} mt="md">
                <NativeSelect label="Score Limit"
                    disabled={gameStarted}
                    value={rules.pointsToWin.toString()}
                    onChange={(value) => {
                        setRule("pointsToWin", value ? parseInt(value.currentTarget.value) : 1)
                    }}
                    data={Array.from({ length: 67 }, (_, i) => i + 3).map((i) => ({
                        value: i.toString(),
                        label: i.toString()
                    }))}
                />
                <NativeSelect label="Win by"
                    disabled={gameStarted}
                    value={rules.pointsToWinBy.toString()}
                    onChange={({ currentTarget }) => setRule("pointsToWinBy", parseInt(currentTarget.value))}
                    data={Array.from({ length: 10 }, (_, i) => i + 1).map((i) => ({
                        value: i.toString(),
                        label: i.toString()
                    }))}
                />
                <NativeSelect label="Player Limit"
                    value={rules.maxNumberOfPlayers.toString()}
                    disabled={gameStarted}
                    onChange={({currentTarget}) => setRule("maxNumberOfPlayers", parseInt(currentTarget.value ?? "3"))}
                    data={Array.from({ length: 18 }, (_, i) => i + 3).map((i) => ({
                        value: i.toString(),
                        label: i.toString()
                    }))}
                />
                <NativeSelect label="Number of Custom Cards" 
                    value={rules.numberOfCustomCards.toString()}
                    disabled={gameStarted}
                    onChange={({currentTarget}) => setRule("numberOfCustomCards", parseInt(currentTarget.value ?? "1"))}
                    data={Array.from({ length: 61 }, (_, i) => i).map((i) => ({
                        value: i.toString(),
                        label: i.toString()
                    }))}
                />
                <NativeSelect label="New Hands Per Player"
                    description="Sit out a round for a brand new hand (0 disables)"
                    value={rules.newHandsPerGame.toString()}
                    disabled={gameStarted}
                    onChange={({currentTarget}) => setRule("newHandsPerGame", parseInt(currentTarget.value ?? "0"))}
                    data={Array.from({ length: 6 }, (_, i) => i).map((i) => ({
                        value: i.toString(),
                        label: i.toString()
                    }))}
                />
            </SimpleGrid>
        </>
    )
}

const DeckSettings = () => {
    const { cardDecks, addDeck, removeDeck, gameStarted, allDecks} = useGame();
    const [deckInput, setDeckInput] = useState<string>("");

    const allAvailablelDecks = useMemo(() => {
        return allDecks.filter((deck) => !cardDecks.find((d) => d.id === deck.id) &&
            deck.name.toLowerCase().includes(deckInput.toLowerCase())
        ).sort((a, b) => a.name.localeCompare(b.name));
    }
        , [allDecks, cardDecks, deckInput]);
    const availableCustomDecks = useMemo(
        () => allAvailablelDecks.filter((deck) => !deck.cahOfficial), [allAvailablelDecks]);
    const availableMainDecks = useMemo(
        () => allAvailablelDecks.filter((deck) => deck.cahOfficial && isMainDeck(deck.name)), [allAvailablelDecks]);
    const availableExpansionDecks = useMemo(
        () => allAvailablelDecks.filter((deck) => deck.cahOfficial && !isMainDeck(deck.name)), [allAvailablelDecks]);
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({ Custom: true });
    const availableSections = [
        { title: "Custom", decks: availableCustomDecks },
        { title: "Official - Main", decks: availableMainDecks },
        { title: "Official - Expansion", decks: availableExpansionDecks },
    ];

    return (
        <Table highlightOnHover styles={{
            tr: {
                padding: "0",

            },
            td: {
                padding: "2px",
            }
        }}>
            <Table.Thead>
                <Table.Tr>
                    <Table.Th colSpan={2}>
                        <Text fw="bold" style={{ fontSize: "1.2rem" }}>{gameStarted ? "Decks in Play" : "Decks Added"}</Text>
                    </Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {cardDecks.length === 0 && (
                    <Table.Tr>
                        <Table.Td colSpan={2}>
                            <Text>There are no decks added</Text>
                        </Table.Td>
                    </Table.Tr>
                )}
                <ScrollArea h={250}>
                    {[...cardDecks].reverse().map((deck) => (
                        <Table.Tr>
                            <Table.Td key={deck.id} pl="sm">
                                <Text>{deck.name}</Text>
                            </Table.Td>
                            {!gameStarted && (<Table.Td align="right" pr="xl">
                                <Button
                                    p="sm"
                                    color="light-dark(var(--mantine-color-blue-6), var(--mantine-color-dark-4))"
                                    onClick={() => removeDeck(deck.id)}>
                                    <IconX />
                                </Button>
                            </Table.Td>)}
                        </Table.Tr>
                    ))}
                </ScrollArea>
                {!gameStarted && (
                    <>

                        <Table.Tr>
                            <Table.Th colSpan={2}>
                                <Text style={{ fontSize: "1.2rem" }} fw="bold">Available Decks</Text>
                            </Table.Th>
                        </Table.Tr>
                        {(allAvailablelDecks.length > 6 || deckInput) && (<Table.Tr>
                            <Table.Td colSpan={2}>
                                <Input placeholder="Search Decks"
                                    leftSection={<IconSearch />}
                                    onChange={(e) => setDeckInput(e.currentTarget.value)} />
                            </Table.Td>
                        </Table.Tr>)}
                        <ScrollArea h={250}>
                            {availableSections.map(({ title, decks }) => {
                                if (decks.length === 0) return null;
                                // Searching expands every section so matches are visible
                                const isSearching = Boolean(deckInput);
                                const isOpen = isSearching || Boolean(openSections[title]);
                                return (
                                    <Fragment key={title}>
                                        <Table.Tr
                                            style={{ cursor: isSearching ? "default" : "pointer" }}
                                            onClick={isSearching ? undefined : () => setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }))}>
                                            <Table.Th colSpan={2}>
                                                <Group gap="xs">
                                                    {!isSearching && (isOpen ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />)}
                                                    <Title order={4}>{title} ({decks.length})</Title>
                                                </Group>
                                            </Table.Th>
                                        </Table.Tr>
                                        {isOpen && decks.map((deck) => (
                                            <Table.Tr key={deck.id}>
                                                <Table.Td pl="sm">
                                                    <Text>{displayDeckName(deck.name)}</Text>
                                                </Table.Td>
                                                <Table.Td align="right" pr="xl">
                                                    <Button
                                                        p='sm'
                                                        color="light-dark(var(--mantine-color-blue-6), var(--mantine-color-dark-4))"
                                                        onClick={() => addDeck(deck.id)}>
                                                        <IconPlus />
                                                    </Button>
                                                </Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Fragment>
                                );
                            })}
                        </ScrollArea>
                    </>)}
            </Table.Tbody>
        </Table>
    )
}

const PlayerSettings = () => {

    const { players } = useGame();
    const { kickPlayer, user } = useAuth();
    return (
        <Table styles={{
            tr: {
                padding: "0",
            },
            td: {
                padding: "2px",
            }
        }}>
            <Table.Thead>
                <Table.Tr>
                    <Table.Th pl="sm">Name</Table.Th>
                    <Table.Th pr="xl">Points</Table.Th>
                    <Table.Th pr="xl">Kick</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {players.length === 0 && (
                    <Table.Tr>
                        <Table.Td colSpan={2}>
                            <Text>There are no players in the game</Text>
                        </Table.Td>
                    </Table.Tr>
                )}
                {players.map((player) => (
                    <Table.Tr key={player.id}>
                        <Table.Td pl="sm">
                            <Text>{player.username}</Text>
                        </Table.Td>
                        <Table.Td pr="xl">
                            <Text>{player.points} Points</Text>
                        </Table.Td>
                        {player.id !== user?.id && (<Table.Td pr="xl">
                            <Button
                                p='sm'
                                size="sm"
                                bg="none"
                                // color="light-dark(var(--mantine-color-red-6), var(--mantine-color-dark-4))"
                                onClick={() => kickPlayer(player.id)}>
                                <IconX
                                    color="red"
                                />
                            </Button>
                        </Table.Td>)}
                    </Table.Tr>
                ))}
            </Table.Tbody>
        </Table>
    )
}

const ImportDeckSettings = () => {
    const { importDeck, addedDeck, addDeckError } = useGame();
    const [deckId, setDeckId] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
    const handleAddDeck = async () => {
      setStatus('loading');
      const deck = await importDeck(deckId);
      setStatus(deck ? 'success' : 'error');
      if (deck) setDeckId('');
    };
  
    return (
      <>
        {status === 'error' && addDeckError && (
          <Text c="red">Error: {addDeckError}</Text>
        )}
  
        <Text>
          Import a deck from{' '}
          <a href="https://cast.clrtd.com/" target="_blank" rel="noopener noreferrer">
            cast.clrtd.com
          </a>
        </Text>
  
        <SimpleGrid cols={2} mt="md">
          <Input
            placeholder="Deck ID"
            value={deckId}
            onChange={(e) => setDeckId(e.currentTarget.value)}
          />
          <Button c="white" onClick={handleAddDeck} disabled={!deckId || status === 'loading'}>
            Import Deck
          </Button>
        </SimpleGrid>
  
        {status === 'loading' && <Text>Importing deck...</Text>}
  
        {status === 'success' && addedDeck && (
          <>
            <Title order={3} mt="xl">
              Deck Imported/Updated
            </Title>
            <Table mt="xl">
              <Table.Tbody>
                <Table.Tr>
                  <Table.Th pl="sm">
                    <Text>Deck Name</Text>
                  </Table.Th>
                  <Table.Td pr="xl">
                    <Text>{addedDeck.name}</Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Th pl="sm">
                    <Text>Deck Description</Text>
                  </Table.Th>
                  <Table.Td pr="xl">
                    <Text>{addedDeck.description}</Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Th pl="sm">
                    <Text>Number of Black Cards</Text>
                  </Table.Th>
                  <Table.Td pr="xl">
                    <Text>{addedDeck.numberOfBlackCards}</Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Th pl="sm">
                    <Text>Number of White Cards</Text>
                  </Table.Th>
                  <Table.Td pr="xl">
                    <Text>{addedDeck.numberOfWhiteCards}</Text>
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </>
        )}
      </>
    );
  };


export default SettingsPane;
