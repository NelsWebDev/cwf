import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import { fileURLToPath } from "node:url";

// Resolves to apps/server/assets from both src/ and dist/.
GlobalFonts.registerFromPath(
  fileURLToPath(new URL("../assets/Outfit.ttf", import.meta.url)),
  "Outfit",
);

export type RoundImageInput = {
  blackCardText: string;
  pick: number;
  plays: { username: string; cards: string[]; isWinner: boolean }[];
};

const WIDTH = 1600;
const HEIGHT = 900;
const FONT = "Outfit";
const COLORS = [
  "#ff4d5a", "#22d68a", "#ffc400", "#2f9bff", "#ff7a1a",
  "#a259f7", "#ff4fb4", "#1fc8d6", "#9bd62a", "#8f9bff",
];

const roundRect = (ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

const wrap = (ctx: SKRSContext2D, text: string, maxWidth: number) => {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
};

// Shrinks the font until the wrapped text fits the box, then draws it top-left aligned.
const drawFittedText = (
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  startSize: number,
  color: string,
) => {
  let size = startSize;
  let lines: string[] = [];
  for (; size >= 12; size -= 2) {
    ctx.font = `700 ${size}px ${FONT}`;
    lines = wrap(ctx, text, w);
    if (lines.length * size * 1.2 <= h) break;
  }
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * 1.2));
};

const drawBackground = (ctx: SKRSContext2D) => {
  const base = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  base.addColorStop(0, "#3a0ccf");
  base.addColorStop(0.55, "#2b2bf0");
  base.addColorStop(1, "#1a8cff");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const blob = (cx: number, cy: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  };
  blob(0, HEIGHT, 520, "rgba(20,230,200,0.85)");
  blob(WIDTH, HEIGHT, 520, "rgba(255,50,200,0.8)");
  blob(WIDTH, 0, 460, "rgba(40,230,255,0.7)");
};

const drawBlackCard = (ctx: SKRSContext2D, text: string, pick: number) => {
  const x = 60;
  const y = 80;
  const w = 440;
  const h = 440;
  ctx.save();
  ctx.shadowColor = "rgba(255,230,0,0.6)";
  ctx.shadowBlur = 30;
  roundRect(ctx, x, y, w, h, 28);
  ctx.fillStyle = "#0d0d0d";
  ctx.fill();
  ctx.restore();
  roundRect(ctx, x, y, w, h, 28);
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#ffe600";
  ctx.stroke();

  const bottomReserve = pick > 1 ? 90 : 0;
  drawFittedText(ctx, text, x + 36, y + 36, w - 72, h - 72 - bottomReserve, 48, "#ffffff");

  if (pick > 1) {
    ctx.font = `800 34px ${FONT}`;
    const label = `PICK ${pick}`;
    const bw = ctx.measureText(label).width + 48;
    roundRect(ctx, x + 36, y + h - 36 - 56, bw, 56, 28);
    ctx.fillStyle = "#ffe600";
    ctx.fill();
    ctx.fillStyle = "#0d0d0d";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(label, x + 36 + bw / 2, y + h - 36 - 28 + 2);
  }
};

const drawTile = (
  ctx: SKRSContext2D,
  play: RoundImageInput["plays"][number],
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  const pad = Math.max(14, Math.min(w, h) * 0.06);
  ctx.save();
  if (play.isWinner) {
    ctx.shadowColor = "#ffe600";
    ctx.shadowBlur = 40;
  }
  roundRect(ctx, x, y, w, h, 26);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.55;
  ctx.fill();
  ctx.restore();
  if (play.isWinner) {
    roundRect(ctx, x, y, w, h, 26);
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#ffe600";
    ctx.stroke();
  }

  const pillH = Math.min(58, h * 0.17);
  const gap = 12;
  const cardsH = h - pad * 2 - pillH - gap;
  const n = Math.max(play.cards.length, 1);
  const arrowW = n > 1 ? 34 : 0;
  const cardW = (w - pad * 2 - arrowW * (n - 1)) / n;

  play.cards.forEach((text, i) => {
    const cx = x + pad + i * (cardW + arrowW);
    const cy = y + pad;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    roundRect(ctx, cx, cy, cardW, cardsH, 16);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();

    let textTop = cy + 16;
    if (n > 1) {
      ctx.beginPath();
      ctx.arc(cx + 30, cy + 30, 16, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = `800 20px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), cx + 30, cy + 31);
      textTop = cy + 56;
    }
    drawFittedText(ctx, text, cx + 16, textTop, cardW - 32, cy + cardsH - textTop - 14, 34, "#111111");

    if (i < n - 1) {
      const ax = cx + cardW + arrowW / 2;
      const ay = cy + cardsH / 2;
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(ax - 9, ay);
      ctx.lineTo(ax + 9, ay);
      ctx.moveTo(ax + 2, ay - 8);
      ctx.lineTo(ax + 10, ay);
      ctx.lineTo(ax + 2, ay + 8);
      ctx.stroke();
    }
  });

  const py = y + h - pad - pillH;
  roundRect(ctx, x + pad, py, w - pad * 2, pillH, pillH / 2);
  ctx.fillStyle = color;
  ctx.fill();
  const label = play.isWinner ? `${play.username}  ★ WINNER` : play.username;
  let size = 30;
  ctx.font = `800 ${size}px ${FONT}`;
  while (size > 14 && ctx.measureText(label).width > w - pad * 2 - 24) {
    size -= 2;
    ctx.font = `800 ${size}px ${FONT}`;
  }
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, py + pillH / 2 + 2);
};

export function renderRoundImage({ blackCardText, pick, plays }: RoundImageInput): Buffer {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  drawBackground(ctx);
  drawBlackCard(ctx, blackCardText, pick);

  const areaX = 560;
  const areaY = 80;
  const areaW = WIDTH - areaX - 60;
  const areaH = HEIGHT - areaY - 80;
  const gap = 28;
  const count = Math.max(plays.length, 1);
  const cols = pick === 1 ? (count <= 4 ? 2 : 3) : pick === 2 ? 2 : 1;
  const rows = Math.ceil(count / cols);
  const tileW = (areaW - gap * (cols - 1)) / cols;
  const tileH = Math.min(340, (areaH - gap * (rows - 1)) / rows);

  plays.forEach((play, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    drawTile(
      ctx,
      play,
      COLORS[i % COLORS.length]!,
      areaX + col * (tileW + gap),
      areaY + row * (tileH + gap),
      tileW,
      tileH,
    );
  });

  return canvas.toBuffer("image/png");
}
