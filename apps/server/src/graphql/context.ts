import { GraphQLError } from "graphql";
import type { GameUser } from "../session/GameUser";

export type GraphQLContext = {
  user?: GameUser | undefined;
};

export const requireUser = (ctx: GraphQLContext): GameUser => {
  if (!ctx.user) {
    throw new GraphQLError("Invalid session. Please login again", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return ctx.user;
};
