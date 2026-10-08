import { afterEach, describe, expect, it } from "vitest";
import { isValidApiKey, requireAccess, requireUser } from "./context";

const originalAdminApiKey = process.env.ADMIN_API_KEY;

afterEach(() => {
  if (originalAdminApiKey === undefined) {
    delete process.env.ADMIN_API_KEY;
  } else {
    process.env.ADMIN_API_KEY = originalAdminApiKey;
  }
});

describe("isValidApiKey", () => {
  it("accepts the configured key", () => {
    process.env.ADMIN_API_KEY = "a-long-admin-key";

    expect(isValidApiKey("a-long-admin-key")).toBe(true);
  });

  it("rejects missing, non-string, and incorrect keys", () => {
    process.env.ADMIN_API_KEY = "a-long-admin-key";

    expect(isValidApiKey(undefined)).toBe(false);
    expect(isValidApiKey(12)).toBe(false);
    expect(isValidApiKey("wrong")).toBe(false);
  });

  it("rejects all keys when no key is configured", () => {
    delete process.env.ADMIN_API_KEY;

    expect(isValidApiKey("a-long-admin-key")).toBe(false);
  });
});

describe("GraphQL access guards", () => {
  it("allows a logged-in user or an admin", () => {
    expect(() => requireAccess({ user: {} as never })).not.toThrow();
    expect(() => requireAccess({ admin: true })).not.toThrow();
  });

  it("rejects unauthenticated access with the standard GraphQL error code", () => {
    try {
      requireAccess({});
      throw new Error("Expected requireAccess to reject the context");
    } catch (error) {
      expect(error).toMatchObject({
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
  });

  it("requires a user even when the context is admin-authenticated", () => {
    expect(() => requireUser({ admin: true })).toThrowError(
      "Invalid session. Please login again",
    );
  });
});
