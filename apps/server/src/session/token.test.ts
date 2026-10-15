import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signToken, verifyToken, TOKEN_TTL_SECONDS } from "./token";

describe("token", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("round-trips claims", () => {
    vi.stubEnv("JWT_SECRET", "secret");
    const token = signToken({ sub: "u1", username: "alice", discordName: "Al" });
    expect(verifyToken(token)).toEqual({ sub: "u1", username: "alice", discordName: "Al" });
  });

  it("rejects tampered tokens and other secrets", () => {
    vi.stubEnv("JWT_SECRET", "secret");
    const token = signToken({ sub: "u1", username: "alice" });
    const [h, , s] = token.split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify({ sub: "u2", username: "x", exp: 9e12 })).toString("base64url")}.${s}`;
    expect(verifyToken(forged)).toBeUndefined();
    vi.stubEnv("JWT_SECRET", "other");
    expect(verifyToken(token)).toBeUndefined();
  });

  it("rejects expired and malformed tokens", () => {
    vi.stubEnv("JWT_SECRET", "secret");
    vi.useFakeTimers();
    const token = signToken({ sub: "u1", username: "alice" });
    vi.setSystemTime(Date.now() + (TOKEN_TTL_SECONDS + 1) * 1000);
    expect(verifyToken(token)).toBeUndefined();
    expect(verifyToken("nope")).toBeUndefined();
    expect(verifyToken(undefined)).toBeUndefined();
  });

  it("signs with a key derived from the game password when no JWT secret is set", () => {
    vi.stubEnv("JWT_SECRET", "");
    vi.stubEnv("GAME_PASSWORD", "pw");
    const token = signToken({ sub: "u1", username: "alice" });
    expect(verifyToken(token)).toMatchObject({ sub: "u1" });
    vi.stubEnv("GAME_PASSWORD", "other");
    expect(verifyToken(token)).toBeUndefined();
  });

  it("falls back to a random per-process secret with a warning", () => {
    vi.stubEnv("JWT_SECRET", "");
    vi.stubEnv("GAME_PASSWORD", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const token = signToken({ sub: "u1", username: "alice" });
    expect(verifyToken(token)).toMatchObject({ sub: "u1" });
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("rejects well-signed tokens with a malformed payload", () => {
    vi.stubEnv("JWT_SECRET", "secret");
    const forge = (payload: unknown) => {
      const real = signToken({ sub: "u1", username: "alice" });
      const [h] = real.split(".");
      const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const sig = createHmac("sha256", "secret").update(`${h}.${body}`).digest("base64url");
      return `${h}.${body}.${sig}`;
    };
    expect(verifyToken(forge({ sub: 1, username: "a", exp: 9e12 }))).toBeUndefined();
    expect(verifyToken(forge({ sub: "u", username: "a" }))).toBeUndefined();
    expect(verifyToken(forge({ sub: "u", username: "a", exp: 9e12 }))).toEqual({
      sub: "u",
      username: "a",
      discordName: undefined,
    });
  });
});
