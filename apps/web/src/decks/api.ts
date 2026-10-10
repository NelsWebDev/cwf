const graphqlUrl: string = import.meta.env.VITE_GRAPHQL_URL || "/api/graphql";
const BASE_URL = graphqlUrl.replace(/\/graphql\/?$/, "/manage");

export const DECK_TOKEN_KEY = "deckManagerToken";

export type Account = { id: string; email: string };
export type DeckSummary = {
  id: string;
  name: string;
  description: string | null;
  numberOfBlackCards: number;
  numberOfWhiteCards: number;
  createdAt: string;
  updatedAt: string;
};
export type ManagedBlackCard = { id: string; text: string; pick: number };
export type ManagedWhiteCard = { id: string; text: string };
export type DeckDetail = DeckSummary & { blackCards: ManagedBlackCard[]; whiteCards: ManagedWhiteCard[] };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Called when the server rejects the stored token, so the UI can drop back to the login screen.
let onUnauthorized: (() => void) | undefined;
export const setUnauthorizedHandler = (handler: (() => void) | undefined) => {
  onUnauthorized = handler;
};

const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  const token = localStorage.getItem(DECK_TOKEN_KEY);
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    if (response.status === 401 && token) onUnauthorized?.();
    throw new ApiError(response.status, data.error ?? "Something went wrong");
  }
  return data as T;
};

type AuthResult = { token: string; account: Account };

export const deckApi = {
  register: (email: string, password: string) => request<AuthResult>("POST", "/auth/register", { email, password }),
  login: (email: string, password: string) => request<AuthResult>("POST", "/auth/login", { email, password }),
  logout: () => request<void>("POST", "/auth/logout"),
  me: () => request<{ account: Account }>("GET", "/auth/me"),
  listDecks: () => request<{ decks: DeckSummary[] }>("GET", "/decks"),
  createDeck: (name: string, description: string) =>
    request<{ deck: DeckDetail }>("POST", "/decks", { name, description }),
  getDeck: (id: string) => request<{ deck: DeckDetail }>("GET", `/decks/${id}`),
  updateDeck: (id: string, data: { name?: string; description?: string }) =>
    request<{ deck: DeckDetail }>("PATCH", `/decks/${id}`, data),
  deleteDeck: (id: string) => request<void>("DELETE", `/decks/${id}`),
  addCard: (id: string, kind: "black" | "white", text: string) =>
    request<{ deck: DeckDetail }>("POST", `/decks/${id}/${kind}-cards`, { text }),
  updateCard: (id: string, kind: "black" | "white", cardId: string, text: string) =>
    request<{ deck: DeckDetail }>("PATCH", `/decks/${id}/${kind}-cards/${cardId}`, { text }),
  deleteCard: (id: string, kind: "black" | "white", cardId: string) =>
    request<{ deck: DeckDetail }>("DELETE", `/decks/${id}/${kind}-cards/${cardId}`),
};
