import { GraphQLError } from "graphql";
import { timingSafeEqual } from "node:crypto";
import type { TokenClaims } from "../session/token";
import type { GameUser } from "../session/GameUser";
import type { GameRoom } from "../room/GameRoom";

export type GraphQLContext = {
  /** The room this request acts in */
  room: GameRoom;
  /** Verified token claims, present even when the user could not be restored (e.g. username now taken) */
  claims?: TokenClaims | undefined;
  user?: GameUser | undefined;
  admin?: boolean;
};

export const isValidApiKey = (key: unknown): boolean => {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected || typeof key !== "string") return false;
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

export const invalidSession = () =>
  new GraphQLError("Invalid session. Please login again", {
    extensions: { code: "UNAUTHENTICATED" },
  });

// For operations that don't act as a specific player: any logged-in user or the admin API key
export const requireAccess = (ctx: GraphQLContext): void => {
  if (!ctx.user && !ctx.admin) throw invalidSession();
};

export const requireUser = (ctx: GraphQLContext): GameUser => {
  if (!ctx.user) throw invalidSession();
  return ctx.user;
};
