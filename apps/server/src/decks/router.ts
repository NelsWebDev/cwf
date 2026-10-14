import { Router, json, type NextFunction, type Request, type Response } from "express";
import { randomBytes } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { DECK_LIMITS, calculatePick } from "@repo/shared/deckRules";
import { Prisma } from "../prisma/generated/client";
import { prismaClient } from "../singletons";
import { liveBlackCards, liveCardCounts, liveWhiteCards } from "../CardManager";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  createRateLimiter,
  createSession,
  destroySession,
  findAccountByToken,
  hashPassword,
  normalizeEmail,
  googleEmailFromPayload,
  verifyAccountPassword,
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

const GOOGLE_STATE_COOKIE = "deck_google_oauth_state";
const publicAppUrl = () => (process.env.APP_URL || process.env.FRONTEND_URL)?.replace(/\/+$/, "");

const googleClient = () => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || (publicAppUrl() ? `${publicAppUrl()}/api/manage/auth/google/callback` : undefined);
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !redirectUri) {
    throw new HttpError(503, "Google login is not configured");
  }
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);
};

const cookieValue = (req: Request, name: string) =>
  req.header("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);

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
  _count: liveCardCounts,
} satisfies Prisma.DeckSelect;

type DeckSummary = Prisma.DeckGetPayload<{ select: typeof deckSummarySelect }>;

const toSummary = ({ _count, ...deck }: DeckSummary) => ({
  ...deck,
  numberOfBlackCards: _count.blackCards,
  numberOfWhiteCards: _count.whiteCards,
});

// Official CAH pack cards are shared between packs, so only non-official decks can be managed.
const managedDeckWhere = { cahOfficial: false, deletedAt: null } satisfies Prisma.DeckWhereInput;

const findDeck = async (id: string) => {
  const deck = await prismaClient.deck.findFirst({ where: { id, ...managedDeckWhere }, select: { id: true } });
  if (!deck) throw new HttpError(404, "Deck not found");
  return deck;
};

const deckDetail = async (id: string) => {
  const deck = await prismaClient.deck.findUniqueOrThrow({
    where: { id },
    select: {
      ...deckSummarySelect,
      blackCards: { where: liveBlackCards, select: { blackCard: { select: { id: true, text: true, pick: true, createdAt: true } } } },
      whiteCards: { where: liveWhiteCards, select: { whiteCard: { select: { id: true, text: true, createdAt: true } } } },
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

  router.get(
    "/auth/google",
    limitAuth,
    wrap(async (req, res) => {
      const client = googleClient();
      const state = randomBytes(32).toString("base64url");
      res.setHeader(
        "Set-Cookie",
        `${GOOGLE_STATE_COOKIE}=${state}; HttpOnly; SameSite=Lax; Path=${DECK_API_PATH}/auth/google; Max-Age=600`,
      );
      res.redirect(
        client.generateAuthUrl({
          access_type: "online",
          scope: ["openid", "email", "profile"],
          state,
          prompt: "select_account",
        }),
      );
    }),
  );

  router.get(
    "/auth/google/callback",
    wrap(async (req, res) => {
      const destination = publicAppUrl();
      if (!destination) throw new HttpError(503, "Frontend URL is not configured");
      const state = typeof req.query.state === "string" ? req.query.state : undefined;
      if (!state || state !== cookieValue(req, GOOGLE_STATE_COOKIE)) throw new HttpError(400, "Invalid Google login state");
      const client = googleClient();
      const code = typeof req.query.code === "string" ? req.query.code : undefined;
      if (!code) throw new HttpError(400, "Google login was cancelled");
      const { tokens } = await client.getToken(code);
      if (!tokens.id_token) throw new HttpError(400, "Google did not return an identity token");
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();
      const email = googleEmailFromPayload(payload);
      if (!email) throw new HttpError(400, "Google account email is not verified");

      const account = await prismaClient.account.upsert({
        where: { email },
        update: {},
        create: { email, passwordHash: null },
      });
      const token = await createSession(account.id);
      res
        .setHeader("Set-Cookie", `${GOOGLE_STATE_COOKIE}=; HttpOnly; SameSite=Lax; Path=${DECK_API_PATH}/auth/google; Max-Age=0`)
        .redirect(`${destination}/decks#googleToken=${encodeURIComponent(token)}`);
    }),
  );

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
      const valid = await verifyAccountPassword(password, account?.passwordHash ?? null);
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
        where: managedDeckWhere,
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
        data: { name, description: description ?? null, createdById: req.accountId },
        select: { id: true },
      });
      res.status(201).json({ deck: await deckDetail(deck.id) });
    }),
  );

  router.get(
    "/decks/:deckId",
    wrap<AuthedRequest>(async (req, res) => {
      const { id } = await findDeck(String(req.params.deckId));
      res.json({ deck: await deckDetail(id) });
    }),
  );

  router.patch(
    "/decks/:deckId",
    wrap<AuthedRequest>(async (req, res) => {
      const { id } = await findDeck(String(req.params.deckId));
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
      const { id } = await findDeck(String(req.params.deckId));
      // Soft delete. Cards in managed decks belong to exactly one deck, so they are removed with it.
      const deletedAt = new Date();
      await prismaClient.$transaction(async (tx) => {
        await tx.blackCard.updateMany({ where: { deletedAt: null, decksCards: { some: { deckId: id } } }, data: { deletedAt } });
        await tx.whiteCard.updateMany({ where: { deletedAt: null, decksCards: { some: { deckId: id } } }, data: { deletedAt } });
        await tx.deck.update({ where: { id }, data: { deletedAt } });
      });
      res.sendStatus(204);
    }),
  );

  router.post(
    "/decks/:deckId/black-cards",
    wrap<AuthedRequest>(async (req, res) => {
      const { id } = await findDeck(String(req.params.deckId));
      const cardText = text(req.body?.text, "Card text", DECK_LIMITS.cardText)!;
      if ((await prismaClient.deckBlackCard.count({ where: { deckId: id, ...liveBlackCards } })) >= DECK_LIMITS.blackCards) {
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
      const { id } = await findDeck(String(req.params.deckId));
      const cardText = text(req.body?.text, "Card text", DECK_LIMITS.cardText)!;
      if ((await prismaClient.deckWhiteCard.count({ where: { deckId: id, ...liveWhiteCards } })) >= DECK_LIMITS.whiteCards) {
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
      const { id } = await findDeck(String(req.params.deckId));
      const cardText = text(req.body?.text, "Card text", DECK_LIMITS.cardText)!;
      const { count } = await prismaClient.blackCard.updateMany({
        where: { id: String(req.params.cardId), deletedAt: null, decksCards: { some: { deckId: id } } },
        data: { text: cardText, pick: calculatePick(cardText) },
      });
      if (!count) throw new HttpError(404, "Card not found");
      res.json({ deck: await deckDetail(id) });
    }),
  );

  router.patch(
    "/decks/:deckId/white-cards/:cardId",
    wrap<AuthedRequest>(async (req, res) => {
      const { id } = await findDeck(String(req.params.deckId));
      const { count } = await prismaClient.whiteCard.updateMany({
        where: { id: String(req.params.cardId), deletedAt: null, decksCards: { some: { deckId: id } } },
        data: { text: text(req.body?.text, "Card text", DECK_LIMITS.cardText)! },
      });
      if (!count) throw new HttpError(404, "Card not found");
      res.json({ deck: await deckDetail(id) });
    }),
  );

  router.delete(
    "/decks/:deckId/black-cards/:cardId",
    wrap<AuthedRequest>(async (req, res) => {
      const { id } = await findDeck(String(req.params.deckId));
      const { count } = await prismaClient.blackCard.updateMany({
        where: { id: String(req.params.cardId), deletedAt: null, decksCards: { some: { deckId: id } } },
        data: { deletedAt: new Date() },
      });
      if (!count) throw new HttpError(404, "Card not found");
      res.json({ deck: await deckDetail(id) });
    }),
  );

  router.delete(
    "/decks/:deckId/white-cards/:cardId",
    wrap<AuthedRequest>(async (req, res) => {
      const { id } = await findDeck(String(req.params.deckId));
      const { count } = await prismaClient.whiteCard.updateMany({
        where: { id: String(req.params.cardId), deletedAt: null, decksCards: { some: { deckId: id } } },
        data: { deletedAt: new Date() },
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
