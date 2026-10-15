import { describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import { CLOSE_CODE_DISCONNECTED, ConnectionTracker } from "./ConnectionTracker";

const socket = () => ({ close: vi.fn() }) as unknown as WebSocket & { close: ReturnType<typeof vi.fn> };

describe("ConnectionTracker", () => {
  it("reports the first connection and the last disconnection", () => {
    const tracker = new ConnectionTracker();
    const a = socket();
    const b = socket();
    expect(tracker.add("u", a)).toBe(true);
    expect(tracker.add("u", b)).toBe(false);
    expect(tracker.remove("u", a)).toBe(false);
    expect(tracker.remove("u", b)).toBe(true);
  });

  it("treats removal of an unknown connection as the last one", () => {
    expect(new ConnectionTracker().remove("u", socket())).toBe(true);
  });

  it("closes every socket of a user", () => {
    const tracker = new ConnectionTracker();
    const a = socket();
    const b = socket();
    tracker.add("u", a);
    tracker.add("u", b);
    tracker.closeAll("u");
    expect(a.close).toHaveBeenCalledWith(CLOSE_CODE_DISCONNECTED, expect.any(String));
    expect(b.close).toHaveBeenCalled();
  });
});
