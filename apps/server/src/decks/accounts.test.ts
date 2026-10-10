import { describe, expect, it, vi } from "vitest";

vi.mock("../singletons", () => ({ prismaClient: {} }));

import {
  createRateLimiter,
  googleEmailFromPayload,
  hashPassword,
  normalizeEmail,
  verifyAccountPassword,
  verifyPassword,
} from "./accounts";

describe("normalizeEmail", () => {
  it("trims and lowercases valid emails", () => {
    expect(normalizeEmail("  Foo@Example.COM ")).toBe("foo@example.com");
  });

  it("rejects invalid values", () => {
    expect(normalizeEmail("nope")).toBeUndefined();
    expect(normalizeEmail(42)).toBeUndefined();
  });
});

describe("Google account email validation", () => {
  it("normalizes a verified Google email", () => {
    expect(googleEmailFromPayload({ email: " Owner@Example.com ", email_verified: true })).toBe("owner@example.com");
  });

  it("rejects unverified, malformed, and missing emails", () => {
    expect(googleEmailFromPayload({ email: "owner@example.com", email_verified: false })).toBeUndefined();
    expect(googleEmailFromPayload({ email: "not-an-email", email_verified: true })).toBeUndefined();
    expect(googleEmailFromPayload(undefined)).toBeUndefined();
  });
});

describe("password hashing", () => {
  it("verifies the right password only", async () => {
    const hash = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("salts each hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("rejects password login for passwordless accounts", async () => {
    expect(await verifyAccountPassword("any password", null)).toBe(false);
  });

  it("verifies passwords for password accounts", async () => {
    const hash = await hashPassword("correct horse");
    expect(await verifyAccountPassword("correct horse", hash)).toBe(true);
    expect(await verifyAccountPassword("wrong", hash)).toBe(false);
  });
});

describe("createRateLimiter", () => {
  it("blocks after the limit within the window", () => {
    const allow = createRateLimiter(2, 1000);
    expect([allow("a"), allow("a"), allow("a"), allow("b")]).toEqual([true, true, false, true]);
  });
});
