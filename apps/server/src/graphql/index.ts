import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@as-integrations/express5";
import { makeExecutableSchema } from "@graphql-tools/schema";
import cors from "cors";
import { json } from "express";
import { useServer } from "graphql-ws/use/ws";
import { WebSocketServer } from "ws";
import { httpServer, express } from "../singletons";
import { rooms } from "../rooms";
import type { GameRoom } from "../room/GameRoom";
import type { GameUser } from "../session/GameUser";
import { verifyToken } from "../session/token";
import { isValidApiKey, type GraphQLContext } from "./context";
import { resolvers } from "./resolvers";
import { typeDefs } from "./typeDefs";

export const GRAPHQL_PATH = "/api/graphql";

type ConnectionExtra = { room: GameRoom; user?: GameUser; admin?: boolean };

const bearerToken = (header: string | undefined) => header?.match(/^Bearer (.+)$/i)?.[1];

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
      context: (ctx): GraphQLContext => ({
        room: ctx.extra.room,
        user: ctx.extra.user,
        admin: ctx.extra.admin,
      }),
      onConnect: (ctx) => {
        const params = ctx.connectionParams;
        const room = rooms.defaultRoom;
        const user = room.userFromToken(verifyToken(params?.token));
        const admin = isValidApiKey(params?.["x-api-key"]);
        if (!user && !admin) {
          return false;
        }
        ctx.extra.room = room;
        ctx.extra.admin = admin;
        if (user) {
          ctx.extra.user = user;
          ctx.extra.room.onConnection(user, ctx.extra.socket);
        }
      },
      onClose: (ctx) => {
        if (ctx.extra.user) {
          ctx.extra.room.onDisconnection(ctx.extra.user, ctx.extra.socket);
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
        const claims = verifyToken(bearerToken(req.header("authorization")));
        const room = rooms.defaultRoom;
        return {
          room,
          claims,
          user: room.userFromToken(claims),
          admin: isValidApiKey(req.header("x-api-key")),
        };
      },
    }),
  );
}
