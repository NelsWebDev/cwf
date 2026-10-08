import { afterEach, describe, expect, it, vi } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { downloadCardImage, getCardImageUrl, loadCardImages } from "./cardImages";
import { renderRoundImage } from "./roundImage";

const png = () => createCanvas(40, 20).toBuffer("image/png");

afterEach(() => vi.restoreAllMocks());

describe("cardImages", () => {
  it("extracts the url from [img] cards", () => {
    expect(getCardImageUrl("[img] http://1.2.3.4/a.png [/img]")).toBe("http://1.2.3.4/a.png");
    expect(getCardImageUrl("plain text")).toBeUndefined();
  });

  it("downloads images, following redirects", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/b.png" } }))
      .mockResolvedValueOnce(new Response(png(), { status: 200, headers: { "content-type": "image/png" } }));
    const img = await downloadCardImage("http://8.8.8.8/a.png");
    expect(img.width).toBe(40);
    expect(String(fetchMock.mock.calls[1]![0])).toBe("http://8.8.8.8/b.png");
  });

  it("refuses private addresses and non-http protocols", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(downloadCardImage("http://127.0.0.1/a.png")).rejects.toThrow("Blocked");
    await expect(downloadCardImage("http://[::1]/a.png")).rejects.toThrow("Blocked");
    await expect(downloadCardImage("http://192.168.1.5/a.png")).rejects.toThrow("Blocked");
    await expect(downloadCardImage("file:///etc/passwd")).rejects.toThrow("protocol");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips failed downloads and renders with embedded images", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input).includes("good") ? new Response(png(), { headers: { "content-type": "image/png" } }) : new Response(null, { status: 404 }),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const a = "[img]http://8.8.8.8/good.png[/img]";
    const b = "[img]http://8.8.8.8/bad.png[/img]";
    const images = await loadCardImages([a, b, "text"]);
    expect([...images.keys()]).toEqual(["http://8.8.8.8/good.png"]);
    const plays = [{ username: "u", cards: [a], isWinner: false }];
    const withImg = renderRoundImage({ blackCardText: "x", pick: 1, plays, images });
    const without = renderRoundImage({ blackCardText: "x", pick: 1, plays });
    expect(withImg.equals(without)).toBe(false);
  });
});

describe("getCachedCardImage", () => {
  it("rejects non-images and svg, and caches results", async () => {
    const { getCachedCardImage } = await import("./cardImages");
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } }));
    await expect(getCachedCardImage("http://8.8.8.8/x.svg")).rejects.toThrow("supported");
    fetchMock.mockResolvedValueOnce(new Response("hi", { headers: { "content-type": "text/html" } }));
    await expect(getCachedCardImage("http://8.8.8.8/x.html")).rejects.toThrow("supported");
    fetchMock.mockImplementation(async () => new Response(png(), { headers: { "content-type": "image/png" } }));
    await getCachedCardImage("http://8.8.8.8/c.png");
    await getCachedCardImage("http://8.8.8.8/c.png");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
