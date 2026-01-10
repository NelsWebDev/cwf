import { Button, Center, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <Center style={{ minHeight: "60vh" }}>
      <Stack align="center">
        <Title order={2}>404</Title>
        <Text c="dimmed">That page doesn’t exist.</Text>
        <Button component={Link} to="/">
          Go home
        </Button>
      </Stack>
    </Center>
  );
}
