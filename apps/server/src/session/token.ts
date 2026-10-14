import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

export type TokenClaims = {
  /** User id */
  sub: string;
  username: string;
  discordName?: string | undefined;
};

type Payload = TokenClaims & { iat: number; exp: number };

let fallbackSecret: Buffer | undefined;

// Tokens only survive a restart when the secret is stable, so prefer JWT_SECRET, then derive one from the game password.
const getSecret = (): string | Buffer => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.GAME_PASSWORD) return `cwf-session:${process.env.GAME_PASSWORD}`;
  if (!fallbackSecret) {
    console.warn("JWT_SECRET is not set: sessions will not survive a server restart");
    fallbackSecret = randomBytes(32);
  }
  return fallbackSecret;
};

const b64 = (input: string | Buffer) => Buffer.from(input).toString("base64url");
const sign = (data: string) => createHmac("sha256", getSecret()).update(data).digest();

const HEADER = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));

export const signToken = (claims: TokenClaims): string => {
  const iat = Math.floor(Date.now() / 1000);
  const payload: Payload = { ...claims, iat, exp: iat + TOKEN_TTL_SECONDS };
  const data = `${HEADER}.${b64(JSON.stringify(payload))}`;
  return `${data}.${b64(sign(data))}`;
};

export const verifyToken = (token: unknown): TokenClaims | undefined => {
  if (typeof token !== "string") return undefined;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== HEADER) return undefined;
  const [header, body, signature] = parts as [string, string, string];
  const expected = sign(`${header}.${body}`);
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<Payload>;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return undefined;
    if (typeof payload.sub !== "string" || typeof payload.username !== "string") return undefined;
    return {
      sub: payload.sub,
      username: payload.username,
      discordName: typeof payload.discordName === "string" ? payload.discordName : undefined,
    };
  } catch {
    return undefined;
  }
};

export const tokenForUser = (user: { id: string; username: string; discordName?: string | undefined }) =>
  signToken({ sub: user.id, username: user.username, discordName: user.discordName });
