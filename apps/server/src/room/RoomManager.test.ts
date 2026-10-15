import { describe, expect, it, vi } from "vitest";
import type { GameRoom } from "./GameRoom";
import { DEFAULT_ROOM_ID, RoomManager } from "./RoomManager";

describe("RoomManager", () => {
  const make = () => {
    const create = vi.fn((id: string) => ({ id }) as GameRoom);
    return { create, manager: new RoomManager(create) };
  };

  it("creates rooms lazily and reuses them", () => {
    const { create, manager } = make();
    expect(manager.get("a")).toBeUndefined();
    const room = manager.getOrCreate("a");
    expect(manager.getOrCreate("a")).toBe(room);
    expect(manager.get("a")).toBe(room);
    expect(create).toHaveBeenCalledOnce();
  });

  it("exposes a default room", () => {
    const { manager } = make();
    expect(manager.defaultRoom.id).toBe(DEFAULT_ROOM_ID);
    expect(manager.defaultRoom).toBe(manager.defaultRoom);
  });

  it("keeps rooms isolated", () => {
    const { manager } = make();
    expect(manager.getOrCreate("a")).not.toBe(manager.getOrCreate("b"));
  });
});
