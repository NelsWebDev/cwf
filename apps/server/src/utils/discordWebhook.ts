const GAME_URL = "https://cards.nels.app";

let announcementInProgress = false;

let announcedMessageId: string | undefined;
let latestPlayers: string[] = [];
let updateInProgress = false;
let updatePending = false;
let deletionTimer: NodeJS.Timeout | undefined;

const EMPTY_ROOM_DELETE_DELAY_MS = 3 * 60 * 1000;

const messageEndpoint = (webhookUrl: string, messageId: string) => {
  const endpoint = new URL(webhookUrl);
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/messages/${messageId}`;
  return endpoint;
};

async function deleteAnnouncement() {
  deletionTimer = undefined;
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const messageId = announcedMessageId;
  if (!webhookUrl || !messageId) return;
  announcedMessageId = undefined;
  try {
    const response = await fetch(messageEndpoint(webhookUrl, messageId), { method: "DELETE" });
    // 404 means it was already deleted.
    if (!response.ok && response.status !== 404) {
      throw new Error(`Discord webhook returned HTTP ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to delete Discord announcement", error);
  }
}

const escapeMentions = (text: string) => text.replaceAll("@", "@\u200b");

const buildComponents = (players: string[], gamePassword: string) => [
  {
    type: 9,
    components: [
      {
        type: 10,
        content: "## We're Playing: Cards Against Humanity!",
      },
      {
        type: 10,
        content: `**Current Players:** ${
          players.length ? players.map((name) => escapeMentions(name)).join(", ") : "None"
        }`,
      },
      {
        type: 10,
        content: `**Password:** ${gamePassword}`,
      },
    ],
    accessory: {
      type: 2,
      style: 5,
      label: "Join Game",
      url: GAME_URL,
    },
  },
];

export async function announceGameStart(players: string[]) {
  // A live announcement already tracks the room, so reuse it instead of posting a duplicate.
  if (announcementInProgress) {
    return false;
  }
  if (announcedMessageId) {
    await updateAnnouncedPlayers(players);
    return false;
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("DISCORD_WEBHOOK_URL is not configured");
  }
  const gamePassword = process.env.GAME_PASSWORD;
  if (!gamePassword) {
    throw new Error("GAME_PASSWORD is not configured");
  }

  const webhookEndpoint = new URL(webhookUrl);
  webhookEndpoint.searchParams.set("with_components", "true");
  // Discord only returns the created message (and its id) when wait=true.
  webhookEndpoint.searchParams.set("wait", "true");

  announcementInProgress = true;
  try {
    const response = await fetch(webhookEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        flags: 32768,
        allowed_mentions: { parse: ["everyone"] },
        components: buildComponents(players, gamePassword),
      }),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook returned HTTP ${response.status}`);
    }

    const message = (await response.json().catch(() => undefined)) as { id?: string } | undefined;
    if (deletionTimer) {
      clearTimeout(deletionTimer);
      deletionTimer = undefined;
    }
    announcedMessageId = message?.id;
    latestPlayers = players;
    return true;
  } finally {
    announcementInProgress = false;
  }
}

/** Edits the announcement message so it lists the given players. Rapid calls are coalesced. */
export async function updateAnnouncedPlayers(players: string[]) {
  latestPlayers = players;
  if (!announcedMessageId) return;

  if (players.length === 0) {
    deletionTimer ??= setTimeout(deleteAnnouncement, EMPTY_ROOM_DELETE_DELAY_MS);
    deletionTimer.unref?.();
  } else if (deletionTimer) {
    clearTimeout(deletionTimer);
    deletionTimer = undefined;
  }

  if (updateInProgress) {
    updatePending = true;
    return;
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const gamePassword = process.env.GAME_PASSWORD;
  if (!webhookUrl || !gamePassword) return;

  updateInProgress = true;
  try {
    do {
      updatePending = false;
      if (!announcedMessageId) break;
      const endpoint = messageEndpoint(webhookUrl, announcedMessageId);
      endpoint.searchParams.set("with_components", "true");
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flags: 32768,
          allowed_mentions: { parse: [] },
          components: buildComponents(latestPlayers, gamePassword),
        }),
      });
      if (!response.ok) {
        throw new Error(`Discord webhook returned HTTP ${response.status}`);
      }
    } while (updatePending);
  } finally {
    updateInProgress = false;
  }
}

export async function postImageToDiscord(image: Buffer, filename: string, content?: string) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("DISCORD_WEBHOOK_URL is not configured");
  }

  const form = new FormData();
  form.append(
    "payload_json",
    JSON.stringify({
      content,
      allowed_mentions: { parse: [] },
      attachments: [{ id: 0, filename }],
    }),
  );
  form.append("files[0]", new Blob([new Uint8Array(image)], { type: "image/png" }), filename);

  const response = await fetch(webhookUrl, { method: "POST", body: form });
  if (!response.ok) {
    throw new Error(`Discord webhook returned HTTP ${response.status}`);
  }
}
