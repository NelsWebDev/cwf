import { GraphQLError } from "graphql";
import { CardManager } from "../CardManager";
import { game, socketManager } from "../singletons";
import { subscribe, subscribeToUser } from "../pubsub";
import { importDeck } from "../utils/cardImporter";
import { announceGameStart, postImageToDiscord } from "../utils/discordWebhook";
import { renderRoundImage } from "../utils/roundImage";
import { requireAccess, requireUser, type GraphQLContext } from "./context";
import { RoundStatus, type GameRound, type Rules, type WhiteCard } from "@repo/shared/types";

const badInput = (message: string) =>
  new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });

type PlayInput = Pick<WhiteCard, "id" | "text">;

// Wraps an async iterator so it first yields `initial`, then continues with the live events.
// Written by hand (not as a generator) so return() reaches the live iterator even while a next() is pending.
const withInitialValue = <T>(initial: T, live: AsyncIterator<T>): AsyncIterableIterator<T> => {
  let initialSent = false;
  return {
    next: () => {
      if (initialSent) return live.next();
      initialSent = true;
      return Promise.resolve({ value: initial, done: false });
    },
    return: (value?: unknown) =>
      live.return ? live.return(value) : Promise.resolve({ value: undefined, done: true }),
    throw: (error?: unknown) => (live.throw ? live.throw(error) : Promise.reject(error)),
    [Symbol.asyncIterator]() {
      return this;
    },
  };
};

const broadcast = (name: Parameters<typeof subscribe>[0]) => ({
  subscribe: () => subscribe(name),
});

export const resolvers = {
  GameRound: {
    plays: (round: GameRound) =>
      Object.entries(round.plays).map(([userId, cards]) => ({ userId, cards })),
    votesToSkip: (round: GameRound) =>
      Object.entries(round.votesToSkip).map(([userId, vote]) => ({ userId, vote })),
  },

  Query: {
    me: (_: unknown, __: unknown, ctx: GraphQLContext) => requireUser(ctx).toJSON(),
    players: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireAccess(ctx);
      return socketManager.activeUsers.map((u) => u.toJSON());
    },
    game: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireAccess(ctx);
      return game.toJSON();
    },
    gamePassword: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireAccess(ctx);
      return process.env.GAME_PASSWORD ?? "";
    },
    myHand: (_: unknown, __: unknown, ctx: GraphQLContext) =>
      Array.from(requireUser(ctx).hand.values()),
    decks: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireAccess(ctx);
      return CardManager.fetchAllDecks();
    },
  },

  Mutation: {
    login: (_: unknown, { username, password }: { username: string; password: string }) => {
      if (!username) throw badInput("Username is required");
      if (!password) throw badInput("Password is required");
      if (password !== process.env.GAME_PASSWORD) throw badInput("Invalid password");
      if (!socketManager.usernameAvailable(username)) throw badInput("Username already in use");
      return socketManager.registerUser(username).toJSON();
    },
    updateUsername: (_: unknown, { username }: { username: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      const trimmed = username.trim();
      if (!trimmed) throw badInput("Username is required");
      if (trimmed.length > 30) throw badInput("Username must be 30 characters or fewer");
      if (!socketManager.usernameAvailable(trimmed, user.id)) throw badInput("Username already in use");
      user.rename(trimmed);
      return user.toJSON();
    },
    logout: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      user.kick();
      socketManager.gameUsers.delete(user.id);
      return true;
    },
    kickPlayer: (_: unknown, { userId }: { userId: string }, ctx: GraphQLContext) => {
      requireAccess(ctx);
      socketManager.gameUsers.get(userId)?.kick();
      return true;
    },
    importDeck: async (_: unknown, { deckId }: { deckId: string }, ctx: GraphQLContext) => {
      requireAccess(ctx);
      try {
        return await importDeck(deckId);
      } catch (error) {
        console.error("Error importing deck:", error);
        throw new GraphQLError(
          error instanceof Error && error.message === "Deck already imported"
            ? "Deck already imported"
            : "Failed to import deck",
        );
      }
    },
    addDeck: async (_: unknown, { deckId }: { deckId: string }, ctx: GraphQLContext) => {
      requireAccess(ctx);
      await game.addDeck(deckId);
      return true;
    },
    removeDeck: (_: unknown, { deckId }: { deckId: string }, ctx: GraphQLContext) => {
      requireAccess(ctx);
      game.removeDeck(deckId);
      return true;
    },
    updateRules: (_: unknown, { rules }: { rules: Partial<Rules> }, ctx: GraphQLContext) => {
      requireAccess(ctx);
      // Drop explicit nulls so omitted fields keep their current values.
      const changes = Object.fromEntries(
        Object.entries(rules).filter(([, value]) => value !== null && value !== undefined),
      );
      game.updateRules(changes);
      return game.rules;
    },
    startGame: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireAccess(ctx);
      await game.start();
      if (game.rules.announceToDiscord) {
        try {
          await announceGameStart(ctx.user?.username ?? "Someone");
        } catch (error) {
          console.error("Failed to announce game start to Discord", error);
        }
      }
      return true;
    },
    endGame: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireAccess(ctx);
      game.endGame();
      return true;
    },
    playCards: (_: unknown, { cards }: { cards: PlayInput[] }, ctx: GraphQLContext) => {
      requireUser(ctx).playWhiteCards(cards as WhiteCard[]);
      return true;
    },
    undoPlay: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireUser(ctx).undoPlay();
      return true;
    },
    pickWinner: (_: unknown, { cardId }: { cardId: string }, ctx: GraphQLContext) => {
      requireUser(ctx).selectWinner(cardId);
      return true;
    },
    shareRoundToDiscord: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireUser(ctx);
      const round = game.currentRound;
      if (!round || round.status !== RoundStatus.SHOWING_WINNER) {
        throw new Error("There is no finished round to share");
      }
      if (round.sharedToDiscord) {
        throw new Error("This round was already shared to Discord");
      }
      round.sharedToDiscord = true;
      try {
        const image = renderRoundImage({
          blackCardText: round.blackCard.text,
          pick: round.blackCard.pick,
          plays: Object.entries(round.plays).map(([userId, cards]) => ({
            username: socketManager.gameUsers.get(userId)?.username ?? "Unknown",
            cards: cards.map((card) => card.text),
            isWinner: userId === round.winnerId,
          })),
        });
        await postImageToDiscord(image, "round.png");
      } catch (error) {
        round.sharedToDiscord = false;
        console.error("Failed to share round to Discord", error);
        throw new Error("Failed to share to Discord");
      }
      return true;
    },
    skipBlackCard: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      if (game.currentCardCzar?.id !== user.id) {
        throw new Error("You are not the card czar");
      }
      game.skipBlackCard();
      return true;
    },
    voteToSkipBlackCard: (_: unknown, { vote }: { vote: boolean }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      game.currentRound?.voteToSkip(user.id, vote);
      return true;
    },
  },

  Subscription: {
    myProfile: {
      subscribe: (_: unknown, __: unknown, ctx: GraphQLContext) => {
        const user = requireUser(ctx);
        return withInitialValue(
          { myProfile: user.toJSON() },
          subscribeToUser(user.id, "myProfile"),
        );
      },
    },
    myHand: {
      subscribe: (_: unknown, __: unknown, ctx: GraphQLContext) =>
        subscribeToUser(requireUser(ctx).id, "myHand"),
    },
    givenCards: {
      subscribe: (_: unknown, __: unknown, ctx: GraphQLContext) =>
        subscribeToUser(requireUser(ctx).id, "givenCards"),
    },
    playerJoined: broadcast("playerJoined"),
    playerLeft: broadcast("playerLeft"),
    rules: broadcast("rules"),
    decks: broadcast("decks"),
    game: broadcast("game"),
    gameEnded: broadcast("gameEnded"),
    winnerSelected: broadcast("winnerSelected"),
    closeModal: broadcast("closeModal"),
    holdGame: broadcast("holdGame"),
  },
};
