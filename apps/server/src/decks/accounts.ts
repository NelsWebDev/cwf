import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { prismaClient } from "../singletons";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (email: unknown): string | undefined => {
  if (typeof email !== "string") return undefined;
  const value = email.trim().toLowerCase();
  return value.length <= 254 && EMAIL_REGEX.test(value) ? value : undefined;
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
};

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const createSession = async (accountId: string): Promise<string> => {
  const token = randomBytes(32).toString("base64url");
  await prismaClient.accountSession.create({
    data: { tokenHash: hashToken(token), accountId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  return token;
};

export const findAccountByToken = async (token: string) => {
  const session = await prismaClient.accountSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { account: { select: { id: true, email: true } } },
  });
  if (!session) return undefined;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prismaClient.accountSession.deleteMany({ where: { tokenHash: session.tokenHash } });
    return undefined;
  }
  return session.account;
};

export const destroySession = (token: string) =>
  prismaClient.accountSession.deleteMany({ where: { tokenHash: hashToken(token) } });

// Fixed-window in-memory limiter for the unauthenticated auth endpoints.
export const createRateLimiter = (max: number, windowMs: number) => {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string): boolean => {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      }
      return true;
    }
    entry.count += 1;
    return entry.count <= max;
  };
};
