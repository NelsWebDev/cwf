import {  Card, Center, Group, Text, Title } from "@mantine/core"
import { IconThumbDown, IconThumbDownFilled, IconX } from "@tabler/icons-react";
import { useAuth, useGame } from "../hooks";
import { Fragment } from "react/jsx-runtime";

const TextWithLineBreaks = ({ text }: {text?: string}) => (
    <>
      {text?.split('\n').map((line, index) => (
        <Fragment key={index}>
          {line}
          {index !== text.split('\n').length - 1 && <br />}
        </Fragment>
      ))}
    </>
  );

const BlackCard = () => {
    const { user } = useAuth();
    const { currentRound, players, skipBlackCard, voteToSkipBlackCard } = useGame();
    const isCzar = currentRound?.cardCzarId === user?.id;
    const skipVotes = Object.values(currentRound?.votesToSkip ?? {}).filter(Boolean).length;
    const totalVoters = Math.max(players.length - 1, 0);
    const iVotedToSkip = !!user && !!currentRound?.votesToSkip[user.id];
    const text = currentRound?.blackCard.text;
    return (
        <Card withBorder shadow="sm" radius="md" style={{
            width: '350px',
            height: '350px',
            backgroundColor: 'light-dark(var(--mantine-color-dark-6), var(--mantine-color-dark-9))',
            WebkitUserSelect: "none",
            "KhtmlUserSelect": "none",
            MozUserSelect: "none",
            userSelect: "none",
            msUserSelect: "none",
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
        }}>
            <Card.Section withBorder inheritPadding >
                <Group justify="space-between">
                    <Title order={2}  fw={500} c="white">Black Card</Title>
                    {isCzar &&
                        <IconX size="1.2rem" style={{cursor: "pointer"}} stroke={1.5} onClick={skipBlackCard} color="white"/>
                    }
                    {!isCzar && (
                        iVotedToSkip
                            ? <IconThumbDownFilled color="var(--mantine-color-red-5)" size="1.2rem" style={{cursor: "pointer"}} stroke={1.5} onClick={() => voteToSkipBlackCard(false)} />
                            : <IconThumbDown color="white" size="1.2rem" style={{cursor: "pointer"}} stroke={1.5} onClick={() => voteToSkipBlackCard(true)} />
                    )}

                    {skipVotes > 0 && (
                        <Text c="white" size="sm">
                            {skipVotes}/{totalVoters} Skip Votes
                        </Text>
                    )}

                </Group>
            </Card.Section>

            <Center style={{flex: 1, minHeight: 0, overflowY: 'auto'}}>
            <Text mt="sm" size="sm" span inherit
                style={{
                    color: 'white',
                    fontSize: '1.8rem',
                    lineHeight: '1.8rem',
                    maxHeight: '100%',
                }}
            >
                <TextWithLineBreaks text={text} />
            </Text>
            </Center>
        </Card>
    )
}

export default BlackCard;