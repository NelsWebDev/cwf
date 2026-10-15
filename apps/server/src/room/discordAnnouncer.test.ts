import { expect, it, vi } from "vitest";

vi.mock("../utils/discordWebhook", () => ({
  updateAnnouncedPlayers: vi.fn(),
  announceGameStart: vi.fn(),
}));

import * as webhook from "../utils/discordWebhook";
import { discordAnnouncer } from "./discordAnnouncer";

it("delegates to the Discord webhook helpers", () => {
  expect(discordAnnouncer.updatePlayers).toBe(webhook.updateAnnouncedPlayers);
  expect(discordAnnouncer.announceGameStart).toBe(webhook.announceGameStart);
});
