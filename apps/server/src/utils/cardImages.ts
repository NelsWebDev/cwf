import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { loadImage, type Image } from "@napi-rs/canvas";

const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

export const getCardImageUrl = (text: string): string | undefined => {
  const match = /^\s*\[img\]([\s\S]*?)\[\/img\]\s*$/i.exec(text);
  return match?.[1]?.trim() || undefined;
};

const isPrivateAddress = (address: string): boolean => {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number) as [number, number];
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const lower = address.toLowerCase();
  if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
  return (
    lower === "::" || lower === "::1" ||
    lower.startsWith("fc") || lower.startsWith("fd") ||
    lower.startsWith("fe8") || lower.startsWith("fe9") ||
    lower.startsWith("fea") || lower.startsWith("feb")
  );
};

// Blocks loopback/private targets so card URLs can't be used to probe the server's network.
const assertPublicUrl = async (url: URL) => {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Unsupported protocol");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("Blocked address");
  }
};

const readLimited = async (response: Response): Promise<Buffer> => {
  const declared = Number(response.headers.get("content-length"));
  if (declared > MAX_BYTES) throw new Error("Image too large");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty response");
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error("Image too large");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
};

// Downloads server-side so the image doesn't depend on whether Discord or remote players can reach the URL.
export async function fetchCardImage(rawUrl: string): Promise<{ data: Buffer; contentType: string }> {
  let url = new URL(rawUrl);
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    const response = await fetch(url, {
      redirect: "manual",
      signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CardsWithFriends/1.0)",
        Accept: "image/*,*/*;q=0.5",
      },
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    // SVG is excluded so the proxy can never serve scriptable content from our origin.
    if (!contentType.startsWith("image/") || contentType.includes("svg")) {
      throw new Error("Not a supported image");
    }
    return { data: await readLimited(response), contentType };
  }
  throw new Error("Too many redirects");
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 50;
const cache = new Map<string, { at: number; image: { data: Buffer; contentType: string } }>();

// Short-lived in-memory cache so every player viewing a round doesn't re-download the image.
export async function getCachedCardImage(url: string) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.image;
  const image = await fetchCardImage(url);
  cache.delete(url);
  cache.set(url, { at: Date.now(), image });
  while (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  return image;
}

export async function downloadCardImage(url: string): Promise<Image> {
  return loadImage((await getCachedCardImage(url)).data);
}

export async function loadCardImages(texts: string[]): Promise<Map<string, Image>> {
  const urls = [...new Set(texts.map(getCardImageUrl).filter((u): u is string => !!u))];
  const images = new Map<string, Image>();
  await Promise.all(
    urls.map(async (url) => {
      try {
        images.set(url, await downloadCardImage(url));
      } catch (error) {
        console.warn(`Could not download card image ${url}:`, error instanceof Error ? error.message : error);
      }
    }),
  );
  return images;
}
