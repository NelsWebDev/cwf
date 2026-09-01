import {  Card, Center, Group, Text, Title } from "@mantine/core"
import { IconThumbDownFilled, IconX } from "@tabler/icons-react";
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
    const { currentRound, skipBlackCard, voteToSkipBlackCard } = useGame();
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
            overflow: 'scroll',
        }}>
            <Card.Section withBorder inheritPadding >
                <Group justify="space-between">
                    <Title order={2}  fw={500} c="white">Black Card</Title>
                    {currentRound?.cardCzarId == user?.id &&
                        <IconX size="1.2rem" style={{cursor: "pointer"}} stroke={1.5} onClick={skipBlackCard} color="white"/>
                    }
                    {currentRound?.cardCzarId != user?.id && (
                        <IconThumbDownFilled color="white" size="1.2rem" style={{cursor: "pointer"}}  stroke={1.5} onClick={() => voteToSkipBlackCard(true)} />
                    )}

                </Group>
            </Card.Section>

            <Center style={{height: '100%'}}>
            <Text mt="sm" size="sm" span inherit c="white"
                style={{
                    overflow: "scroll",
                    fontSize: '1.8rem',
                    lineHeight: '1.8rem',
                }}
            >
                <TextWithLineBreaks text={text} />
            </Text>
            </Center>
        </Card>
    )
}

export default BlackCard;