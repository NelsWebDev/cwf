import { Button, Group, Stack, Switch, Text, TextInput } from "@mantine/core";
import { useState } from "react";
import { useAuth } from "../hooks";
import { setNotificationPreference, setNotificationSoundPreference, useNotificationPreference, useNotificationSoundPreference } from "../hooks/useNotificationPreference";
import ThemeSelector from "./ThemeSelector";

const selectStyles = {
  root: { width: "100%" },
  section: { color: "inherit" },
  input: {
    background: "transparent",
    border: "1px solid var(--mantine-color-gray-5)",
    color: "inherit",
    fontWeight: "normal",
  },
};

const PreferencesModal = () => {
  const { user, updateUsername, updateDiscordId } = useAuth();
  const [username, setUsername] = useState(user?.username ?? "");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [discordId, setDiscordId] = useState(user?.discordId ?? "");
  const [discordError, setDiscordError] = useState<string>();
  const [savingDiscord, setSavingDiscord] = useState(false);
  const notificationsEnabled = useNotificationPreference();
  const soundsEnabled = useNotificationSoundPreference();
  const supported = typeof Notification !== "undefined";
  const blocked = supported && Notification.permission === "denied";

  const notificationsOn = notificationsEnabled && supported && !blocked;

  const trimmed = username.trim();
  const save = async () => {
    setSaving(true);
    setError(await updateUsername(trimmed));
    setSaving(false);
  };

  const trimmedDiscordId = discordId.trim();
  const saveDiscordId = async () => {
    setSavingDiscord(true);
    setDiscordError(await updateDiscordId(trimmedDiscordId));
    setSavingDiscord(false);
  };

  const toggleNotifications = async (enabled: boolean) => {
    if (enabled && Notification.permission !== "granted") {
      if ((await Notification.requestPermission()) !== "granted") return;
    }
    setNotificationPreference(enabled);
  };

  return (
    <Stack>
      <Group align="flex-end" wrap="nowrap">
        <TextInput
          style={{ flex: 1 }}
          label="Username"
          value={username}
          maxLength={30}
          error={error}
          onChange={(e) => { setUsername(e.currentTarget.value); setError(undefined); }}
          onKeyDown={(e) => { if (e.key === "Enter" && trimmed && trimmed !== user?.username) save(); }}
        />
        <Button c="white" loading={saving} disabled={!trimmed || trimmed === user?.username} onClick={save}>
          Save
        </Button>
      </Group>
      <Group align="flex-end" wrap="nowrap">
        <TextInput
          style={{ flex: 1 }}
          label="Discord user ID"
          description="Optional. Lets Discord @mention you when you start a game."
          placeholder="e.g. 123456789012345678"
          value={discordId}
          maxLength={20}
          error={discordError}
          onChange={(e) => { setDiscordId(e.currentTarget.value); setDiscordError(undefined); }}
          onKeyDown={(e) => { if (e.key === "Enter" && trimmedDiscordId !== (user?.discordId ?? "")) saveDiscordId(); }}
        />
        <Button c="white" loading={savingDiscord} disabled={trimmedDiscordId === (user?.discordId ?? "")} onClick={saveDiscordId}>
          Save
        </Button>
      </Group>
      <div>
        <Text size="sm" fw={500} mb={4}>Color theme</Text>
        <ThemeSelector styles={selectStyles} />
      </div>
      <Switch
        label="Browser notifications"
        description={
          !supported ? "Not supported by this browser"
            : blocked ? "Blocked in your browser settings"
              : "Notify me when it's time to pick as Card Czar, or if I haven't played after 45 seconds"
        }
        disabled={!supported || blocked}
        checked={notificationsOn}
        onChange={(e) => toggleNotifications(e.currentTarget.checked)}
      />
      {notificationsOn && (
        <Switch
          label="Enable Notification Sounds"
          checked={soundsEnabled}
          onChange={(e) => setNotificationSoundPreference(e.currentTarget.checked)}
        />
      )}
    </Stack>
  );
};

export default PreferencesModal;
