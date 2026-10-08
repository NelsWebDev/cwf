const GAME_URL = "https://cards.nels.app";
const ANNOUNCEMENT_COOLDOWN_MS = 15 * 60 * 1000;

let lastAnnouncementAt: number | undefined;
let announcementInProgress = false;

export async function announceGameStart(username: string) {
  const now = Date.now();
  if (
    announcementInProgress ||
    (lastAnnouncementAt !== undefined &&
      now - lastAnnouncementAt < ANNOUNCEMENT_COOLDOWN_MS)
  ) {
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

  announcementInProgress = true;
  try {
    const response = await fetch(webhookEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        flags: 32768,
        allowed_mentions: { parse: ["everyone"] },
        components: [
          {
            type: 9,
            components: [
              {
                type: 10,
                content: "### New Cards Against Humanity Game",
              },
              {
                type: 10,
                content: `@here **${username.replaceAll("@", "@\u200b")}** started a game of Cards Against Humanity.`,
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
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook returned HTTP ${response.status}`);
    }

    lastAnnouncementAt = Date.now();
    return true;
  } finally {
    announcementInProgress = false;
  }
}
