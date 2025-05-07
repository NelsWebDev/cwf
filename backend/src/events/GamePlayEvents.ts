import { game } from "../singletons";
import { EventHandlers, WhiteCard } from "../types";

export const GamePlayEventHandlers: Pick<
  EventHandlers,
  | "onPlayCards"
  | "onPickWinner"
  | "onStartGame"
  | "onEndGame"
  | "onGetGame"
  | "onMyHand"
  | "onSkipBlackCard"
  | "onVoteToSkipBlackCard"
  | "onUndoPlay"
> = {
  onPlayCards: function (socket, arg: WhiteCard[]): void {
    socket.data.playWhiteCards(arg);
  },
  onUndoPlay: function (socket): void {
    socket.data.undoPlay();
  },
  onPickWinner: function (socket, winningCardId): void {
    socket.data.selectWinner(winningCardId);
  },
  onStartGame: function (socket): void {
    game.start().catch((err) => {
      console.error("Error starting game", err);
      socket.emit("serverMessage", {
        title: "Failed to start game",
        message: err?.message,
      });
    });
  },
  onEndGame: function (): void {
    game.endGame();
  },
  onGetGame: function (socket): void {
    socket.data.room.emit("game", game.toJSON());
  },
  onMyHand: function (socket): void {
    socket.data.emitMyHand();
  },
    onSkipBlackCard: function (socket): void {
        if(game.currentCardCzar.id !== socket.data.id) {
            throw new Error("You are not the card czar");
        }
        game.skipBlackCard();
    },
    onVoteToSkipBlackCard: function (socket): void {
        game.currentRound?.voteToSkip(socket.data.id, true);
        game.skipBlackCard();
    }
};
