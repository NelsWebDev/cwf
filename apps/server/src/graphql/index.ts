import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@as-integrations/express5";
import { makeExecutableSchema } from "@graphql-tools/schema";
import cors from "cors";
import { json } from "express";
import { useServer } from "graphql-ws/use/ws";
import { WebSocketServer } from "ws";
import { httpServer, express, socketManager } from "../singletons";
import type { GameUser } from "../session/GameUser";
import { isValidApiKey, type GraphQLContext } from "./context";
import { resolvers } from "./resolvers";
import { typeDefs } from "./typeDefs";

export const GRAPHQL_PATH = "/api/graphql";

type ConnectionExtra = { user?: GameUser; admin?: boolean };

export async function startGraphQL() {
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // noServer so upgrade requests for other paths (e.g. Vite's HMR socket in development) are left alone
  // instead of being rejected by this server.
  const wsServer = new WebSocketServer({ noServer: true });
  httpServer.on("upgrade", (request, socket, head) => {
    const { pathname } = new URL(request.url ?? "/", "http://localhost");
    if (pathname === GRAPHQL_PATH) {
      wsServer.handleUpgrade(request, socket, head, (ws) => wsServer.emit("connection", ws, request));
    }
  });
  const wsCleanup = useServer<Record<string, unknown>, ConnectionExtra>(
    {
      schema,
      context: (ctx): GraphQLContext => ({ user: ctx.extra.user, admin: ctx.extra.admin }),
      onConnect: (ctx) => {
        const params = ctx.connectionParams;
        const userId = params?.userId ?? params?.["x-user-id"];
        const user = typeof userId === "string" ? socketManager.gameUsers.get(userId) : undefined;
        const admin = isValidApiKey(params?.["x-api-key"]);
        if (!user && !admin) {
          return false;
        }
        ctx.extra.admin = admin;
        if (user) {
          ctx.extra.user = user;
          socketManager.onConnection(user, ctx.extra.socket);
        }
      },
      onClose: (ctx) => {
        if (ctx.extra.user) {
          socketManager.onDisconnection(ctx.extra.user, ctx.extra.socket);
        }
      },
    },
    wsServer,
  );

  const apollo = new ApolloServer<GraphQLContext>({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return { drainServer: async () => wsCleanup.dispose() };
        },
      },
    ],
  });
  await apollo.start();

  express.use(
    GRAPHQL_PATH,
    cors({ origin: "*" }),
    json(),
    expressMiddleware(apollo, {
      context: async ({ req }): Promise<GraphQLContext> => {
        const userId = req.header("x-user-id");
        return {
          user: userId ? socketManager.gameUsers.get(userId) : undefined,
          admin: isValidApiKey(req.header("x-api-key")),
        };
      },
    }),
  );
}
