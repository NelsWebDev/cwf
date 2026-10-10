import { useState, type FormEvent } from "react";
import { Alert, Anchor, Button, Card, Center, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { Link } from "react-router";
import { useDeckAuth } from "./deckAuthContext";
import { getErrorMessage } from "../utils";

type Mode = "login" | "register";

const titles: Record<Mode, string> = {
  login: "Deck manager login",
  register: "Create deck account",
};

const AuthPage = () => {
  const { login, register } = useDeckAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const registering = mode === "register";

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (registering && password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await (registering ? register : login)(email, password);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Center mih="100vh" p="md">
      <Card w={400} maw="100%" withBorder padding="xl">
        <form onSubmit={(e) => void submit(e)}>
          <Stack>
            <Title order={2}>{titles[mode]}</Title>
            <Text size="sm" c="dimmed">
              Deck accounts are separate from your in-game username.
            </Text>
            {error && <Alert color="red">{error}</Alert>}
            <TextInput
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />
            <PasswordInput
              label="Password"
              autoComplete={registering ? "new-password" : "current-password"}
              description={registering ? "At least 8 characters" : undefined}
              required
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
            {registering && (
              <PasswordInput
                label="Confirm password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.currentTarget.value)}
              />
            )}
            <Button type="submit" loading={submitting}>
              {registering ? "Register" : "Log in"}
            </Button>
            <Anchor
              component="button"
              type="button"
              size="sm"
              onClick={() => switchMode(registering ? "login" : "register")}
            >
              {registering ? "Already have an account? Log in" : "Need an account? Register"}
            </Anchor>
            <Anchor component={Link} to="/" size="sm">
              Back to game
            </Anchor>
          </Stack>
        </form>
      </Card>
    </Center>
  );
};

export default AuthPage;
