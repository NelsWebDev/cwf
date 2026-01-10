import {
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    login,
    isAuthenticated,
    isAuthenticating,
    disconnected,
    reconnect,
    errorMessage,
  } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Where the user was trying to go before redirecting to /login
  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  // Once authenticated, redirect back
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, from, navigate]);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) return;
    await login(username.trim(), password);
  };

  return (
    <Center style={{ minHeight: "100vh" }}>
      <Paper shadow="md" p="lg" radius="md" w={360}>
        <Stack>
          <Title order={3} ta="center">
            Sign in
          </Title>

          {disconnected && (
            <>
              <Text c="red" size="sm" ta="center">
                Lost connection to server
              </Text>
              <Button variant="light" onClick={reconnect}>
                Reconnect
              </Button>
            </>
          )}

          {!disconnected && (
            <>
              <TextInput
                label="Username"
                placeholder="Enter your name"
                value={username}
                onChange={(e) => setUsername(e.currentTarget.value)}
                disabled={isAuthenticating}
              />

              <PasswordInput
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                disabled={isAuthenticating}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLogin();
                }}
              />

              {errorMessage && (
                <Text c="red" size="sm">
                  {errorMessage}
                </Text>
              )}

              <Button
                onClick={handleLogin}
                loading={isAuthenticating}
                disabled={!username.trim() || !password.trim()}
                fullWidth
              >
                Log in
              </Button>
            </>
          )}
        </Stack>
      </Paper>
    </Center>
  );
}
