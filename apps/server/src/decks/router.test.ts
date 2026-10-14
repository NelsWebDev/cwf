import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prismaClient: {
    deck: { findFirst: vi.fn(), findMany: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
    blackCard: { create: vi.fn(), updateMany: vi.fn() },
    whiteCard: { create: vi.fn(), updateMany: vi.fn() },
    deckBlackCard: { count: vi.fn() },
    deckWhiteCard: { count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../singletons", () => ({ prismaClient: mocks.prismaClient }));
vi.mock("./accounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./accounts")>()),
  findAccountByToken: vi.fn(async () => ({ id: "account-1" })),
}));

import { createDeckRouter, DECK_API_PATH } from "./router";

const db = mocks.prismaClient;
const liveBlack = { blackCard: { deletedAt: null } };
const liveWhite = { whiteCard: { deletedAt: null } };

let server: Server;
let baseUrl: string;

const request = (method: string, path: string, body?: unknown) =>
  fetch(`${baseUrl}${DECK_API_PATH}${path}`, {
    method,
    headers: { authorization: "Bearer token", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const emptyDeck = {
  id: "deck-1",
  name: "Deck",
  description: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  _count: { blackCards: 0, whiteCards: 0 },
  blackCards: [],
  whiteCards: [],
};

beforeAll(async () => {
  const app = express();
  app.use(DECK_API_PATH, createDeckRouter());
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  vi.resetAllMocks();
  db.deck.findFirst.mockResolvedValue({ id: "deck-1" });
  db.deck.findUniqueOrThrow.mockResolvedValue(emptyDeck);
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
});

describe("deck router soft deletes", () => {
  it("only manages decks that are not official or deleted", async () => {
    await request("GET", "/decks/deck-1");
    expect(db.deck.findFirst).toHaveBeenCalledWith({
      where: { id: "deck-1", cahOfficial: false, deletedAt: null },
      select: { id: true },
    });

    db.deck.findFirst.mockResolvedValue(null);
    expect((await request("DELETE", "/decks/deck-1")).status).toBe(404);
  });

  it("lists every live deck regardless of creator, counting only live cards", async () => {
    db.deck.findMany.mockResolvedValue([]);
    await request("GET", "/decks");
    const args = db.deck.findMany.mock.calls[0]![0];
    expect(args.where).toEqual({ cahOfficial: false, deletedAt: null });
    expect(args.select._count.select).toEqual({
      blackCards: { where: liveBlack },
      whiteCards: { where: liveWhite },
    });
  });

  it("hides soft-deleted cards from deck detail", async () => {
    await request("GET", "/decks/deck-1");
    const select = db.deck.findUniqueOrThrow.mock.calls[0]![0].select;
    expect(select.blackCards.where).toEqual(liveBlack);
    expect(select.whiteCards.where).toEqual(liveWhite);
  });

  it("records the creator on new decks", async () => {
    db.deck.create.mockResolvedValue({ id: "deck-1" });
    const response = await request("POST", "/decks", { name: "New" });
    expect(response.status).toBe(201);
    expect(db.deck.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: "New", description: null, createdById: "account-1" } }),
    );
  });

  it("soft-deletes a deck and its cards instead of removing them", async () => {
    const response = await request("DELETE", "/decks/deck-1");
    expect(response.status).toBe(204);

    const deletedAt = db.deck.update.mock.calls[0]![0].data.deletedAt;
    expect(deletedAt).toBeInstanceOf(Date);
    expect(db.deck.update).toHaveBeenCalledWith({ where: { id: "deck-1" }, data: { deletedAt } });
    expect(db.blackCard.updateMany).toHaveBeenCalledWith({
      where: { deletedAt: null, decksCards: { some: { deckId: "deck-1" } } },
      data: { deletedAt },
    });
    expect(db.whiteCard.updateMany).toHaveBeenCalledWith({
      where: { deletedAt: null, decksCards: { some: { deckId: "deck-1" } } },
      data: { deletedAt },
    });
  });

  it.each(["black", "white"] as const)("soft-deletes a single %s card", async (color) => {
    const model = db[`${color}Card`];
    model.updateMany.mockResolvedValue({ count: 1 });
    const response = await request("DELETE", `/decks/deck-1/${color}-cards/card-1`);
    expect(response.status).toBe(200);
    expect(model.updateMany).toHaveBeenCalledWith({
      where: { id: "card-1", deletedAt: null, decksCards: { some: { deckId: "deck-1" } } },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it.each(["black", "white"] as const)("returns 404 when deleting an already deleted %s card", async (color) => {
    db[`${color}Card`].updateMany.mockResolvedValue({ count: 0 });
    expect((await request("DELETE", `/decks/deck-1/${color}-cards/card-1`)).status).toBe(404);
  });

  it.each(["black", "white"] as const)("does not edit a deleted %s card", async (color) => {
    const model = db[`${color}Card`];
    model.updateMany.mockResolvedValue({ count: 0 });
    expect((await request("PATCH", `/decks/deck-1/${color}-cards/card-1`, { text: "x" })).status).toBe(404);
    expect(model.updateMany.mock.calls[0]![0].where).toMatchObject({ id: "card-1", deletedAt: null });
  });

  it("does not count deleted cards toward the deck limits", async () => {
    db.deckBlackCard.count.mockResolvedValue(0);
    db.blackCard.create.mockResolvedValue({});
    await request("POST", "/decks/deck-1/black-cards", { text: "Hello" });
    expect(db.deckBlackCard.count).toHaveBeenCalledWith({ where: { deckId: "deck-1", ...liveBlack } });

    db.deckWhiteCard.count.mockResolvedValue(0);
    db.whiteCard.create.mockResolvedValue({});
    await request("POST", "/decks/deck-1/white-cards", { text: "Hello" });
    expect(db.deckWhiteCard.count).toHaveBeenCalledWith({ where: { deckId: "deck-1", ...liveWhite } });
  });
});
