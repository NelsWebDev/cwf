import { GraphQLError } from "graphql";
import { timingSafeEqual } from "node:crypto";
import type { GameUser } from "../session/GameUser";

export type GraphQLContext = {
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

const unauthenticated = () =>
  new GraphQLError("Invalid session. Please login again", {
    extensions: { code: "UNAUTHENTICATED" },
  });

// For operations that don't act as a specific player: any logged-in user or the admin API key
export const requireAccess = (ctx: GraphQLContext): void => {
  if (!ctx.user && !ctx.admin) throw unauthenticated();
};

export const requireUser = (ctx: GraphQLContext): GameUser => {
  if (!ctx.user) throw unauthenticated();
  return ctx.user;
};
