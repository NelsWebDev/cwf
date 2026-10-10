import { Router, json, type NextFunction, type Request, type Response } from "express";
import { DECK_LIMITS, calculatePick } from "@repo/shared/deckRules";
import { Prisma } from "../prisma/generated/client";
import { prismaClient } from "../singletons";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  createRateLimiter,
  createSession,
  destroySession,
  findAccountByToken,
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from "./accounts";

export const DECK_API_PATH = "/api/manage";

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type AuthedRequest = Request & { accountId: string; token: string };

const bearerToken = (req: Request) => {
  const header = req.header("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
};

const requireAccount = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = bearerToken(req);
    const account = token ? await findAccountByToken(token) : undefined;
    if (!token || !account) throw new HttpError(401, "Please log in again");
    Object.assign(req, { accountId: account.id, token });
    next();
  } catch (error) {
    next(error);
  }
};

type Handler<R extends Request = Request> = (req: R, res: Response) => Promise<unknown>;
const wrap =
  <R extends Request = Request>(handler: Handler<R>) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req as R, res).catch(next);
  };

const text = (value: unknown, field: string, max: number, required = true): string | undefined => {
  if (value === undefined || value === null || value === "") {
    if (required) throw new HttpError(400, `${field} is required`);
    return undefined;
  }
  if (typeof value !== "string") throw new HttpError(400, `${field} must be a string`);
  const trimmed = value.trim();
  if (!trimmed && required) throw new HttpError(400, `${field} is required`);
  if (trimmed.length > max) throw new HttpError(400, `${field} must be at most ${max} characters`);
  return trimmed;
};

const deckSummarySelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { blackCards: true, whiteCards: true } },
} satisfies Prisma.DeckSelect;

type DeckSummary = Prisma.DeckGetPayload<{ select: typeof deckSummarySelect }>;

const toSummary = ({ _count, ...deck }: DeckSummary) => ({
  ...deck,
  numberOfBlackCards: _count.blackCards,
  numberOfWhiteCards: _count.whiteCards,
});

const findOwnedDeck = async (id: string, accountId: string) => {
  const deck = await prismaClient.deck.findFirst({ where: { id, ownerId: accountId }, select: { id: true } });
  if (!deck) throw new HttpError(404, "Deck not found");
  return deck;
};

const deckDetail = async (id: string) => {
  const deck = await prismaClient.deck.findUniqueOrThrow({
    where: { id },
    select: {
      ...deckSummarySelect,
      blackCards: { select: { blackCard: { select: { id: true, text: true, pick: true, createdAt: true } } } },
      whiteCards: { select: { whiteCard: { select: { id: true, text: true, createdAt: true } } } },
    },
  });
  const { blackCards, whiteCards, ...rest } = deck;
  const byCreated = <T extends { createdAt: Date }>(a: T, b: T) => a.createdAt.getTime() - b.createdAt.getTime();
  return {
    ...toSummary(rest),
    blackCards: blackCards.map((c) => c.blackCard).sort(byCreated).map(({ createdAt: _, ...c }) => c),
    whiteCards: whiteCards.map((c) => c.whiteCard).sort(byCreated).map(({ createdAt: _, ...c }) => c),
  };
};

export const createDeckRouter = () => {
  const router = Router();
  router.use(json({ limit: "1mb" }));

  const authLimiter = createRateLimiter(20, 15 * 60 * 1000);
  const limitAuth = (req: Request, _res: Response, next: NextFunction) =>
    next(authLimiter(req.ip ?? "unknown") ? undefined : new HttpError(429, "Too many attempts. Try again later"));

  const credentials = (req: Request) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!email) throw new HttpError(400, "Enter a valid email address");
    if (typeof password !== "string" || password.length > MAX_PASSWORD_LENGTH) {
      throw new HttpError(400, "Enter a valid password");
    }
    return { email, password };
  };

  router.post(
    "/auth/register",
    limitAuth,
    wrap(async (req, res) => {
      const { email, password } = credentials(req);
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      }
      const passwordHash = await hashPassword(password);
      try {
        const account = await prismaClient.account.create({ data: { email, passwordHash } });
        res.status(201).json({ token: await createSession(account.id), account: { id: account.id, email } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new HttpError(409, "An account with that email already exists");
        }
        throw error;
      }
    }),
  );

  router.post(
    "/auth/login",
    limitAuth,
    wrap(async (req, res) => {
      const { email, password } = credentials(req);
      const account = await prismaClient.account.findUnique({ where: { email } });
      const valid = account
        ? await verifyPassword(password, account.passwordHash)
        : (await hashPassword(password), false);
      if (!account || !valid) throw new HttpError(401, "Incorrect email or password");
      res.json({ token: await createSession(account.id), account: { id: account.id, email } });
    }),
  );

  router.post(
    "/auth/logout",
    requireAccount,
    wrap<AuthedRequest>(async (req, res) => {
      await destroySession(req.token);
      res.sendStatus(204);
    }),
  );

  router.get(
    "/auth/me",
    requireAccount,
    wrap<AuthedRequest>(async (req, res) => {
      const account = await prismaClient.account.findUniqueOrThrow({
        where: { id: req.accountId },
        select: { id: true, email: true },
      });
      res.json({ account });
    }),
  );

  router.use("/decks", requireAccount);

  router.get(
    "/decks",
    wrap<AuthedRequest>(async (req, res) => {
      const decks = await prismaClient.deck.findMany({
        where: { ownerId: req.accountId },
        select: deckSummarySelect,
        orderBy: { createdAt: "desc" },
      });
      res.json({ decks: decks.map(toSummary) });
    }),
  );

  router.post(
    "/decks",
    wrap<AuthedRequest>(async (req, res) => {
      const name = text(req.body?.name, "Name", DECK_LIMITS.name)!;
      const description = text(req.body?.description, "Description", DECK_LIMITS.description, false);
      const deck = await prismaClient.deck.create({
        data: { name, description: description ?? null, ownerId: req.accountId },
        select: { id: true },
      });
      res.status(201).json({ deck: await deckDetail(deck.id) });
    }),
  );

  router.get(
    "/decks/:deckId",
    wrap<AuthedRequest>(async (req, res) => {
      const { id } = await findOwnedDeck(String(req.params.deckId), req.accountId);
      res.json({ deck: await deckDetail(id) });
    }),
  );

  router.patch(
    "/decks/:deckId",
    wrap<AuthedRequest>(async (req, res) => {
      const { id } = await findOwnedDeck(String(req.params.deckId), req.accountId);
      const data: Prisma.DeckUpdateInput = {};
      if (req.body?.name !== undefined) data.name = text(req.body.name, "Name", DECK_LIMITS.name)!;
      if (req.body?.description !== undefined) {
        data.description = text(req.body.description, "Description", DECK_LIMITS.description, false) ?? null;
      }
      await prismaClient.deck.update({ where: { id }, data });
      res.json({ deck: await deckDetail(id) });
    }),
  );

  router.delete(
    "/decks/:deckId",
    wrap<AuthedRequest>(async (req, res) => {
      const { id } = await findOwnedDeck(String(req.params.deckId), req.accountId);
      // Cards in managed decks belong to exactly one deck, so they are removed with it.
      await prismaClient.$transaction(async (tx) => {
        await tx.blackCard.deleteMany({ where: { decksCards: { some: { deckId: id } } } });
        await tx.whiteCard.deleteMany({ where: { decksCards: { some: { deckId: id } } } });
        await tx.deck.delete({ where: { id } });
      });
      res.sendStatus(204);
    }),
  );

  router.post(
    "/decks/:deckId/black-cards",
    wrap<AuthedRequest>(async (req, res) => {
      const { id } = await findOwnedDeck(String(req.params.deckId), req.accountId);
      const cardText = text(req.body?.text, "Card text", DECK_LIMITS.cardText)!;
      if ((await prismaClient.deckBlackCard.count({ where: { deckId: id } })) >= DECK_LIMITS.blackCards) {
        throw new HttpError(400, `A deck can have at most ${DECK_LIMITS.blackCards} black cards`);
      }
      await prismaClient.blackCard.create({
        data: { text: cardText, pick: calculatePick(cardText), decksCards: { create: { deckId: id } } },
      });
      res.status(201).json({ deck: await deckDetail(id) });
    }),
  );

  router.post(
    "/decks/:deckId/white-cards",
    wrap<AuthedRequest>(async (req, res) => {
      const { id } = await findOwnedDeck(String(req.params.deckId), req.accountId);
      const cardText = text(req.body?.text, "Card text", DECK_LIMITS.cardText)!;
      if ((await prismaClient.deckWhiteCard.count({ where: { deckId: id } })) >= DECK_LIMITS.whiteCards) {
        throw new HttpError(400, `A deck can have at most ${DECK_LIMITS.whiteCards} white cards`);
      }
      await prismaClient.whiteCard.create({
        data: { text: cardText, decksCards: { create: { deckId: id } } },
      });
      res.status(201).json({ deck: await deckDetail(id) });
    }),
  );

  router.patch(
    "/decks/:deckId/black-cards/:cardId",
    wrap<AuthedRequest>(async (req, res) => {
      const { id } = await findOwnedDeck(String(req.params.deckId), req.accountId);
      const cardText = text(req.body?.text, "Card text", DECK_LIMITS.cardText)!;
      const { count } = await prismaClient.blackCard.updateMany({
        where: { id: String(req.params.cardId), decksCards: { some: { deckId: id } } },
        data: { text: cardText, pick: calculatePick(cardText) },
      });
      if (!count) throw new HttpError(404, "Card not found");
      res.json({ deck: await deckDetail(id) });
    }),
  );

  router.patch(
    "/decks/:deckId/white-cards/:cardId",
    wrap<AuthedRequest>(async (req, res) => {
      const { id } = await findOwnedDeck(String(req.params.deckId), req.accountId);
      const { count } = await prismaClient.whiteCard.updateMany({
        where: { id: String(req.params.cardId), decksCards: { some: { deckId: id } } },
        data: { text: text(req.body?.text, "Card text", DECK_LIMITS.cardText)! },
      });
      if (!count) throw new HttpError(404, "Card not found");
      res.json({ deck: await deckDetail(id) });
    }),
  );

  router.delete(
    "/decks/:deckId/black-cards/:cardId",
    wrap<AuthedRequest>(async (req, res) => {
      const { id } = await findOwnedDeck(String(req.params.deckId), req.accountId);
      const { count } = await prismaClient.blackCard.deleteMany({
        where: { id: String(req.params.cardId), decksCards: { some: { deckId: id } } },
      });
      if (!count) throw new HttpError(404, "Card not found");
      res.json({ deck: await deckDetail(id) });
    }),
  );

  router.delete(
    "/decks/:deckId/white-cards/:cardId",
    wrap<AuthedRequest>(async (req, res) => {
      const { id } = await findOwnedDeck(String(req.params.deckId), req.accountId);
      const { count } = await prismaClient.whiteCard.deleteMany({
        where: { id: String(req.params.cardId), decksCards: { some: { deckId: id } } },
      });
      if (!count) throw new HttpError(404, "Card not found");
      res.json({ deck: await deckDetail(id) });
    }),
  );

  router.use((_req, _res, next) => next(new HttpError(404, "Not found")));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof SyntaxError) {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
    console.error("Deck manager request failed:", error);
    res.status(500).json({ error: "Something went wrong" });
  });

  return router;
};
