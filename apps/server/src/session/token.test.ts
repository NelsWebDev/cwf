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
});
