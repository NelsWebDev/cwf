import { announceGameStart, updateAnnouncedPlayers } from "../utils/discordWebhook";
import type { Announcer } from "./GameRoom";

export const discordAnnouncer: Announcer = {
  updatePlayers: updateAnnouncedPlayers,
  announceGameStart,
};
