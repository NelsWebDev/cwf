import { game, ioServer } from "../singletons";
import { EventHandlers } from "../types";

export const SettingEventHandlers: Pick<
  EventHandlers,
  "onAddDeck" | "onRemoveDeck" | "onUpdateRules"
> = {
  onAddDeck: function (socket, deckId): void {
    game.addDeck(deckId);
  },
  onRemoveDeck: function (socket, deckId): void {
    game.removeDeck(deckId);
  },
  onUpdateRules: function (socket, rules): void {
    game.updateRules(rules);
    ioServer.emit("rules", game.rules);
  },
};
