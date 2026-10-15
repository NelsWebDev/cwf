import { GraphQLError } from "graphql";
import { CardManager } from "../CardManager";
import { subscribeToRoom, subscribeToUser, type RoomTopics } from "../pubsub";
import { importDeck } from "../utils/cardImporter";
import { shareRoundToDiscord } from "../utils/shareRound";
import { tokenForUser } from "../session/token";
import { invalidSession, requireAccess, requireUser, type GraphQLContext } from "./context";
import type { GameRoom } from "../room/GameRoom";
import { type GameRound, type Rules, type WhiteCard } from "@repo/shared/types";

const badInput = (message: string) =>
  new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });

const MAX_NAME_LENGTH = 30;

/** Trims a requested username and checks it is present, short enough and free in the room. */
const validateUsername = (room: GameRoom, raw: string, exceptUserId?: string) => {
  const username = raw.trim();
  if (!username) throw badInput("Username is required");
  if (username.length > MAX_NAME_LENGTH) {
    throw badInput(`Username must be ${MAX_NAME_LENGTH} characters or fewer`);
  }
  if (!room.usernameAvailable(username, exceptUserId)) throw badInput("Username already in use");
  return username;
};

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

const broadcast = (name: keyof RoomTopics) => ({
  subscribe: (_: unknown, __: unknown, ctx: GraphQLContext) => subscribeToRoom(ctx.room.id, name),
});

export const resolvers = {
  GameRound: {
    plays: (round: GameRound) =>
      Object.entries(round.plays).map(([userId, cards]) => ({ userId, cards })),
    votesToSkip: (round: GameRound) =>
      Object.entries(round.votesToSkip).map(([userId, vote]) => ({ userId, vote })),
  },

  Query: {
    me: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.room.describe(requireUser(ctx)),
    players: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireAccess(ctx);
      return ctx.room.activeUsers.map((u) => ctx.room.describe(u));
    },
    game: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireAccess(ctx);
      return ctx.room.game.toJSON();
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
    login: (_: unknown, { username, password }: { username: string; password: string }, ctx: GraphQLContext) => {
      if (!username?.trim()) throw badInput("Username is required");
      if (!password) throw badInput("Password is required");
      if (password !== process.env.GAME_PASSWORD) throw badInput("Invalid password");
      const user = ctx.room.registerUser(validateUsername(ctx.room, username));
      return { token: tokenForUser(user), user: ctx.room.describe(user) };
    },
    // Restores a session from a still-valid token. If the old username was taken meanwhile, a new one must be supplied.
    rejoin: (_: unknown, { username }: { username?: string | null }, ctx: GraphQLContext) => {
      if (!ctx.claims) throw invalidSession();
      const { claims } = ctx;
      let user = ctx.user;
      if (!user) {
        // The client treats this code as "ask the player to pick another name".
        if (!username?.trim()) {
          throw new GraphQLError("Username already in use", { extensions: { code: "USERNAME_TAKEN" } });
        }
        user = ctx.room.registerUser(validateUsername(ctx.room, username), claims.sub, claims.discordName);
      }
      return { token: tokenForUser(user), user: ctx.room.describe(user) };
    },
    refreshToken: (_: unknown, __: unknown, ctx: GraphQLContext) => tokenForUser(requireUser(ctx)),
    updateUsername: (_: unknown, { username }: { username: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      ctx.room.renameUser(user, validateUsername(ctx.room, username, user.id));
      return ctx.room.describe(user);
    },
    updateDiscordName: (_: unknown, { discordName }: { discordName: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      const trimmed = discordName.trim();
      if (trimmed.length > MAX_NAME_LENGTH) {
        throw badInput(`Discord name must be ${MAX_NAME_LENGTH} characters or fewer`);
      }
      ctx.room.setDiscordName(user, trimmed || undefined);
      return ctx.room.describe(user);
    },
    logout: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      ctx.room.removeUser(requireUser(ctx));
      return true;
    },
    kickPlayer: (_: unknown, { userId }: { userId: string }, ctx: GraphQLContext) => {
      requireAccess(ctx);
      ctx.room.kick(userId);
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
      await ctx.room.game.addDeck(deckId);
      return true;
    },
    removeDeck: (_: unknown, { deckId }: { deckId: string }, ctx: GraphQLContext) => {
      requireAccess(ctx);
      ctx.room.game.removeDeck(deckId);
      return true;
    },
    updateRules: (_: unknown, { rules }: { rules: Partial<Rules> }, ctx: GraphQLContext) => {
      requireAccess(ctx);
      // Drop explicit nulls so omitted fields keep their current values.
      const changes = Object.fromEntries(
        Object.entries(rules).filter(([, value]) => value !== null && value !== undefined),
      );
      ctx.room.game.updateRules(changes);
      return ctx.room.game.rules;
    },
    startGame: async (
      _: unknown,
      { announceToDiscord }: { announceToDiscord?: boolean },
      ctx: GraphQLContext,
    ) => {
      requireAccess(ctx);
      await ctx.room.startGame({ announce: announceToDiscord === true });
      return true;
    },
    endGame: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireAccess(ctx);
      ctx.room.game.endGame();
      return true;
    },
    playCards: (_: unknown, { cards }: { cards: PlayInput[] }, ctx: GraphQLContext) => {
      ctx.room.game.playCards(requireUser(ctx), cards as WhiteCard[]);
      return true;
    },
    undoPlay: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      ctx.room.game.undoPlay(requireUser(ctx));
      return true;
    },
    requestNewHand: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      ctx.room.game.requestNewHand(requireUser(ctx));
      return true;
    },
    pickWinner: (_: unknown, { cardId }: { cardId: string }, ctx: GraphQLContext) => {
      ctx.room.game.pickWinner(requireUser(ctx), cardId);
      return true;
    },
    shareRoundToDiscord: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireUser(ctx);
      const { room } = ctx;
      await shareRoundToDiscord(room.game.currentRound, (userId) => room.players.findPlayer(userId)?.displayName ?? "Unknown");
      return true;
    },
    skipBlackCard: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      ctx.room.game.skipBlackCardAsCzar(requireUser(ctx));
      return true;
    },
    voteToSkipBlackCard: (_: unknown, { vote }: { vote: boolean }, ctx: GraphQLContext) => {
      ctx.room.game.voteToSkip(requireUser(ctx), vote);
      return true;
    },
  },

  Subscription: {
    myProfile: {
      subscribe: (_: unknown, __: unknown, ctx: GraphQLContext) => {
        const user = requireUser(ctx);
        return withInitialValue(
          { myProfile: ctx.room.describe(user) },
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
