import { describe, expect, it, vi } from "vitest";

vi.mock("../singletons", () => ({ prismaClient: {} }));

import { createRateLimiter, hashPassword, normalizeEmail, verifyPassword } from "./accounts";

describe("normalizeEmail", () => {
  it("trims and lowercases valid emails", () => {
    expect(normalizeEmail("  Foo@Example.COM ")).toBe("foo@example.com");
  });

  it("rejects invalid values", () => {
    expect(normalizeEmail("nope")).toBeUndefined();
    expect(normalizeEmail(42)).toBeUndefined();
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
});

describe("createRateLimiter", () => {
  it("blocks after the limit within the window", () => {
    const allow = createRateLimiter(2, 1000);
    expect([allow("a"), allow("a"), allow("a"), allow("b")]).toEqual([true, true, false, true]);
  });
});
