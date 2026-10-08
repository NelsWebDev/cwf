import { ApolloClient, HttpLink, InMemoryCache, split } from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { createClient } from "graphql-ws";

export const USER_ID_KEY = "userId";

// Close codes sent by the server (see SocketManager / graphql-ws).
export const CLOSE_CODE_DISCONNECTED = 4000;
export const CLOSE_CODE_FORBIDDEN = 4403;

const httpUrl: string = import.meta.env.VITE_GRAPHQL_URL || "/api/graphql";
const wsUrl = new URL(httpUrl, window.location.href);
wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";

export const closeCodeOf = (event: unknown) =>
  typeof event === "object" && event !== null && "code" in event ? (event as { code: unknown }).code : undefined;

// Created lazily: the socket only opens while there is at least one active subscription.
export const wsClient = createClient({
  url: wsUrl.toString(),
  lazy: true,
  keepAlive: 10_000,
  connectionParams: () => ({ userId: localStorage.getItem(USER_ID_KEY) || "" }),
  shouldRetry: (event) => {
    const code = closeCodeOf(event);
    return code !== CLOSE_CODE_DISCONNECTED && code !== CLOSE_CODE_FORBIDDEN;
  },
});

const httpLink = new HttpLink({
  uri: httpUrl,
  fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    const userId = localStorage.getItem(USER_ID_KEY);
    if (userId) {
      headers.set("x-user-id", userId);
    }
    return fetch(input, { ...init, headers });
  },
});

const wsLink = new GraphQLWsLink(wsClient);

const link = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return definition.kind === "OperationDefinition" && definition.operation === "subscription";
  },
  wsLink,
  httpLink,
);

// Game state is owned by the server and changes constantly, so nothing is read from or written to the cache.
export const apolloClient = new ApolloClient({
  link,
  cache: new InMemoryCache(),
  defaultOptions: {
    query: { fetchPolicy: "no-cache" },
    watchQuery: { fetchPolicy: "no-cache" },
    mutate: { fetchPolicy: "no-cache" },
  },
});
