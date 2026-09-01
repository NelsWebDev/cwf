import { Card, Image, Text } from "@mantine/core";
import classes from "../styles/WhiteCard.module.css";
import {  useGame } from "../hooks";
import { WhiteCard as TWhiteCard, User } from "../types";
import { useMemo } from "react";

type WhiteCardProps = {
  data: TWhiteCard;
  animate?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  ownerId?: User["id"];
};

const WhiteCard = (props: WhiteCardProps) => {
  const {
    data: { text, id, isCustom },
    onClick,
  } = props;
  const { selectedWhiteCard, setSelectedWhiteCard, players } = useGame();
  const user = useMemo(() => {
    return players.find((user) => user.id === props.ownerId);
  }, [players, props.ownerId]);

  let cardClasses = classes.whiteCard;
  const selected = "selected" in props && props.selected !== false;

  const url = text.startsWith("[img]") ? text.trim().replace("[img]", "").replace("[/img]", "") : undefined;

  if ("animate" in props && props.animate !== false) {
    cardClasses += ` ${classes.animate}`;
  }
  if (selected) {
    cardClasses += ` ${classes.selected}`;
  }

  return (
    <Card
      withBorder
      shadow="sm"
      radius="md"
      variant="light"
      className={cardClasses}
      display="inline-block"
      style={{
        ...(url ? { padding: 0 } : { padding: "0.5rem" }),
        position: "relative",
      }}
      onClick={() => {
        if ("disabled" in props && props.disabled !== false) return;
        if (selectedWhiteCard?.id === id) {
          setSelectedWhiteCard(undefined);
        } else {
          setSelectedWhiteCard(props.data);
        }
        onClick?.();
      }}
      onDoubleClick={() => {
        if ("disabled" in props && props.disabled !== false) return;
        if (isCustom) {
          const newText = prompt("Enter a custom card text");
          setSelectedWhiteCard({
            ...props.data,
            text: newText || "",
          });
        }
      }}
    >
      {/* Username at top-right */}
      {user?.username && (
        <Text
          style={{
            position: "absolute",
            top: "4px",
            right: "8px",
            opacity: 0.7,
            color: selected ? "white" : "inheirt",
          }}
          size="xl"
        >
          {user.username}
        </Text>
      )}

      {url ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            height: "100%",
          }}
        >
          <Image
            src={url}
            alt="Card image"
            style={{
              maxWidth: "150px",
              maxHeight: "150px",
              objectFit: "contain",
            }}
          />
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            height: "100%",
            padding: "0.5rem",
            textAlign: "center",
          }}
        >
          <Text span inherit c={!selected ? "inherit" : "white"}>
            {text ? text : isCustom ? "__________" : ""}
          </Text>
        </div>
      )}
    </Card>
  );
};

export default WhiteCard;
