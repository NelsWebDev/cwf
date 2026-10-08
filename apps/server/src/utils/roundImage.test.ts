import { describe, expect, it } from "vitest";
import { loadImage } from "@napi-rs/canvas";
import { renderRoundImage } from "./roundImage";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

const plays = (n: number, cards: string[]) =>
  Array.from({ length: n }, (_, i) => ({
    username: `user${i + 1}`,
    cards,
    isWinner: i === 0,
  }));

describe("renderRoundImage", () => {
  it("renders a 1600x900 PNG for a single-pick round", async () => {
    const png = renderRoundImage({
      blackCardText: "What's the secret ingredient? _____",
      pick: 1,
      plays: plays(6, ["Tax fraud"]),
    });
    expect([...png.subarray(0, 4)]).toEqual(PNG_SIGNATURE);
    const image = await loadImage(png);
    expect(image.width).toBe(1600);
    expect(image.height).toBe(900);
  });

  it("renders a multi-pick round", () => {
    const png = renderRoundImage({
      blackCardText: "_____ teams up with _____.",
      pick: 2,
      plays: plays(4, ["A suspicious puddle", "Tax fraud"]),
    });
    expect([...png.subarray(0, 4)]).toEqual(PNG_SIGNATURE);
  });

  it("draws the winner highlight", async () => {
    const render = (isWinner: boolean) =>
      renderRoundImage({
        blackCardText: "Test _____",
        pick: 1,
        plays: [{ username: "a", cards: ["x"], isWinner }],
      });
    expect(render(true).equals(render(false))).toBe(false);
  });

  it("handles no plays, long text, and many players without throwing", () => {
    const long = "word ".repeat(200);
    expect(() =>
      renderRoundImage({ blackCardText: long, pick: 3, plays: plays(10, [long, long, long]) }),
    ).not.toThrow();
    expect(() => renderRoundImage({ blackCardText: "x", pick: 1, plays: [] })).not.toThrow();
  });

  it("is deterministic", () => {
    const input = { blackCardText: "Hi _____", pick: 1, plays: plays(3, ["Yo"]) };
    expect(renderRoundImage(input).equals(renderRoundImage(input))).toBe(true);
  });
});
