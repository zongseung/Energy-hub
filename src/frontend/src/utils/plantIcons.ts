/**
 * 발전소 타입별 Canvas 아이콘 생성 + MapLibre 등록.
 * OpenInfraMap 스타일 — 타입별 고유 모양·색상.
 */
import type { Map as MaplibreMap } from "maplibre-gl";

export const PLANT_COLORS: Record<string, string> = {
  nuclear: "#e53935",
  coal: "#546e7a",
  gas: "#ab47bc",
  hydro: "#1565c0",
  wind: "#00bcd4",
  biomass: "#43a047",
  biogas: "#66bb6a",
  waste: "#8e24aa",
  oil: "#8d6e63",
  tidal: "#0277bd",
  diesel: "#795548",
};
export const DEFAULT_PLANT_COLOR = "#f6465d";

export const PLANT_LABELS: Record<string, string> = {
  nuclear: "원자력",
  coal: "석탄",
  gas: "가스",
  hydro: "수력",
  wind: "풍력",
  biomass: "바이오매스",
  biogas: "바이오가스",
  waste: "폐기물",
  oil: "유류",
  tidal: "조력",
  diesel: "디젤",
};

/* ── Shape drawers ─────────────────────────────────── */

type Drawer = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) => void;

/** 원자력 — 방사능 trefoil */
const drawNuclear: Drawer = (ctx, cx, cy, r, color) => {
  ctx.fillStyle = color;
  // 3 blades
  for (let i = 0; i < 3; i++) {
    const angle = (i * 2 * Math.PI) / 3 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * r * 0.35, cy + Math.sin(angle) * r * 0.35, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  // center hole
  ctx.fillStyle = "#0b0b0e";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
};

/** 석탄 — 육각형 */
const drawCoal: Drawer = (ctx, cx, cy, r, color) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 6;
    const x = cx + Math.cos(angle) * r * 0.8;
    const y = cy + Math.sin(angle) * r * 0.8;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
};

/** 가스 — 불꽃 */
const drawGas: Drawer = (ctx, cx, cy, r, color) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.85);
  ctx.bezierCurveTo(cx + r * 0.5, cy - r * 0.3, cx + r * 0.6, cy + r * 0.2, cx + r * 0.3, cy + r * 0.75);
  ctx.quadraticCurveTo(cx + r * 0.1, cy + r * 0.4, cx, cy + r * 0.55);
  ctx.quadraticCurveTo(cx - r * 0.1, cy + r * 0.4, cx - r * 0.3, cy + r * 0.75);
  ctx.bezierCurveTo(cx - r * 0.6, cy + r * 0.2, cx - r * 0.5, cy - r * 0.3, cx, cy - r * 0.85);
  ctx.closePath();
  ctx.fill();
};

/** 수력 — 물방울 */
const drawHydro: Drawer = (ctx, cx, cy, r, color) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.85);
  ctx.bezierCurveTo(cx + r * 0.6, cy, cx + r * 0.55, cy + r * 0.65, cx, cy + r * 0.8);
  ctx.bezierCurveTo(cx - r * 0.55, cy + r * 0.65, cx - r * 0.6, cy, cx, cy - r * 0.85);
  ctx.closePath();
  ctx.fill();
};

/** 풍력 — 3날개 터빈 */
const drawWind: Drawer = (ctx, cx, cy, r, color) => {
  ctx.fillStyle = color;
  for (let i = 0; i < 3; i++) {
    const angle = (i * 2 * Math.PI) / 3 - Math.PI / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.4, r * 0.15, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // hub
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.15, 0, Math.PI * 2);
  ctx.fill();
};

/** 바이오매스 — 잎사귀 */
const drawBiomass: Drawer = (ctx, cx, cy, r, color) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.1, cy + r * 0.8);
  ctx.quadraticCurveTo(cx - r * 0.7, cy - r * 0.2, cx, cy - r * 0.8);
  ctx.quadraticCurveTo(cx + r * 0.7, cy - r * 0.2, cx + r * 0.1, cy + r * 0.8);
  ctx.closePath();
  ctx.fill();
  // stem
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.08;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.3);
  ctx.quadraticCurveTo(cx - r * 0.15, cy + r * 0.3, cx, cy + r * 0.8);
  ctx.stroke();
};

/** 바이오가스 — 작은 잎사귀 */
const drawBiogas: Drawer = (ctx, cx, cy, r, color) => {
  drawBiomass(ctx, cx, cy, r * 0.85, color);
};

/** 폐기물 — 삼각형 */
const drawWaste: Drawer = (ctx, cx, cy, r, color) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.75);
  ctx.lineTo(cx + r * 0.7, cy + r * 0.6);
  ctx.lineTo(cx - r * 0.7, cy + r * 0.6);
  ctx.closePath();
  ctx.fill();
};

/** 유류 — 원통 (배럴) */
const drawOil: Drawer = (ctx, cx, cy, r, color) => {
  const w = r * 0.6, h = r * 0.7;
  ctx.fillStyle = color;
  // body
  ctx.fillRect(cx - w, cy - h * 0.6, w * 2, h * 1.3);
  // top ellipse
  ctx.beginPath();
  ctx.ellipse(cx, cy - h * 0.6, w, h * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  // bottom ellipse (slightly darker)
  ctx.fillStyle = color + "cc";
  ctx.beginPath();
  ctx.ellipse(cx, cy + h * 0.7, w, h * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
};

/** 조력 — 물결 */
const drawTidal: Drawer = (ctx, cx, cy, r, color) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.2;
  ctx.lineCap = "round";
  for (let row = -1; row <= 1; row++) {
    const y = cy + row * r * 0.4;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.7, y);
    ctx.bezierCurveTo(cx - r * 0.3, y - r * 0.25, cx + r * 0.3, y + r * 0.25, cx + r * 0.7, y);
    ctx.stroke();
  }
};

/** 기본 — 다이아몬드 */
const drawDefault: Drawer = (ctx, cx, cy, r, color) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.8);
  ctx.lineTo(cx + r * 0.6, cy);
  ctx.lineTo(cx, cy + r * 0.8);
  ctx.lineTo(cx - r * 0.6, cy);
  ctx.closePath();
  ctx.fill();
};

const SHAPE_MAP: Record<string, Drawer> = {
  nuclear: drawNuclear,
  coal: drawCoal,
  gas: drawGas,
  hydro: drawHydro,
  wind: drawWind,
  biomass: drawBiomass,
  biogas: drawBiogas,
  waste: drawWaste,
  oil: drawOil,
  tidal: drawTidal,
  diesel: drawDefault,
};

/* ── Icon generator ──────────────────────────────── */

function generatePlantIcon(source: string, size: number): HTMLCanvasElement {
  const dpr = typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1;
  const canvas = document.createElement("canvas");
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  // Dark circle background
  ctx.fillStyle = "rgba(11, 11, 14, 0.85)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Outer ring
  const color = PLANT_COLORS[source] || DEFAULT_PLANT_COLOR;
  ctx.strokeStyle = color + "99";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
  ctx.stroke();

  // Type-specific shape
  const draw = SHAPE_MAP[source] || drawDefault;
  draw(ctx, cx, cy, r * 0.65, color);

  return canvas;
}

/* ── Registration ────────────────────────────────── */

export function registerPlantIcons(map: MaplibreMap) {
  const dpr = typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1;
  const sources = [...Object.keys(PLANT_COLORS), "default"];

  for (const src of sources) {
    const name = `plant-icon-${src}`;
    if (map.hasImage(name)) continue;
    const canvas = generatePlantIcon(src, 48);
    map.addImage(name, canvas, { pixelRatio: dpr });
  }
}
