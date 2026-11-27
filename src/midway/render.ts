import { canvasFont, theme } from '../carnival';
import bannerUrl from './aidevcon-banner.png';
import { palette } from './palette';
import {
  BOX_LINES,
  boxSkaterAt,
  CART_KINDS,
  CONCERT_STAGE,
  crowdReach,
  GRIND_BOX,
  HALFPIPE,
  halfpipeHeight,
  POOL_AIR,
  POOL_LANES,
  POOL_RIDE,
  poolHeight,
  poolSkaterAt,
  playerTrickAt,
  PUNK_BEAT,
  QUARTER_PIPE,
  quarterPipeHeight,
  quarterSkaterAt,
  railHeight,
  railSkaterAt,
  rockerAt,
  SKATE_AIR,
  SKATE_POOL,
  SKATE_RIDE,
  skaterAt,
  STAIR_SET,
  stairSlopeHeight,
  toScreen,
  type BoxLine,
  type BoothSlot,
  type MidwayMap,
  type PlayerTrick,
  type Point,
  type Prop,
  type RailSkaterPose,
  type Rect,
  type RockMove,
  type SkaterPose,
  type SkateTrick,
  type Walker,
} from './world';

/**
 * Flat, isometric vector drawing for the midway, in world pixels. The caller
 * sets up the canvas transform for the camera and zoom.
 */

type Ctx = CanvasRenderingContext2D;
type Pt = readonly [number, number];

/** A tile position, `z` pixels above the ground, in world pixels. */
function at(x: number, y: number, z = 0): Pt {
  const s = toScreen(x, y);
  return [s.x, s.y - z];
}

/** Screen size of a one-tile radius circle lying on the ground. */
const ISO_RX = 16 * Math.SQRT2;
const ISO_RY = 8 * Math.SQRT2;

function poly(ctx: Ctx, points: readonly Pt[], color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function stroke(ctx: Ctx, points: readonly Pt[], color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.stroke();
}

const lerp = (a: number, b: number, s: number) => a + (b - a) * s;

/** A tile-aligned box, `z` pixels off the ground and `h` pixels tall. */
function box(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  d: number,
  z: number,
  h: number,
  top: string,
  left: string,
  right: string,
) {
  if (h > 0) {
    poly(
      ctx,
      [at(x, y + d, z), at(x + w, y + d, z), at(x + w, y + d, z + h), at(x, y + d, z + h)],
      left,
    );
    poly(
      ctx,
      [at(x + w, y + d, z), at(x + w, y, z), at(x + w, y, z + h), at(x + w, y + d, z + h)],
      right,
    );
  }
  poly(
    ctx,
    [at(x, y, z + h), at(x + w, y, z + h), at(x + w, y + d, z + h), at(x, y + d, z + h)],
    top,
  );
}

/** A vertical wall from one ground point to another, in alternating colour strips. */
function stripedWall(
  ctx: Ctx,
  a: Point,
  b: Point,
  z: number,
  h: number,
  strips: number,
  colors: readonly string[],
) {
  for (let i = 0; i < strips; i++) {
    const s0 = i / strips;
    const s1 = (i + 1) / strips;
    const x0 = lerp(a.x, b.x, s0);
    const y0 = lerp(a.y, b.y, s0);
    const x1 = lerp(a.x, b.x, s1);
    const y1 = lerp(a.y, b.y, s1);
    poly(
      ctx,
      [at(x0, y0, z), at(x1, y1, z), at(x1, y1, z + h), at(x0, y0, z + h)],
      colors[i % colors.length],
    );
  }
}

/** A scalloped trim hanging from an edge. */
function scallops(
  ctx: Ctx,
  a: Point,
  b: Point,
  z: number,
  count: number,
  depth: number,
  colors: readonly string[],
) {
  for (let i = 0; i < count; i++) {
    const p0 = at(lerp(a.x, b.x, i / count), lerp(a.y, b.y, i / count), z);
    const p1 = at(lerp(a.x, b.x, (i + 1) / count), lerp(a.y, b.y, (i + 1) / count), z);
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.quadraticCurveTo((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + depth * 2, p1[0], p1[1]);
    ctx.closePath();
    ctx.fill();
  }
}

/** Little triangular flags hanging along a line of screen points. */
function flags(ctx: Ctx, points: readonly Pt[], t: number, size = 5, phase = 0) {
  let n = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const flutter = Math.sin(t * 4 + i * 0.9 + phase) * 1.2;
    ctx.fillStyle = palette.bunting[n++ % palette.bunting.length];
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo((x0 + x1) / 2 + flutter, (y0 + y1) / 2 + size * 1.4);
    ctx.closePath();
    ctx.fill();
  }
}

function flag(ctx: Ctx, x: number, y: number, t: number, color: string, size = 1) {
  stroke(
    ctx,
    [
      [x, y],
      [x, y - 14 * size],
    ],
    palette.metalShade,
    1.2,
  );
  const wave = Math.sin(t * 5 + x * 0.1) * 1.5 * size;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 14 * size);
  ctx.quadraticCurveTo(x + 6 * size, y - 16 * size + wave, x + 12 * size, y - 14 * size);
  ctx.lineTo(x + 9 * size, y - 11 * size + wave * 0.5);
  ctx.lineTo(x + 12 * size, y - 8 * size);
  ctx.quadraticCurveTo(x + 6 * size, y - 10 * size + wave, x, y - 8 * size);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draws on a vertical plane facing down-left (parallel to the x axis), so
 * signs and wheels sit in the scene. Local x runs along the plane, local y down.
 */
function onPlane(ctx: Ctx, origin: Pt, paint: () => void) {
  ctx.save();
  ctx.transform(0.894, 0.447, 0, 1, origin[0], origin[1]);
  paint();
  ctx.restore();
}

/** A sign's board and its edge, in plane-local coordinates centred on (0, 0). */
function signPlank(
  ctx: Ctx,
  width: number,
  height: number,
  colors: { board: string; edge: string },
  glow = false,
) {
  ctx.fillStyle = colors.edge;
  ctx.beginPath();
  ctx.roundRect(-width / 2 - 2, -height / 2 - 2, width + 4, height + 4, 4);
  ctx.fill();
  ctx.fillStyle = colors.board;
  ctx.beginPath();
  ctx.roundRect(-width / 2, -height / 2, width, height, 3);
  ctx.fill();
  if (glow) {
    ctx.strokeStyle = palette.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/** A wooden sign with text, in plane-local coordinates centred on (0, 0). */
function signBoard(
  ctx: Ctx,
  text: string,
  width: number,
  height: number,
  colors: { board: string; edge: string; text: string },
  glow = false,
) {
  signPlank(ctx, width, height, colors, glow);
  ctx.font = canvasFont('small', 'bold');
  const fit = Math.min(
    (height * 0.62) / theme.font.small,
    (width - 8) / ctx.measureText(text).width,
  );
  ctx.save();
  ctx.scale(fit, fit);
  ctx.fillStyle = colors.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 1);
  ctx.restore();
}

/**
 * The letters N, O, F and X as chunky polygons on a 6 by 7 grid, after the
 * NOFX band logo. Each glyph is a list of rings, filled even-odd so the O has
 * its hole.
 */
const NOFX_GLYPHS: readonly (readonly Pt[])[][] = [
  [
    [
      [0, 7],
      [0, 0],
      [2, 0],
      [4, 3.6],
      [4, 0],
      [6, 0],
      [6, 7],
      [4, 7],
      [2, 3.4],
      [2, 7],
    ],
  ],
  [
    [
      [1, 0],
      [5, 0],
      [6, 1],
      [6, 6],
      [5, 7],
      [1, 7],
      [0, 6],
      [0, 1],
    ],
    [
      [2, 2],
      [4, 2],
      [4, 5],
      [2, 5],
    ],
  ],
  [
    [
      [0, 0],
      [6, 0],
      [6, 2],
      [2, 2],
      [2, 3],
      [5, 3],
      [5, 5],
      [2, 5],
      [2, 7],
      [0, 7],
    ],
  ],
  [
    [
      [0, 0],
      [2, 0],
      [3, 2.2],
      [4, 0],
      [6, 0],
      [4.2, 3.5],
      [6, 7],
      [4, 7],
      [3, 4.8],
      [2, 7],
      [0, 7],
      [1.8, 3.5],
    ],
  ],
];

/**
 * The stage's NOFX sign: blocky letters slanted forward, each knocked a
 * little up or down, with a hard drop shadow, in plane-local coordinates
 * centred on (0, 0).
 */
function nofxSign(
  ctx: Ctx,
  width: number,
  height: number,
  colors: { board: string; edge: string; text: string; shadow: string },
) {
  signPlank(ctx, width, height, colors);
  const gap = 1;
  const cols = NOFX_GLYPHS.length * (6 + gap) - gap;
  const unit = Math.min((height * 0.68) / 7, (width - 12) / cols);
  const jolt = [-0.4, 0.3, -0.3, 0.4];
  const letters = (dx: number, dy: number, color: string) => {
    ctx.save();
    ctx.translate(dx, dy);
    // Slant the tops forward, like the logo.
    ctx.transform(1, 0, -0.28, 1, 0, 0);
    ctx.scale(unit, unit);
    ctx.translate(-cols / 2, -3.5);
    ctx.fillStyle = color;
    NOFX_GLYPHS.forEach((rings, i) => {
      const x = i * (6 + gap);
      const y = jolt[i];
      ctx.beginPath();
      for (const ring of rings) {
        ring.forEach(([px, py], j) =>
          j === 0 ? ctx.moveTo(x + px, y + py) : ctx.lineTo(x + px, y + py),
        );
        ctx.closePath();
      }
      ctx.fill('evenodd');
    });
    ctx.restore();
  };
  letters(1.2, 1.2, colors.shadow);
  letters(0, 0, colors.text);
}

// ── Ground ────────────────────────────────────────────────────────────────

/** The world-pixel height of the horizon; the field runs off to it. */
export const HORIZON = -24;

function hash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function rectPoints(r: Rect, lift = 0): Pt[] {
  return [
    at(r.x, r.y, lift),
    at(r.x + r.w, r.y, lift),
    at(r.x + r.w, r.y + r.h, lift),
    at(r.x, r.y + r.h, lift),
  ];
}

/** The world-pixel box the pre-drawn ground layer covers. */
export function groundBounds(map: MidwayMap): Box {
  return {
    left: -map.height * 16 - 64,
    right: map.width * 16 + 64,
    top: -64,
    bottom: (map.width + map.height) * 8 + 4,
  };
}

/** The open field round the midway, filling the view from the horizon down. */
export function drawField(ctx: Ctx, view: Box) {
  ctx.fillStyle = palette.haze;
  ctx.fillRect(view.left, HORIZON, view.right - view.left, 6);
  ctx.fillStyle = palette.grass;
  ctx.fillRect(view.left, HORIZON + 6, view.right - view.left, Math.max(0, view.bottom - HORIZON));
}

/**
 * The most pixels the ground layer may use. Safari refuses canvases over
 * 16,777,216 pixels, and a long midway on a sharp screen would pass that.
 */
const MAX_GROUND_PIXELS = 16_000_000;

export interface GroundLayer {
  canvas: HTMLCanvasElement;
  /** Device pixels per world pixel the layer was drawn at. */
  scale: number;
}

/**
 * Draws the parts of the ground that never change (the grass, paths, trees
 * and the hedge's back two sides) once, onto an off-screen canvas covering
 * groundBounds(map). It uses `scale` device pixels per world pixel, or less
 * when that would make the canvas too big, so its size stays bounded however
 * long the midway grows.
 */
export function drawGroundLayer(map: MidwayMap, wanted: number): GroundLayer {
  const bounds = groundBounds(map);
  const area = (bounds.right - bounds.left) * (bounds.bottom - bounds.top);
  const scale = Math.min(wanted, Math.sqrt(MAX_GROUND_PIXELS / area));
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((bounds.right - bounds.left) * scale);
  canvas.height = Math.ceil((bounds.bottom - bounds.top) * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, -bounds.left * scale, -bounds.top * scale);

  // Lighter plots of grass inside the hedge, raised a little above the paths.
  poly(ctx, rectPoints({ x: 0, y: 0, w: map.width, h: map.height }), palette.grassLight);
  for (const path of map.paths) poly(ctx, rectPoints(path, 3), palette.grassEdge);
  for (const path of map.paths) poly(ctx, rectPoints(path), palette.path);
  // Concrete under the skating courses, scored into slabs a tile across.
  for (const pad of map.pads) poly(ctx, rectPoints(pad, 3), palette.grassEdge);
  for (const pad of map.pads) {
    poly(ctx, rectPoints(pad), palette.pad);
    ctx.strokeStyle = palette.padJoint;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let x = pad.x + 1; x < pad.x + pad.w; x++) {
      const [ax, ay] = at(x, pad.y);
      const [bx, by] = at(x, pad.y + pad.h);
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    for (let y = pad.y + 1; y < pad.y + pad.h; y++) {
      const [ax, ay] = at(pad.x, y);
      const [bx, by] = at(pad.x + pad.w, y);
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
  }

  // Tufts of grass.
  ctx.strokeStyle = palette.grassDark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      if (map.ground[y * map.width + x] !== 'grass' || hash(x, y) > 0.5) continue;
      const [px, py] = at(x + hash(x, y, 1), y + hash(x, y, 2));
      ctx.moveTo(px - 2, py - 2);
      ctx.lineTo(px, py);
      ctx.lineTo(px + 2, py - 3);
    }
  }
  ctx.stroke();

  // Trees out in the field behind the midway.
  for (let i = 0; i < map.width; i += 2) tree(ctx, i + 0.5 + hash(i, 1) * 0.6, -1.4 - hash(i, 2));
  for (let i = 2; i < map.height; i += 2) tree(ctx, -1.4 - hash(1, i), i + 0.5 + hash(2, i) * 0.6);

  hedge(ctx, { x: 0, y: 0, w: map.width, h: 1 });
  hedge(ctx, { x: 0, y: 0, w: 1, h: map.height });
  return { canvas, scale };
}

function tree(ctx: Ctx, x: number, y: number) {
  const [px, py] = at(x, y);
  oval(ctx, px + 4, py + 1, 12, 5, palette.shadow);
  poly(
    ctx,
    [
      [px - 1.5, py],
      [px + 1.5, py],
      [px + 1.5, py - 12],
      [px - 1.5, py - 12],
    ],
    palette.woodDark,
  );
  oval(ctx, px, py - 20, 11, 11, palette.hedgeDark);
  oval(ctx, px - 2, py - 22, 9, 9, palette.hedge);
  oval(ctx, px - 4, py - 25, 4, 4, palette.hedgeLight);
}

function hedge(ctx: Ctx, area: Rect) {
  box(
    ctx,
    area.x + 0.15,
    area.y + 0.15,
    area.w - 0.3,
    area.h - 0.3,
    0,
    9,
    palette.hedgeLight,
    palette.hedge,
    palette.hedgeDark,
  );
}

/** The hedge's front two sides, which can stand in front of anything. */
export function drawFrontHedge(ctx: Ctx, map: MidwayMap) {
  const h = map.height - 1;
  hedge(ctx, { x: map.width - 1, y: 1, w: 1, h: map.height - 1 });
  hedge(ctx, { x: 1, y: h, w: map.avenueX - 1, h: 1 });
  hedge(ctx, { x: map.avenueX + 2, y: h, w: map.width - map.avenueX - 3, h: 1 });
}

// ── Round things: tents and the big top ────────────────────────────────────

interface Stripes {
  a: string;
  aShade: string;
  b: string;
  bShade: string;
}

const RED: Stripes = {
  a: palette.red,
  aShade: palette.redShade,
  b: palette.cream,
  bShade: palette.creamShade,
};
const BLUE: Stripes = {
  a: palette.blue,
  aShade: palette.blueShade,
  b: palette.cream,
  bShade: palette.creamShade,
};

function rimPoint(c: Pt, r: number, angle: number, z: number): Pt {
  return [c[0] + Math.cos(angle) * r * ISO_RX, c[1] + Math.sin(angle) * r * ISO_RY - z];
}

/** The front half of a striped cylinder. */
function cylinder(ctx: Ctx, c: Pt, r: number, z: number, h: number, colors: Stripes, count = 16) {
  for (let k = 0; k < count; k++) {
    const a0 = Math.max(0, (k / count) * Math.PI * 2);
    const a1 = Math.min(Math.PI, ((k + 1) / count) * Math.PI * 2);
    if (a1 <= a0) continue;
    const points: Pt[] = [];
    for (let i = 0; i <= 4; i++) points.push(rimPoint(c, r, lerp(a0, a1, i / 4), z));
    for (let i = 4; i >= 0; i--) points.push(rimPoint(c, r, lerp(a0, a1, i / 4), z + h));
    const shade = (a0 + a1) / 2 < Math.PI * 0.35;
    poly(
      ctx,
      points,
      k % 2 === 0 ? (shade ? colors.aShade : colors.a) : shade ? colors.bShade : colors.b,
    );
  }
}

/** A striped, slightly domed cone roof. `turn` spins the stripes. */
function dome(
  ctx: Ctx,
  c: Pt,
  r: number,
  z: number,
  h: number,
  colors: Stripes,
  turn = 0,
  count = 16,
) {
  const apex: Pt = [c[0], c[1] - z - h];
  const wedges = Array.from({ length: count }, (_, k) => {
    const a0 = turn + (k / count) * Math.PI * 2;
    const a1 = turn + ((k + 1) / count) * Math.PI * 2;
    return { k, a0, a1, mid: (a0 + a1) / 2 };
  }).sort((p, q) => Math.sin(p.mid) - Math.sin(q.mid));
  for (const { k, a0, a1, mid } of wedges) {
    const control = (angle: number) => rimPoint(c, r * 0.92, angle, z + h * 0.6);
    const start = rimPoint(c, r, a0, z);
    const end = rimPoint(c, r, a1, z);
    const c0 = control(a0);
    const c1 = control(a1);
    ctx.beginPath();
    ctx.moveTo(apex[0], apex[1]);
    ctx.quadraticCurveTo(c0[0], c0[1], start[0], start[1]);
    for (let i = 1; i <= 3; i++) {
      const p = rimPoint(c, r, lerp(a0, a1, i / 3), z);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.lineTo(end[0], end[1]);
    ctx.quadraticCurveTo(c1[0], c1[1], apex[0], apex[1]);
    const shade = Math.cos(mid) > 0.45;
    ctx.fillStyle =
      k % 2 === 0 ? (shade ? colors.aShade : colors.a) : shade ? colors.bShade : colors.b;
    ctx.fill();
  }
}

/** Scallops round the front of a circle. */
function scallopRing(
  ctx: Ctx,
  c: Pt,
  r: number,
  z: number,
  count: number,
  depth: number,
  colors: readonly string[],
) {
  for (let k = 0; k < count; k++) {
    const a0 = (k / count) * Math.PI;
    const a1 = ((k + 1) / count) * Math.PI;
    const p0 = rimPoint(c, r, a0, z);
    const p1 = rimPoint(c, r, a1, z);
    const m = rimPoint(c, r * 1.02, (a0 + a1) / 2, z - depth * 2);
    ctx.fillStyle = colors[k % colors.length];
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.quadraticCurveTo(m[0], m[1], p1[0], p1[1]);
    ctx.closePath();
    ctx.fill();
  }
}

function ringFlags(ctx: Ctx, c: Pt, r: number, z: number, t: number, count = 14) {
  const points: Pt[] = [];
  for (let i = 0; i <= count; i++) {
    const angle = 0.08 + (i / count) * (Math.PI - 0.16);
    points.push(rimPoint(c, r, angle, z));
  }
  flags(ctx, points, t, 3.5);
}

function knob(ctx: Ctx, x: number, y: number) {
  oval(ctx, x, y, 3, 3, palette.gold);
  oval(ctx, x - 1, y - 1, 1.2, 1.2, palette.cream);
}

function roundTent(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  wall: number,
  roof: number,
  colors: Stripes,
  t: number,
  flagColor: string = palette.gold,
) {
  const c = at(cx, cy);
  oval(ctx, c[0] + 8, c[1] + 4, r * ISO_RX * 1.15, r * ISO_RY * 1.15, palette.shadow);
  cylinder(ctx, c, r, 0, wall, colors);
  // The door, with its curtains tied back.
  const door: Pt[] = [];
  for (let i = 0; i <= 6; i++)
    door.push(rimPoint(c, r, lerp(Math.PI / 2 - 0.24, Math.PI / 2 + 0.24, i / 6), 0));
  const top = rimPoint(c, r, Math.PI / 2, wall * 0.85);
  poly(
    ctx,
    [...door, [door[6][0], top[1] + 6], [top[0], top[1]], [door[0][0], top[1] + 6]],
    palette.opening,
  );
  stroke(ctx, [door[0], [door[0][0] + 2, top[1] + 8], [top[0], top[1]]], palette.gold, 2);
  stroke(ctx, [door[6], [door[6][0] - 2, top[1] + 8], [top[0], top[1]]], palette.gold, 2);

  scallopRing(ctx, c, r * 1.02, wall, 10, 3, [colors.a, colors.b]);
  dome(ctx, c, r * 1.12, wall, roof, colors);
  scallopRing(ctx, c, r * 1.12, wall, 12, 4, [colors.a, colors.b]);
  ringFlags(ctx, c, r * 1.05, wall + 2, t);
  const apex = c[1] - wall - roof;
  knob(ctx, c[0], apex);
  flag(ctx, c[0], apex - 2, t, flagColor);
}

function bigTop(ctx: Ctx, prop: Prop, t: number) {
  const cx = prop.x + prop.w / 2;
  const cy = prop.y + prop.h / 2;
  roundTent(ctx, cx, cy, 1.9, 38, 46, RED, t, palette.red);
  const c = at(cx, cy);
  // A second ring of bunting, and gold lights round the wall.
  ringFlags(ctx, c, 1.5, 38 + 22, t, 12);
  for (let i = 0; i < 9; i++) {
    const angle = 0.2 + (i / 8) * (Math.PI - 0.4);
    const p = rimPoint(c, 1.92, angle, 10);
    oval(ctx, p[0], p[1], 1.4, 1.4, Math.sin(t * 4 + i) > 0 ? palette.gold : palette.cream);
  }
}

// ── Square things ─────────────────────────────────────────────────────────

/** A tent with a ridged roof running along the x axis. */
function peakedTent(ctx: Ctx, prop: Prop, t: number) {
  const colors = prop.variant % 2 === 0 ? BLUE : RED;
  const x0 = prop.x + 0.2;
  const x1 = prop.x + prop.w - 0.2;
  const y0 = prop.y + 0.25;
  const y1 = prop.y + prop.h - 0.25;
  const ym = (y0 + y1) / 2;
  const wall = 24;
  const roof = 26;
  const eave = 0.18;

  poly(ctx, rectPoints({ x: x0 + 0.3, y: y0 + 0.3, w: x1 - x0, h: y1 - y0 }), palette.shadow);
  // The back of the roof, mostly hidden behind the front.
  poly(
    ctx,
    [
      at(x0 - 0.1, y0 - eave, wall - 3),
      at(x1 + 0.1, y0 - eave, wall - 3),
      at(x1 + 0.1, ym, wall + roof),
      at(x0 - 0.1, ym, wall + roof),
    ],
    colors.aShade,
  );

  // The gable end, striped up to the roof line.
  const strips = 10;
  const half = (y1 - y0) / 2;
  const height = (y: number) => wall + roof * (1 - Math.abs(y - ym) / half);
  for (let i = 0; i < strips; i++) {
    const ya = lerp(y1, y0, i / strips);
    const yb = lerp(y1, y0, (i + 1) / strips);
    const points: Pt[] = [at(x1, ya, 0), at(x1, yb, 0), at(x1, yb, height(yb))];
    if ((ya - ym) * (yb - ym) < 0) points.push(at(x1, ym, height(ym)));
    points.push(at(x1, ya, height(ya)));
    poly(ctx, points, i % 2 === 0 ? colors.aShade : colors.bShade);
  }
  stripedWall(ctx, { x: x0, y: y1 }, { x: x1, y: y1 }, 0, wall, 14, [colors.a, colors.b]);
  // The entrance, on the gable end.
  const door = [
    at(x1, ym + 0.35, 0),
    at(x1, ym - 0.35, 0),
    at(x1, ym - 0.2, wall * 0.8),
    at(x1, ym, wall * 0.95),
    at(x1, ym + 0.2, wall * 0.8),
  ];
  poly(ctx, door, palette.opening);
  stroke(ctx, [door[0], door[4], door[3]], palette.gold, 1.6);
  stroke(ctx, [door[1], door[2], door[3]], palette.gold, 1.6);

  // The front of the roof.
  const roofStrips = 12;
  for (let i = 0; i < roofStrips; i++) {
    const xa = lerp(x0 - 0.1, x1 + 0.1, i / roofStrips);
    const xb = lerp(x0 - 0.1, x1 + 0.1, (i + 1) / roofStrips);
    poly(
      ctx,
      [
        at(xa, y1 + eave, wall - 3),
        at(xb, y1 + eave, wall - 3),
        at(xb, ym, wall + roof),
        at(xa, ym, wall + roof),
      ],
      i % 2 === 0 ? colors.a : colors.b,
    );
  }
  poly(
    ctx,
    [
      at(x1 + 0.1, y1 + eave, wall - 3),
      at(x1 + 0.1, ym, wall + roof),
      at(x1 + 0.1, ym, wall + roof - 2),
      at(x1 + 0.1, y1 + eave, wall - 5),
    ],
    colors.aShade,
  );
  scallops(ctx, { x: x0 - 0.1, y: y1 + eave }, { x: x1 + 0.1, y: y1 + eave }, wall - 3, 12, 3, [
    colors.a,
    colors.b,
  ]);
  const eaveLine: Pt[] = [];
  for (let i = 0; i <= 16; i++) eaveLine.push(at(lerp(x0, x1, i / 16), y1 + eave, wall - 7));
  flags(ctx, eaveLine, t, 3.5, prop.x);
  const ridgeFront = at(x1 + 0.1, ym, wall + roof);
  const ridgeBack = at(x0 - 0.1, ym, wall + roof);
  flag(ctx, ridgeBack[0], ridgeBack[1], t, palette.gold);
  flag(ctx, ridgeFront[0], ridgeFront[1], t + 1, palette.red);
}

function wheel(ctx: Ctx, x: number, y: number, r: number) {
  oval(ctx, x, y, r, r, palette.woodDark);
  oval(ctx, x, y, r * 0.65, r * 0.65, palette.gold);
  oval(ctx, x, y, r * 0.25, r * 0.25, palette.woodDark);
}

function wagon(ctx: Ctx, prop: Prop) {
  const body =
    prop.variant % 2 === 0
      ? { top: palette.red, left: palette.red, right: palette.redShade }
      : { top: palette.blue, left: palette.blue, right: palette.blueShade };
  const x = prop.x + 0.1;
  const y = prop.y + 0.1;
  const w = prop.w - 0.2;
  const d = prop.h - 0.25;
  poly(ctx, rectPoints({ x: x + 0.3, y: y + 0.3, w, h: d }), palette.shadow);
  box(ctx, x, y, w, d, 7, 24, body.top, body.left, body.right);
  // Cage bars along the side.
  for (let i = 1; i < 14; i++) {
    const bx = lerp(x + 0.3, x + w - 0.3, i / 14);
    stroke(ctx, [at(bx, y + d, 11), at(bx, y + d, 27)], palette.cream, 1.4);
  }
  poly(
    ctx,
    [
      at(x + 0.25, y + d, 11),
      at(x + w - 0.25, y + d, 11),
      at(x + w - 0.25, y + d, 12.5),
      at(x + 0.25, y + d, 12.5),
    ],
    palette.gold,
  );
  box(
    ctx,
    x - 0.05,
    y - 0.05,
    w + 0.1,
    d + 0.1,
    31,
    3,
    palette.gold,
    palette.goldShade,
    palette.goldShade,
  );
  // A gold crest on the side, and the wheels.
  const crest = at(x + w / 2, y + d, 33);
  oval(ctx, crest[0], crest[1] - 2, 7, 4, palette.gold);
  for (const wx of [x + 0.45, x + w - 0.45]) {
    const p = at(wx, y + d + 0.02, 6);
    wheel(ctx, p[0], p[1], 6);
  }
}

function person(
  ctx: Ctx,
  x: number,
  y: number,
  look: Look,
  options: {
    swing?: number;
    back?: boolean;
    dir?: number;
    player?: boolean;
    t?: number;
    /** Pixels off the ground, leaving the shadow behind. */
    lift?: number;
    /** How far the head drops forward, from 0 to 1. */
    nod?: number;
    /** How high each hand, left then right, reaches: 0 hanging down, 1 straight up. */
    reach?: readonly [number, number];
  } = {},
) {
  const swing = options.swing ?? 0;
  const dir = options.dir ?? 1;
  const [reachLeft, reachRight] = options.reach ?? [0, 0];
  oval(ctx, x, y, 5, 2, palette.shadow);
  y -= options.lift ?? 0;
  if (options.player) {
    ctx.strokeStyle = palette.gold;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, y, 8, 3.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  stroke(
    ctx,
    [
      [x - 1.6, y - 8],
      [x - 1.6 + swing * 1.6, y - 1],
    ],
    look.pants,
    2.6,
  );
  stroke(
    ctx,
    [
      [x + 1.6, y - 8],
      [x + 1.6 - swing * 1.6, y - 1],
    ],
    look.pants,
    2.6,
  );
  ctx.fillStyle = look.shirt;
  ctx.beginPath();
  ctx.roundRect(x - 4, y - 16.5, 8, 9.5, 3);
  ctx.fill();
  stroke(
    ctx,
    [
      [x - 4, y - 15],
      [lerp(x - 5 - swing, x - 6, reachLeft), lerp(y - 9, y - 27, reachLeft)],
    ],
    look.skin,
    2,
  );
  stroke(
    ctx,
    [
      [x + 4, y - 15],
      [lerp(x + 5 + swing, x + 6, reachRight), lerp(y - 9, y - 27, reachRight)],
    ],
    look.skin,
    2,
  );
  const head = y + (options.nod ?? 0) * 2.5;
  oval(ctx, x, head - 20.5, 4, 4, look.skin);
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  if (options.back) ctx.arc(x, head - 20.8, 4.2, 0, Math.PI * 2);
  else ctx.arc(x, head - 21, 4.2, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  if (!options.back) {
    oval(ctx, x - 1.5 + dir, head - 20.3, 0.6, 0.7, palette.ink);
    oval(ctx, x + 1.5 + dir, head - 20.3, 0.6, 0.7, palette.ink);
  }
  if (look.cap) {
    ctx.fillStyle = look.cap;
    ctx.beginPath();
    ctx.arc(x, head - 22, 4.4, Math.PI, Math.PI * 2);
    ctx.fill();
    if (!options.back)
      poly(
        ctx,
        [
          [x, head - 22.5],
          [x + dir * 7, head - 22.5],
          [x + dir * 7, head - 21.3],
          [x, head - 21.3],
        ],
        look.cap,
      );
  }
  if (options.player) {
    const hop = Math.sin((options.t ?? 0) * 5) * 1.5;
    poly(
      ctx,
      [
        [x - 4, y - 34 + hop],
        [x + 4, y - 34 + hop],
        [x, y - 29 + hop],
      ],
      palette.gold,
    );
  }
}

function cart(ctx: Ctx, prop: Prop, t: number) {
  const kind = prop.variant % CART_KINDS.length;
  const x = prop.x + 0.18;
  const y = prop.y + 0.3;
  const w = 0.64;
  const d = 0.45;
  const look = visitorLook(prop.x + prop.y);
  // The vendor stands behind the cart.
  const vendor = at(prop.x + 0.5, prop.y + 0.12);
  person(ctx, vendor[0], vendor[1], { ...look, shirt: palette.cream, cap: palette.red });
  poly(ctx, rectPoints({ x: x + 0.15, y: y + 0.15, w, h: d }), palette.shadow);

  const body =
    kind === 0
      ? { top: palette.cream, left: palette.red, right: palette.redShade }
      : kind === 1
        ? { top: palette.cream, left: palette.pink, right: palette.pinkShade }
        : { top: palette.cream, left: palette.blue, right: palette.blueShade };
  box(ctx, x, y, w, d, 5, 14, body.top, body.left, body.right);
  stripedWall(ctx, { x, y: y + d }, { x: x + w, y: y + d }, 9, 3, 6, [palette.cream, body.left]);
  const wheelAt = at(x + w * 0.3, y + d + 0.02, 5);
  wheel(ctx, wheelAt[0], wheelAt[1], 5);
  const top = at(x + w / 2, y + d / 2, 19);

  if (kind === 0) {
    box(
      ctx,
      x + 0.06,
      y + 0.06,
      w - 0.12,
      d - 0.12,
      19,
      10,
      'rgba(255,255,255,0.35)',
      'rgba(255,255,255,0.45)',
      'rgba(255,255,255,0.3)',
    );
    for (let i = 0; i < 9; i++)
      oval(
        ctx,
        top[0] - 8 + (i % 5) * 4,
        top[1] - 3 - Math.floor(i / 5) * 3 - (i % 2),
        2,
        2,
        palette.cream,
      );
    box(ctx, x, y, w, d, 29, 2, palette.red, palette.red, palette.redShade);
  } else if (kind === 1) {
    for (let i = 0; i < 3; i++) {
      const sx = top[0] - 7 + i * 7;
      const bob = Math.sin(t * 2 + i) * 0.5;
      stroke(
        ctx,
        [
          [sx, top[1]],
          [sx, top[1] - 9],
        ],
        palette.cream,
        1,
      );
      oval(ctx, sx, top[1] - 13 + bob, 4.5, 4.5, palette.pink);
      oval(ctx, sx - 1.5, top[1] - 14.5 + bob, 1.8, 1.8, palette.cream);
    }
  } else if (kind === 2) {
    stroke(ctx, [top, [top[0], top[1] - 22]], palette.metalShade, 1.2);
    dome(ctx, [top[0], top[1] - 18], 0.75, 0, 9, BLUE, 0, 10);
    for (let i = 0; i < 3; i++)
      oval(
        ctx,
        top[0] - 6 + i * 6,
        top[1] - 2,
        2.5,
        2.5,
        [palette.pink, palette.cream, palette.woodLight][i],
      );
  } else {
    // A giant drink on the roof.
    const [cx, cy] = top;
    poly(
      ctx,
      [
        [cx - 5, cy],
        [cx + 5, cy],
        [cx + 7, cy - 16],
        [cx - 7, cy - 16],
      ],
      palette.red,
    );
    poly(
      ctx,
      [
        [cx - 5.5, cy - 6],
        [cx + 5.5, cy - 6],
        [cx + 6, cy - 10],
        [cx - 6, cy - 10],
      ],
      palette.cream,
    );
    oval(ctx, cx, cy - 16, 7, 2, palette.cream);
    stroke(
      ctx,
      [
        [cx + 1, cy - 16],
        [cx + 4, cy - 24],
      ],
      palette.cream,
      1.5,
    );
  }

  // A little sign above it all.
  const sign = at(prop.x + 0.5, prop.y + 0.5, kind === 2 ? 50 : 42);
  onPlane(ctx, sign, () =>
    signBoard(ctx, CART_KINDS[kind].toUpperCase(), 30, 9, {
      board: palette.board,
      edge: palette.woodDark,
      text: palette.ink,
    }),
  );
}

function ticketBooth(ctx: Ctx, prop: Prop) {
  const x = prop.x + 0.15;
  const y = prop.y + 0.15;
  poly(ctx, rectPoints({ x: x + 0.2, y: y + 0.2, w: 0.7, h: 0.7 }), palette.shadow);
  box(ctx, x, y, 0.7, 0.7, 0, 26, palette.cream, palette.red, palette.redShade);
  poly(
    ctx,
    [
      at(x + 0.15, y + 0.7, 10),
      at(x + 0.55, y + 0.7, 10),
      at(x + 0.55, y + 0.7, 20),
      at(x + 0.15, y + 0.7, 20),
    ],
    palette.opening,
  );
  for (let i = 0; i < 6; i++) {
    const xa = lerp(x - 0.05, x + 0.75, i / 6);
    const xb = lerp(x - 0.05, x + 0.75, (i + 1) / 6);
    poly(
      ctx,
      [at(xa, y + 0.7, 23), at(xb, y + 0.7, 23), at(xb, y + 0.95, 17), at(xa, y + 0.95, 17)],
      i % 2 ? palette.cream : palette.blue,
    );
  }
  box(ctx, x - 0.05, y - 0.05, 0.8, 0.8, 26, 3, palette.blue, palette.blueShade, palette.blueShade);
  onPlane(ctx, at(x + 0.35, y + 0.35, 38), () =>
    signBoard(ctx, 'TICKETS', 28, 9, { board: palette.gold, edge: palette.red, text: palette.red }),
  );
}

function bench(ctx: Ctx, prop: Prop) {
  const x = prop.x + 0.12;
  const y = prop.y + 0.4;
  for (const lx of [x + 0.08, x + 0.68])
    box(ctx, lx, y + 0.05, 0.05, 0.2, 0, 6, palette.woodDark, palette.woodDark, palette.woodDark);
  box(ctx, x, y, 0.76, 0.26, 6, 2, palette.woodLight, palette.wood, palette.woodDark);
  box(ctx, x, y - 0.02, 0.76, 0.06, 8, 7, palette.woodLight, palette.wood, palette.woodDark);
}

function planter(ctx: Ctx, prop: Prop) {
  const c = at(prop.x + 0.5, prop.y + 0.5);
  oval(ctx, c[0] + 3, c[1] + 1, 10, 4, palette.shadow);
  box(
    ctx,
    prop.x + 0.28,
    prop.y + 0.28,
    0.44,
    0.44,
    0,
    8,
    palette.creamShade,
    palette.cream,
    palette.creamShade,
  );
  oval(ctx, c[0] - 3, c[1] - 13, 5, 5, palette.hedge);
  oval(ctx, c[0] + 3, c[1] - 13, 5, 5, palette.hedgeDark);
  oval(ctx, c[0], c[1] - 17, 5, 5, palette.hedgeLight);
}

function balloons(ctx: Ctx, prop: Prop, t: number) {
  const c = at(prop.x + 0.5, prop.y + 0.5);
  oval(ctx, c[0] + 2, c[1] + 1, 5, 2, palette.shadow);
  box(
    ctx,
    prop.x + 0.42,
    prop.y + 0.42,
    0.16,
    0.16,
    0,
    4,
    palette.blue,
    palette.blueShade,
    palette.blueShade,
  );
  for (let i = 0; i < 3; i++) {
    const bob = Math.sin(t * 1.8 + i + prop.x) * 1.5;
    const bx = c[0] - 6 + i * 6;
    const by = c[1] - 40 - (i === 1 ? 7 : 0) + bob;
    const color = palette.balloons[(i + prop.x) % palette.balloons.length];
    ctx.strokeStyle = palette.metalShade;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(c[0], c[1] - 4);
    ctx.quadraticCurveTo(bx, by + 18, bx, by + 7);
    ctx.stroke();
    oval(ctx, bx, by, 5, 6.5, color);
    oval(ctx, bx - 1.8, by - 2.5, 1.4, 2, 'rgba(255,255,255,0.6)');
    poly(
      ctx,
      [
        [bx - 1, by + 7],
        [bx + 1, by + 7],
        [bx, by + 6],
      ],
      color,
    );
  }
}

/** Seconds a ball takes to fly from one clown to the next. */
const JUGGLE_THROW = 0.7;

/** Four clowns in a ring, each throwing a ball to the clown on their left. */
function jugglers(ctx: Ctx, prop: Prop, t: number) {
  const cx = prop.x + prop.w / 2;
  const cy = prop.y + prop.h / 2;
  const centre = at(cx, cy);
  oval(ctx, centre[0], centre[1], ISO_RX * 0.9, ISO_RY * 0.9, palette.shadow);
  const clowns = [0, 1, 2, 3].map((i) => {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const p = at(cx + Math.cos(angle) * 0.55, cy + Math.sin(angle) * 0.55);
    return { i, x: p[0], y: p[1] };
  });
  const hand = (i: number): Pt => {
    const c = clowns[i % clowns.length];
    return [lerp(c.x, centre[0], 0.25), lerp(c.y, centre[1], 0.25) - 14];
  };
  const balls = () => {
    const step = t / JUGGLE_THROW;
    const s = step - Math.floor(step);
    clowns.forEach((_, k) => {
      const from = hand(Math.floor(step) + k);
      const to = hand(Math.floor(step) + k + 1);
      const x = lerp(from[0], to[0], s);
      const y = lerp(from[1], to[1], s) - 26 * 4 * s * (1 - s);
      oval(ctx, x, y, 2, 2, palette.balloons[k % palette.balloons.length]);
      oval(ctx, x - 0.6, y - 0.6, 0.7, 0.7, palette.white);
    });
  };
  const clown = ({ i, x, y }: (typeof clowns)[number]) => {
    const back = y > centre[1] + 1;
    const dir = x > centre[0] ? -1 : 1;
    const look: Look = {
      skin: palette.cream,
      hair: [palette.red, palette.gold, palette.blue, palette.pink][i],
      shirt: palette.balloons[(i + 2) % palette.balloons.length],
      pants: [palette.blue, palette.red, palette.gold, palette.pinkShade][i],
    };
    person(ctx, x, y, look, { swing: Math.sin(t * 9 + i * 1.6) * 0.8, back, dir });
    if (!back) oval(ctx, x + dir * 0.5, y - 19.3, 1.3, 1.3, palette.red);
    poly(
      ctx,
      [
        [x - 3.6, y - 23.5],
        [x + 3.6, y - 23.5],
        [x, y - 31],
      ],
      look.shirt,
    );
    oval(ctx, x, y - 31, 1.4, 1.4, palette.white);
  };
  // Back clowns first, then the balls over the middle, then the front clowns.
  const sorted = [...clowns].sort((a, b) => a.y - b.y);
  sorted.slice(0, 3).forEach(clown);
  balls();
  sorted.slice(3).forEach(clown);
}

/** Three clowns in black and white face paint, nodding along to their own beat. */
function posse(ctx: Ctx, prop: Prop, t: number) {
  const look: Look = {
    skin: palette.white,
    hair: palette.ink,
    shirt: palette.ink,
    pants: palette.pants[0],
  };
  [0.2, 0.5, 0.8].forEach((s, i) => {
    const p = at(prop.x + 0.5 + s * (prop.w - 1), prop.y + 0.5 + (i === 1 ? 0.1 : -0.1));
    const x = p[0];
    const y = p[1] - Math.max(0, Math.sin(t * 5 + i * 2)) * 0.8;
    const dir = i - 1;
    person(ctx, x, y, look, { dir });
    // The face paint: black points through the eyes and a wide black grin.
    for (const side of [-1, 1]) {
      const ex = x + side * 1.5 + dir;
      poly(
        ctx,
        [
          [ex - 0.9, y - 20.3],
          [ex, y - 23.2],
          [ex + 0.9, y - 20.3],
          [ex, y - 18.6],
        ],
        palette.ink,
      );
    }
    stroke(
      ctx,
      [
        [x - 2 + dir, y - 18.4],
        [x + dir, y - 17.6],
        [x + 2 + dir, y - 18.4],
      ],
      palette.ink,
      0.9,
    );
  });
}

/** A punk's mohawk: a row of spikes along the top of a head whose crown is at (x, top). */
function mohawk(ctx: Ctx, x: number, top: number, color: string) {
  for (const dx of [-2.4, 0, 2.4]) {
    poly(
      ctx,
      [
        [x + dx - 1.4, top + 1.5],
        [x + dx + 1.4, top + 1.5],
        [x + dx * 1.3, top - 4],
      ],
      color,
    );
  }
}

/** A guitar slung across someone standing at (x, y), with their strumming hand. */
function guitar(ctx: Ctx, x: number, y: number, color: string, strum: number, skin: string) {
  stroke(
    ctx,
    [
      [x + 1, y - 10.5],
      [x - 7, y - 17],
    ],
    palette.woodDark,
    1.3,
  );
  oval(ctx, x - 7.3, y - 17.3, 1.2, 1.2, palette.woodDark);
  oval(ctx, x + 1.8, y - 10, 3.4, 2.6, color);
  oval(ctx, x + 1.5, y - 10.3, 0.9, 0.9, palette.ink);
  oval(ctx, x + 4, y - 11.5 + strum * 2.5, 1.2, 1.2, skin);
}

/** Where the fans stand in front of the stage, in tiles from the stage spot's back left corner. */
const FANS: readonly Pt[] = [
  [0.55, 2.35],
  [1.3, 2.3],
  [2.05, 2.4],
  [2.8, 2.3],
  [3.5, 2.4],
  [0.9, 2.95],
  [1.7, 2.9],
  [2.45, 3],
  [3.2, 2.9],
  [1.3, 3.55],
  [2.1, 3.5],
  [2.9, 3.6],
];
const FAN_MOVES: readonly RockMove[] = ['jump', 'headbang', 'fist'];

/**
 * A stage by the gate with a punk band on it, singer, two guitars and drums,
 * playing under flashing lights, and a crowd in front jumping, banging their
 * heads and punching the air on the beat. While the player crowd surfs
 * (`surf`), the fans under them reach both hands up to pass them along.
 */
function concertStage(ctx: Ctx, prop: Prop, t: number, surf?: PlayerTrick) {
  const { depth, height } = CONCERT_STAGE;
  const x0 = prop.x;
  const y0 = prop.y;
  const beats = t / PUNK_BEAT;
  const beat = Math.floor(beats);
  const bounce = Math.sin(Math.PI * (beats - beat));
  const deck = (x: number, y: number) => at(x0 + x, y0 + y, height);

  // A patch of grass the crowd has trampled flat.
  poly(
    ctx,
    rectPoints({ x: x0 + 0.15, y: y0 + depth, w: prop.w - 0.3, h: prop.h - depth - 0.1 }),
    palette.grassDark,
  );

  // The backdrop, with the lights along its top and a banner across it.
  const back = y0 + 0.15;
  const top = height + 40;
  poly(
    ctx,
    [
      at(x0 + 0.1, back, height),
      at(x0 + 3.9, back, height),
      at(x0 + 3.9, back, top),
      at(x0 + 0.1, back, top),
    ],
    palette.ink,
  );
  onPlane(ctx, at(x0 + 2, back, height + 28), () =>
    nofxSign(ctx, 64, 14, {
      board: palette.ink,
      edge: palette.red,
      text: palette.pink,
      shadow: palette.red,
    }),
  );
  box(
    ctx,
    x0 + 0.1,
    y0 + 0.1,
    3.8,
    depth - 0.2,
    0,
    height,
    palette.board,
    palette.wood,
    palette.woodDark,
  );
  for (let i = 0; i < 4; i++) {
    const lamp = at(x0 + 0.6 + i * 0.93, back, top);
    const color = palette.balloons[i % palette.balloons.length];
    const lit = (beat + i) % 2 === 0;
    if (lit) {
      const spot = deck(0.6 + ((i + 1) % 4) * 0.93, 1.3);
      // Relative to the caller's alpha, so the player-visibility fade still holds.
      const alpha = ctx.globalAlpha;
      ctx.globalAlpha = alpha * 0.22;
      poly(
        ctx,
        [
          [lamp[0] - 1.5, lamp[1]],
          [lamp[0] + 1.5, lamp[1]],
          [spot[0] + 9, spot[1]],
          [spot[0] - 9, spot[1]],
        ],
        color,
      );
      ctx.globalAlpha = alpha;
    }
    oval(ctx, lamp[0], lamp[1], 2.4, 2, lit ? color : palette.metalShade);
  }

  // The drummer, sitting behind the kit at the back of the stage.
  const [dx, dy] = deck(2, 0.6);
  // Sticks come down on the toms on the beat, left and right in turn.
  const hit = beat % 2 === 0 ? bounce : 0;
  const drummer: Look = {
    skin: palette.skins[1],
    hair: palette.hairs[1],
    shirt: palette.red,
    pants: palette.pants[1],
  };
  person(ctx, dx, dy, drummer, { reach: [0.05 + 0.4 * hit, 0.05 + 0.4 * (bounce - hit)] });
  mohawk(ctx, dx, dy - 24.5, palette.gold);
  oval(ctx, dx - 6, dy - 10, 3.2, 1.6, palette.metal);
  oval(ctx, dx + 6, dy - 10, 3.2, 1.6, palette.metal);
  stroke(
    ctx,
    [
      [dx + 6, dy - 16 - hit],
      [dx + 12, dy - 14 - hit],
    ],
    hit > 0.5 ? palette.gold : palette.goldShade,
    1.4,
  );
  oval(ctx, dx, dy - 5, 6.2, 6.2, palette.red);
  oval(ctx, dx, dy - 5, 5, 5, palette.cream);
  oval(ctx, dx, dy - 5, 1.6, 1.6, palette.red);

  // A speaker stack at each front corner, the guitarist and the bassist
  // banging their heads, and the singer jumping out front.
  const speaker = (x: number) => {
    box(
      ctx,
      x0 + x,
      y0 + depth - 0.6,
      0.45,
      0.4,
      height,
      18,
      palette.ink,
      palette.ink,
      palette.ink,
    );
    const cone = deck(x + 0.2, depth - 0.2);
    oval(ctx, cone[0], cone[1] - 5, 2.2 + bounce * 0.4, 2.2 + bounce * 0.4, palette.metalShade);
    oval(ctx, cone[0], cone[1] - 13, 2.2 + bounce * 0.4, 2.2 + bounce * 0.4, palette.metalShade);
  };
  speaker(0.15);
  const players = [
    {
      at: deck(0.9, 1.3),
      look: {
        skin: palette.skins[0],
        hair: palette.hairs[0],
        shirt: palette.ink,
        pants: palette.pants[0],
      },
      hair: palette.pink,
      axe: palette.red,
      offset: 0,
    },
    {
      at: deck(3.1, 1.3),
      look: {
        skin: palette.skins[2],
        hair: palette.hairs[3],
        shirt: palette.ink,
        pants: palette.pants[2],
      },
      hair: palette.blue,
      axe: palette.blue,
      offset: PUNK_BEAT / 2,
    },
  ];
  for (const player of players) {
    const [px, py] = player.at;
    const { nod } = rockerAt(t, 'headbang', player.offset);
    person(ctx, px, py, player.look, { nod, swing: bounce - 0.5 });
    mohawk(ctx, px, py - 24.5 + nod * 2.5, player.hair);
    guitar(ctx, px, py, player.axe, bounce, player.look.skin);
  }
  const [sx, sy] = deck(2, 1.6);
  const jump = beat % 2 === 0 ? 5 * bounce : 0;
  const singer: Look = {
    skin: palette.skins[4],
    hair: palette.hairs[3],
    shirt: palette.red,
    pants: palette.ink,
  };
  person(ctx, sx, sy, singer, { lift: jump, reach: [0.75, 0.25 + 0.5 * bounce], swing: 0.6 });
  mohawk(ctx, sx, sy - jump - 24.5, palette.red);
  oval(
    ctx,
    lerp(sx - 5, sx - 6, 0.75),
    lerp(sy - jump - 9, sy - jump - 27, 0.75) + 1,
    1.3,
    1.6,
    palette.ink,
  );
  speaker(3.4);

  // The crowd, facing the stage, back row first.
  FANS.map(([u, v], i) => ({ i, p: at(x0 + u, y0 + v) }))
    .sort((a, b) => a.p[1] - b.p[1])
    .forEach(({ i, p }) => {
      const pose = rockerAt(t, FAN_MOVES[i % FAN_MOVES.length], (i * 0.07) % 0.15);
      const look = visitorLook(i * 2 + 1);
      if (i % 3 === 0) look.shirt = palette.ink;
      const rocking: [number, number] =
        FAN_MOVES[i % FAN_MOVES.length] === 'fist'
          ? i % 2
            ? [pose.hands, 0.1]
            : [0.1, pose.hands]
          : [pose.hands, pose.hands];
      const up = crowdReach(surf, { x: x0 + FANS[i][0], y: y0 + FANS[i][1] });
      const reach: [number, number] = [lerp(rocking[0], 1, up), lerp(rocking[1], 1, up)];
      const nod = pose.nod * (1 - up);
      person(ctx, p[0], p[1], look, { back: true, lift: pose.z, nod, reach });
      if (i % 4 === 1)
        mohawk(
          ctx,
          p[0],
          p[1] - pose.z - 24.5 + pose.nod * 2.5,
          palette.balloons[i % palette.balloons.length],
        );
    });
}

/** Screen pixels a tile along x covers, for tilting things that lean on a slope. */
const TILE_RUN = 16 * Math.SQRT2;

/** A skateboard in the skater's own frame: `axis` runs nose to tail, `flip` rolls it, `spin` turns it. */
function skateboard(ctx: Ctx, c: Pt, axis: Pt, flip: number, spin: number) {
  const half = Math.max(1.2, 7 * Math.abs(Math.cos(spin)));
  const across: Pt = [-axis[1], axis[0]];
  const thick = 1 + 2.2 * Math.abs(Math.sin(flip));
  const gripUp = Math.cos(flip) >= 0;
  const point = (along: number, side: number): Pt => [
    c[0] + axis[0] * along + across[0] * side,
    c[1] + axis[1] * along + across[1] * side,
  ];
  for (const end of [-1, 1]) {
    const w = point(end * half * 0.65, (gripUp ? 1 : -1) * (thick / 2 + 1));
    oval(ctx, w[0], w[1], 1.2, 1.2, palette.cream);
  }
  poly(
    ctx,
    [
      point(-half, -thick / 2),
      point(half, -thick / 2),
      point(half, thick / 2),
      point(-half, thick / 2),
    ],
    gripUp ? palette.ink : palette.red,
  );
}

interface SkaterLook {
  skin: string;
  shirt: string;
  pants: string;
  helmet: string;
}

const HALFPIPE_SKATER: SkaterLook = {
  skin: palette.skins[1],
  shirt: palette.shirts[1],
  pants: palette.pants[0],
  helmet: palette.red,
};

/**
 * The skater, drawn upright with their feet at (0, 0). `board` is the ramp's
 * direction in this frame, so the board lies along it. In a boardslide it
 * points across the rail, the rail runs under the board's middle, and `rail`
 * is the way the rail runs downhill in this frame.
 */
function skater(ctx: Ctx, pose: SkaterPose, board: Pt, look = HALFPIPE_SKATER, rail?: Pt) {
  const s = pose.progress;
  const trick = pose.trick;
  const flipping = trick === '360-flip' || trick === 'kickflip-180' || trick === 'kickflip';
  const popped = flipping || trick === 'shove-it' || trick === 'ollie';
  const air = popped ? s : 0;
  // A 360 flip spins the board a whole turn; a kickflip 180 turns it half way
  // round, with the skater, and a pop shove-it turns it half way under them.
  // A kickflip only rolls it.
  const roll = flipping ? Math.PI * 2 * air : 0;
  const spin =
    trick === 'kickflip-180' || trick === 'shove-it'
      ? Math.PI * air
      : trick === '360-flip'
        ? Math.PI * 2 * air
        : 0;
  const tuck = Math.sin(Math.PI * air);
  const christ = trick === 'christ-air' ? Math.min(1, 2.2 * Math.sin(Math.PI * s)) : 0;
  // An indy grab, a frontside air, a McTwist, a 540 and a method air crouch,
  // with the back hand down on the board. A method air kicks the board out
  // behind them.
  const grabbed =
    trick === 'indy-grab' ||
    trick === 'frontside-air' ||
    trick === 'mctwist' ||
    trick === '540' ||
    trick === 'method';
  const grab = grabbed ? Math.min(1, 2.2 * Math.sin(Math.PI * s)) : 0;
  const sliding = trick === 'boardslide' || trick === 'lipslide';
  const grinding = trick === '50-50';
  const dir = pose.dir;
  const method = trick === 'method' ? grab : 0;
  const kick: Pt = [-dir * 4 * method, -5 * method];
  ctx.save();
  if (trick === 'mctwist') {
    // A McTwist turns upside down and spins a turn and a half round. The
    // spin squeezes them across, and the last half turn is the one they
    // make at the top of every air, so they land facing back down the wall.
    const rodeIn = s < 0.5 ? dir : -dir;
    const turn = Math.cos(3 * Math.PI * s) * (s < 0.5 ? 1 : -1);
    ctx.translate(0, -10);
    ctx.rotate(-rodeIn * Math.PI * 2 * s);
    ctx.scale(turn, 1);
    ctx.translate(0, 10);
  } else if (trick === '540') {
    // A 540 spins a turn and a half round upright, squeezing them across, so
    // they land facing back down the wall.
    ctx.scale(Math.cos(3 * Math.PI * s) * (s < 0.5 ? 1 : -1), 1);
  }
  const hip = -9 + 3 * tuck + 4 * grab + (trick ? 0 : 1);
  const shoulder = hip - 8;
  const reach = lerp(0.7, Math.PI / 2, christ);
  const hand = (side: number): Pt => {
    const free: Pt = [side * (3.5 + 7 * Math.sin(reach)), shoulder + 1 + 7 * Math.cos(reach)];
    if (side === dir) return free;
    return [lerp(free[0], -dir * 2 + kick[0], grab), lerp(free[1], kick[1], grab)];
  };

  // Under the feet, or popped away from them, or held up in the front hand.
  // The front hand is the one they rode in with, so it stays the same hand
  // when they turn at the top of the air.
  const under: Pt = [0, 2 + 7 * tuck];
  const held = hand(s < 0.5 ? dir : -dir);
  let centre: Pt = [
    lerp(under[0], held[0], christ) + kick[0],
    lerp(under[1], held[1], christ) + kick[1],
  ];
  let axisX = lerp(board[0], 0, christ);
  let axisY = lerp(board[1], 1, christ);
  if (method) {
    // The tail comes up behind them.
    const a = 0.5 * dir * method;
    [axisX, axisY] = [
      axisX * Math.cos(a) - axisY * Math.sin(a),
      axisX * Math.sin(a) + axisY * Math.cos(a),
    ];
  }
  if (trick === 'manual') {
    // The nose they ride towards comes up, with the back wheels down.
    const a = -0.4 * dir;
    [axisX, axisY] = [
      axisX * Math.cos(a) - axisY * Math.sin(a),
      axisX * Math.sin(a) + axisY * Math.cos(a),
    ];
    centre = [centre[0] - board[0] * dir * 1.5, centre[1] - 1.5];
  }
  const length = Math.hypot(axisX, axisY);
  skateboard(ctx, centre, [axisX / length, axisY / length], roll, spin);
  if (grinding) {
    // Sparks off the trucks where they grind the coping, trailing behind.
    for (let i = 0; i < 3; i++) {
      const flicker = Math.sin(s * 53 + i * 1.7);
      if (flicker < 0) continue;
      const back = 4 + 3 * i * flicker;
      oval(ctx, centre[0] - board[0] * dir * back, centre[1] + 1.5 - i, 0.9, 0.9, palette.gold);
    }
  }
  if (sliding && rail) {
    // Sparks off the board's middle where it grinds the rail, trailing back up it.
    for (let i = 0; i < 3; i++) {
      const flicker = Math.sin(s * 47 + i * 2.1);
      if (flicker < 0) continue;
      const back = 2 + 3 * i * flicker;
      oval(ctx, centre[0] - rail[0] * back, centre[1] - rail[1] * back - i, 0.9, 0.9, palette.gold);
    }
  }

  const feet = 3.2 * (1 - 0.7 * christ);
  for (const side of [-1, 1]) {
    stroke(
      ctx,
      [
        [side * 1.4, hip],
        [side * (2.6 + 2 * tuck), (hip - tuck * 2) / 2],
        [side * feet + kick[0], kick[1]],
      ],
      look.pants,
      2.6,
    );
  }
  ctx.fillStyle = look.shirt;
  ctx.beginPath();
  ctx.roundRect(-3.5, shoulder - 1.5, 7, 9.5, 3);
  ctx.fill();
  for (const side of [-1, 1]) {
    stroke(ctx, [[side * 3.5, shoulder + 1], hand(side)], look.skin, 2);
  }
  const head = shoulder - 5.5;
  oval(ctx, 0, head, 4, 4, look.skin);
  ctx.fillStyle = look.helmet;
  ctx.beginPath();
  ctx.arc(0, head - 0.5, 4.4, Math.PI, Math.PI * 2);
  ctx.fill();
  oval(ctx, -1.5 + dir, head + 0.2, 0.6, 0.7, palette.ink);
  oval(ctx, 1.5 + dir, head + 0.2, 0.6, 0.7, palette.ink);
  ctx.restore();
}

/**
 * Draws a skater riding a ramp that runs along x, with their feet at `feet`.
 * They lean into the ramp, straightening up at the top of an air.
 */
function rideRamp(
  ctx: Ctx,
  feet: Pt,
  pose: SkaterPose,
  height: (u: number) => number,
  look = HALFPIPE_SKATER,
) {
  // `tilt` is the lean in the world; `lean` is how far that turns the skater
  // on screen.
  const air = pose.trick ? Math.abs(1 - 2 * pose.progress) : 1;
  const slope = ((height(pose.u + 0.01) - height(pose.u - 0.01)) / 0.02) * air;
  const tilt = 0.55 * Math.atan(slope / TILE_RUN);
  const lean = Math.atan2(
    -Math.sin(tilt) * Math.SQRT1_2,
    (Math.sin(tilt) * Math.SQRT1_2) / 2 + Math.cos(tilt),
  );
  const run = Math.hypot(16, 8 - slope);
  const tx = 16 / run;
  const ty = (8 - slope) / run;
  const board: Pt = [
    tx * Math.cos(lean) + ty * Math.sin(lean),
    -tx * Math.sin(lean) + ty * Math.cos(lean),
  ];
  ctx.save();
  ctx.translate(feet[0], feet[1]);
  ctx.rotate(lean);
  skater(ctx, pose, board, look);
  ctx.restore();
}

const GATE_HALFPIPE_SKATERS: readonly {
  tricks: readonly [SkateTrick, SkateTrick];
  start: number;
  look: SkaterLook;
}[] = [
  {
    tricks: ['method', 'shove-it'],
    start: SKATE_RIDE + SKATE_AIR,
    look: {
      skin: palette.skins[3],
      shirt: palette.shirts[3],
      pants: palette.pants[1],
      helmet: palette.blue,
    },
  },
  {
    tricks: ['kickflip', 'indy-grab'],
    start: 0,
    look: {
      skin: palette.skins[0],
      shirt: palette.shirts[2],
      pants: palette.pants[2],
      helmet: palette.gold,
    },
  },
];

/**
 * A wooden halfpipe running along x, with a skater riding it: a Christ air
 * above the right lip and a 360 flip above the left one. The one by the gate
 * (variant 1) has two skaters, side by side across it, taking turns at each
 * lip: kickflips and indy grabs, and method airs and pop shove-its.
 */
function halfpipe(ctx: Ctx, prop: Prop, t: number) {
  const { length, deck, height } = HALFPIPE;
  const x0 = prop.x;
  const far = prop.y + 0.4;
  const near = prop.y + prop.h - 0.4;
  poly(ctx, rectPoints({ x: x0 + 0.15, y: far + 0.15, w: length, h: near - far }), palette.shadow);

  const steps = 40;
  const profile: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const u0 = (i / steps) * length;
    const u1 = ((i + 1) / steps) * length;
    const z0 = halfpipeHeight(u0);
    const z1 = halfpipeHeight(u1);
    const color = z1 < z0 ? palette.woodLight : z1 > z0 ? palette.wood : palette.board;
    poly(
      ctx,
      [at(x0 + u0, far, z0), at(x0 + u1, far, z1), at(x0 + u1, near, z1), at(x0 + u0, near, z0)],
      color,
    );
    profile.push(at(x0 + u0, near, z0));
  }
  profile.push(at(x0 + length, near, height));
  for (const lip of [deck, length - deck]) {
    stroke(ctx, [at(x0 + lip, far, height), at(x0 + lip, near, height)], palette.metal, 1.6);
  }

  // The far rider first, so the near one passes in front of them.
  const riders =
    prop.variant === 1
      ? GATE_HALFPIPE_SKATERS.map((rider, lane) => ({
          pose: skaterAt(t + rider.start, rider.tricks),
          v: far + (near - far) * (lane === 0 ? 0.3 : 0.7),
          look: rider.look,
        }))
      : [{ pose: skaterAt(t), v: prop.y + prop.h / 2, look: HALFPIPE_SKATER }];
  for (const { pose, v, look } of riders) {
    const ground = at(x0 + pose.u, v, halfpipeHeight(pose.u));
    oval(ctx, ground[0], ground[1], 5, 2, palette.shadow);
    rideRamp(ctx, at(x0 + pose.u, v, pose.z), pose, halfpipeHeight, look);
  }

  // The end of the right deck, then the side facing the midway, with its
  // struts. They hide the skater whenever they ride behind them.
  const end = x0 + length;
  poly(
    ctx,
    [at(end, far, 0), at(end, near, 0), at(end, near, height), at(end, far, height)],
    palette.woodDark,
  );
  poly(ctx, [at(x0, near, 0), ...profile, at(end, near, 0)], palette.wood);
  for (let i = 1; i < length; i++) {
    stroke(ctx, [at(x0 + i, near, 0), at(x0 + i, near, halfpipeHeight(i))], palette.woodDark, 1);
  }
  stroke(ctx, profile, palette.woodDark, 1);
}

const QUARTER_PIPE_SKATER: SkaterLook = {
  skin: palette.skins[3],
  shirt: palette.shirts[2],
  pants: palette.pants[1],
  helmet: palette.blue,
};

const SECOND_QUARTER_PIPE_SKATER: SkaterLook = {
  skin: palette.skins[2],
  shirt: palette.shirts[4],
  pants: palette.pants[0],
  helmet: palette.gold,
};

const RAIL_SKATER: SkaterLook = {
  skin: palette.skins[0],
  shirt: palette.shirts[3],
  pants: palette.pants[2],
  helmet: palette.gold,
};

/**
 * A wooden quarter pipe with its back to the hedge, ramping down along x
 * towards the midway, and a skater doing a kickflip 180 above its lip. On the
 * second one (variant 1), the skater does an indy grab instead.
 */
function quarterPipe(ctx: Ctx, prop: Prop, t: number) {
  const { length, deck, height } = QUARTER_PIPE;
  const x0 = prop.x;
  const far = prop.y + 0.3;
  const near = prop.y + prop.h - 0.3;
  poly(
    ctx,
    rectPoints({ x: x0 + 0.15, y: far + 0.15, w: length - 0.6, h: near - far }),
    palette.shadow,
  );

  const steps = 24;
  const profile: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const u0 = (i / steps) * length;
    const u1 = ((i + 1) / steps) * length;
    const z0 = quarterPipeHeight(u0);
    const z1 = quarterPipeHeight(u1);
    const color = z1 < z0 ? palette.woodLight : palette.board;
    poly(
      ctx,
      [at(x0 + u0, far, z0), at(x0 + u1, far, z1), at(x0 + u1, near, z1), at(x0 + u0, near, z0)],
      color,
    );
    profile.push(at(x0 + u0, near, z0));
  }
  profile.push(at(x0 + length, near, 0));
  stroke(ctx, [at(x0 + deck, far, height), at(x0 + deck, near, height)], palette.metal, 1.6);

  const second = prop.variant === 1;
  const pose = second ? quarterSkaterAt(t + 0.9, 'indy-grab') : quarterSkaterAt(t);
  const look = second ? SECOND_QUARTER_PIPE_SKATER : QUARTER_PIPE_SKATER;
  const mid = prop.y + prop.h / 2;
  const ground = at(x0 + pose.u, mid, quarterPipeHeight(pose.u));
  oval(ctx, ground[0], ground[1], 5, 2, palette.shadow);
  rideRamp(ctx, at(x0 + pose.u, mid, pose.z), pose, quarterPipeHeight, look);

  // The side facing the midway, with its struts. It hides the skater
  // whenever they ride behind it.
  poly(ctx, [at(x0, near, 0), ...profile], palette.wood);
  for (const u of [deck, deck + 0.4]) {
    stroke(ctx, [at(x0 + u, near, 0), at(x0 + u, near, quarterPipeHeight(u))], palette.woodDark, 1);
  }
  stroke(ctx, profile, palette.woodDark, 1);
}

/**
 * A concrete stair set: a deck, stairs down along x with a handrail down
 * their middle, and a bank beside them. A skater rides off the deck, 360
 * flips onto the rail, boardslides down it, and rides back up the bank.
 */
function stairRail(ctx: Ctx, prop: Prop, t: number) {
  const { width, deck, stairs, steps, stairWidth, railY, height } = STAIR_SET;
  const x0 = prop.x;
  const y0 = prop.y;
  const bottom = x0 + deck + stairs;
  poly(ctx, rectPoints({ x: x0 + 0.15, y: y0 + 0.15, w: deck + stairs, h: width }), palette.shadow);

  // The deck along the back, then each step down from it, back to front.
  poly(ctx, rectPoints({ x: x0, y: y0, w: deck, h: width }, height), palette.concrete);
  const tread = stairs / steps;
  for (let k = 0; k < steps; k++) {
    const u = x0 + deck + k * tread;
    const above = (height * (steps - k)) / steps;
    const z = (height * (steps - 1 - k)) / steps;
    poly(
      ctx,
      [at(u, y0, z), at(u, y0 + stairWidth, z), at(u, y0 + stairWidth, above), at(u, y0, above)],
      palette.concreteDark,
    );
    poly(ctx, rectPoints({ x: u, y: y0, w: tread, h: stairWidth }, z), palette.concrete);
    stroke(ctx, [at(u, y0, above), at(u, y0 + stairWidth, above)], palette.concreteShade, 0.8);
  }

  // The handrail, on a post at each end.
  const ry = y0 + railY;
  const ends = [deck - 0.05, deck + stairs + 0.05];
  for (const u of [deck + 0.15, deck + stairs - 0.15]) {
    stroke(
      ctx,
      [at(x0 + u, ry, stairSlopeHeight(u) - 2), at(x0 + u, ry, railHeight(u))],
      palette.metalShade,
      1.6,
    );
  }
  stroke(
    ctx,
    ends.map((u) => at(x0 + u, ry, railHeight(Math.min(Math.max(u, deck), deck + stairs)))),
    palette.metal,
    2,
  );

  // The bank beside the stairs, and the side facing the midway.
  const by = y0 + stairWidth;
  const side = y0 + width;
  poly(
    ctx,
    [
      at(x0 + deck, by, height),
      at(bottom, by, 0),
      at(bottom, side, 0),
      at(x0 + deck, side, height),
    ],
    palette.concreteLight,
  );
  poly(
    ctx,
    [at(x0, side, 0), at(x0, side, height), at(x0 + deck, side, height), at(bottom, side, 0)],
    palette.concreteShade,
  );
  stroke(ctx, [at(x0 + deck, y0, height), at(x0 + deck, side, height)], palette.concreteShade, 0.8);

  railRider(ctx, prop, railSkaterAt(t), RAIL_SKATER);
}

/** Tricks ridden down the handrail, where the board follows its slope. */
const RAIL_TRICKS = new Set<SkateTrick | undefined>(['50-50', 'boardslide', 'lipslide']);

/** A skater on the stair set, at `pose` in tiles from its back corner. */
function railRider(ctx: Ctx, prop: Prop, pose: RailSkaterPose, look: SkaterLook) {
  const onSlope = RAIL_TRICKS.has(pose.trick) || (!pose.trick && pose.v === STAIR_SET.bankY);
  const slope = onSlope ? (stairSlopeHeight(pose.u + 0.01) - stairSlopeHeight(pose.u)) / 0.01 : 0;
  poseRider(ctx, prop, pose, look, slope, Math.min(pose.z, stairSurface(pose.u, pose.v)));
}

/**
 * A skater at `pose` in tiles from a prop's back corner, upright, with the
 * board the way they ride. `slope` is how fast what they ride climbs along x,
 * in pixels a tile, and `groundZ` how high the ground under them is.
 */
function poseRider(
  ctx: Ctx,
  prop: Prop,
  pose: RailSkaterPose,
  look: SkaterLook,
  slope: number,
  groundZ: number,
) {
  const { x: hx, y: hy } = pose.heading;
  const u = prop.x + pose.u;
  const v = prop.y + pose.v;
  const ground = at(u, v, groundZ);
  oval(ctx, ground[0], ground[1], 5, 2, palette.shadow);
  // The board lies the way they ride, turned by up to a quarter for a slide.
  const turn = (Math.PI / 2) * pose.boardTurn;
  const along = hx * Math.cos(turn) - hy * Math.sin(turn);
  const across = hx * Math.sin(turn) + hy * Math.cos(turn);
  const dx = 16 * (along - across);
  const dy = 8 * (along + across) - slope * along;
  const run = Math.hypot(dx, dy);
  // The rail runs the way they ride, down the slope.
  const downX = 16 * (hx - hy);
  const downY = 8 * (hx + hy) - slope * hx;
  const downRun = Math.hypot(downX, downY);
  const feet = at(u, v, pose.z);
  ctx.save();
  ctx.translate(feet[0], feet[1]);
  skater(ctx, pose, [dx / run, dy / run], look, [downX / downRun, downY / downRun]);
  ctx.restore();
}

const BOX_SKATERS: Record<BoxLine, SkaterLook> = {
  grind: {
    skin: palette.skins[4],
    shirt: palette.shirts[0],
    pants: palette.pants[1],
    helmet: palette.pink,
  },
  manual: {
    skin: palette.skins[1],
    shirt: palette.shirts[5],
    pants: palette.pants[2],
    helmet: palette.red,
  },
  flat: {
    skin: palette.skins[3],
    shirt: palette.shirts[1],
    pants: palette.pants[0],
    helmet: palette.blue,
  },
};

const BOX_LINE_ORDER: readonly BoxLine[] = ['grind', 'manual', 'flat'];

/**
 * A low, painted grind box on the flat, with metal coping along both long
 * edges, and three skaters riding it: a 50-50 grind along the far coping, a
 * manual along the top, and kickflips and pop shove-its on the flat in front.
 */
function grindBox(ctx: Ctx, prop: Prop, t: number) {
  const { start, end, far, near, height } = GRIND_BOX;
  const x0 = prop.x;
  const y0 = prop.y;
  const riders = BOX_LINE_ORDER.map((line) => ({ line, pose: boxSkaterAt(t, line) })).sort(
    (a, b) => a.pose.u + BOX_LINES[a.line] - (b.pose.u + BOX_LINES[b.line]),
  );
  const onBox = (line: BoxLine, u: number) => line !== 'flat' && u >= start && u <= end;
  const ride = ({ line, pose }: (typeof riders)[number]) => {
    const v = y0 + BOX_LINES[line];
    const ground = at(x0 + pose.u, v, onBox(line, pose.u) ? height : 0);
    oval(ctx, ground[0], ground[1], 5, 2, palette.shadow);
    rideRamp(ctx, at(x0 + pose.u, v, pose.z), pose, () => 0, BOX_SKATERS[line]);
  };
  // Anyone on the ground past the box's back end is behind it.
  const behind = ({ line, pose }: (typeof riders)[number]) =>
    line !== 'flat' && pose.u < start && pose.z < height;

  riders.filter(behind).forEach(ride);
  poly(
    ctx,
    rectPoints({ x: x0 + start + 0.12, y: y0 + far + 0.12, w: end - start, h: near - far }),
    palette.shadow,
  );
  box(
    ctx,
    x0 + start,
    y0 + far,
    end - start,
    near - far,
    0,
    height,
    palette.blue,
    palette.blueShade,
    palette.blueDark,
  );
  for (const v of [far, near]) {
    stroke(ctx, [at(x0 + start, y0 + v, height), at(x0 + end, y0 + v, height)], palette.metal, 1.6);
  }
  riders.filter((rider) => !behind(rider)).forEach(ride);
}

const POOL_SKATERS: readonly { trick: SkateTrick; start: number; look: SkaterLook }[] = [
  {
    trick: 'mctwist',
    start: 0,
    look: {
      skin: palette.skins[4],
      shirt: palette.shirts[0],
      pants: palette.pants[0],
      helmet: palette.red,
    },
  },
  {
    trick: 'method',
    start: POOL_RIDE + POOL_AIR,
    look: {
      skin: palette.skins[2],
      shirt: palette.shirts[2],
      pants: palette.pants[2],
      helmet: palette.gold,
    },
  },
];

/**
 * A concrete skate pool sunk into a deck, with metal coping round its edge
 * and a band of blue tile under it, and two skaters in helmets riding it: one
 * doing McTwists above the walls at either end and one doing method airs.
 */
function skatePool(ctx: Ctx, prop: Prop, t: number) {
  const { length, width, rim } = SKATE_POOL;
  const x0 = prop.x + rim;
  const x1 = x0 + length;
  const far = prop.y + rim;
  const near = far + width;
  // The deck, sunk into the grass like the concrete under the other courses.
  poly(ctx, rectPoints(prop, 3), palette.grassEdge);
  poly(ctx, rectPoints(prop), palette.pad);

  // Everything inside the bowl, or above it, is hidden below the near edges
  // of the coping.
  const corner = at(x0, near);
  const end = at(x1, far);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(...corner);
  ctx.lineTo(...at(x1, near));
  ctx.lineTo(...end);
  ctx.lineTo(end[0], end[1] - 200);
  ctx.lineTo(corner[0], corner[1] - 200);
  ctx.closePath();
  ctx.clip();

  // The far side wall, then the floor and the walls at either end.
  const steps = 32;
  const wall: Pt[] = [];
  for (let i = 0; i <= steps; i++)
    wall.push(at(x0 + (i / steps) * length, far, poolHeight((i / steps) * length)));
  poly(ctx, [at(x0, far), at(x1, far), ...wall.reverse()], palette.concreteShade);
  for (let i = 0; i < steps; i++) {
    const u0 = (i / steps) * length;
    const u1 = ((i + 1) / steps) * length;
    const z0 = poolHeight(u0);
    const z1 = poolHeight(u1);
    const color =
      z1 < z0 ? palette.concreteLight : z1 > z0 ? palette.concreteShade : palette.concrete;
    poly(
      ctx,
      [at(x0 + u0, far, z0), at(x0 + u1, far, z1), at(x0 + u1, near, z1), at(x0 + u0, near, z0)],
      color,
    );
  }
  stroke(ctx, [at(x0, far, -3), at(x1, far, -3)], palette.blue, 3);
  stroke(ctx, [at(x0 + 0.05, far, -3), at(x0 + 0.05, near, -3)], palette.blue, 3);
  for (const edge of [
    [at(x0, near), at(x0, far), at(x1, far)],
    [at(x0, near), at(x1, near), at(x1, far)],
  ]) {
    stroke(ctx, edge, palette.metal, 1.6);
  }

  for (const [lane, rider] of POOL_SKATERS.entries()) {
    const pose = poolSkaterAt(t + rider.start, rider.trick);
    const v = far + POOL_LANES[lane];
    const ground = at(x0 + pose.u, v, poolHeight(pose.u));
    oval(ctx, ground[0], ground[1], 5, 2, palette.shadow);
    rideRamp(ctx, at(x0 + pose.u, v, pose.z), pose, poolHeight, rider.look);
  }
  ctx.restore();
}

/** How high the stair set's surface is under a point on it, in pixels. */
function stairSurface(u: number, v: number): number {
  const { deck, stairs, steps, stairWidth, height } = STAIR_SET;
  if (u <= deck || v >= stairWidth) return stairSlopeHeight(u);
  if (u >= deck + stairs) return 0;
  const k = Math.floor(((u - deck) / stairs) * steps);
  return (height * (steps - 1 - k)) / steps;
}

/** How high a billboard's sign stands, to the bottom of its board. */
const BILLBOARD_HEIGHT = 40;

/**
 * The billboard's sign, in plane-local pixels: the banner plus its gold frame.
 * The board keeps the banner image's shape, 4 by 1.
 */
const BILLBOARD_SIGN = { width: 144, height: 36, frame: 3 };

let banner: HTMLImageElement | undefined;

/** The AI DevCon banner, loaded the first time the billboard is drawn. */
function bannerImage(): HTMLImageElement {
  if (!banner) {
    banner = new Image();
    banner.src = bannerUrl;
  }
  return banner;
}

/** Where a billboard's posts stand, and the point its sign is centred on. */
function billboardFrame(prop: Prop) {
  const y = prop.y + 0.5;
  const left = prop.x + 0.35;
  const right = prop.x + prop.w - 0.35;
  return { y, left, right, centre: at((left + right) / 2, y, BILLBOARD_HEIGHT + 18) };
}

/**
 * The screen box a billboard covers, sign and posts, for clicks and fading.
 * The sign sits on a slanted plane (see onPlane), so its corners are mapped
 * with the same 0.894 and 0.447 factors.
 */
function billboardBounds(prop: Prop): Box {
  const { y, left, right, centre } = billboardFrame(prop);
  const halfWidth = BILLBOARD_SIGN.width / 2 + BILLBOARD_SIGN.frame;
  const halfHeight = BILLBOARD_SIGN.height / 2 + BILLBOARD_SIGN.frame;
  const feet = [at(left, y), at(right, y)];
  return {
    left: Math.min(centre[0] - 0.894 * halfWidth, ...feet.map((p) => p[0])),
    right: Math.max(centre[0] + 0.894 * halfWidth, ...feet.map((p) => p[0])),
    top: centre[1] - 0.447 * halfWidth - halfHeight,
    bottom: Math.max(centre[1] + 0.447 * halfWidth + halfHeight, ...feet.map((p) => p[1])),
  };
}

/** The AI DevCon billboard: the event banner, lit, on two posts. Clicking it opens the event page. */
function billboard(ctx: Ctx, prop: Prop, t: number) {
  const { y, left, right, centre } = billboardFrame(prop);
  poly(
    ctx,
    rectPoints({ x: prop.x + 0.3, y: prop.y + 0.4, w: prop.w - 0.4, h: 0.5 }),
    palette.shadow,
  );
  for (const px of [left, right]) {
    box(
      ctx,
      px - 0.07,
      y - 0.07,
      0.14,
      0.14,
      0,
      BILLBOARD_HEIGHT + 12,
      palette.woodLight,
      palette.wood,
      palette.woodDark,
    );
  }
  onPlane(ctx, centre, () => {
    const { width, height, frame } = BILLBOARD_SIGN;
    ctx.fillStyle = palette.gold;
    ctx.beginPath();
    ctx.roundRect(
      -width / 2 - frame,
      -height / 2 - frame,
      width + frame * 2,
      height + frame * 2,
      5,
    );
    ctx.fill();
    ctx.fillStyle = palette.ink;
    ctx.beginPath();
    ctx.roundRect(-width / 2, -height / 2, width, height, 3);
    ctx.fill();
    // Until the banner loads, the board stays plain.
    const image = bannerImage();
    if (image.complete && image.naturalWidth > 0) {
      ctx.save();
      ctx.clip();
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, -width / 2, -height / 2, width, height);
      ctx.restore();
    }
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = Math.sin(t * 4 - i * 0.7) > 0 ? palette.cream : palette.goldShade;
      ctx.beginPath();
      ctx.arc(-width / 2 + 4 + i * ((width - 8) / 11), -height / 2 - 1.5, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// ── Booths ────────────────────────────────────────────────────────────────

const BOOTH_SCHEMES = [
  {
    wall: palette.gold,
    wallShade: palette.goldShade,
    awning: [palette.blue, palette.cream],
    awningShade: [palette.blueShade, palette.creamShade],
  },
  {
    wall: palette.cream,
    wallShade: palette.creamShade,
    awning: [palette.red, palette.cream],
    awningShade: [palette.redShade, palette.creamShade],
  },
  {
    wall: palette.sky2,
    wallShade: palette.blue,
    awning: [palette.gold, palette.cream],
    awningShade: [palette.goldShade, palette.creamShade],
  },
  {
    wall: palette.pink,
    wallShade: palette.pinkShade,
    awning: [palette.red, palette.gold],
    awningShade: [palette.redShade, palette.goldShade],
  },
] as const;
const CLOSED_SCHEME = {
  wall: palette.closed,
  wallShade: palette.closedShade,
  awning: [palette.closed, palette.metal],
  awningShade: [palette.closedShade, palette.metalShade],
} as const;

const BOOTH_WALL = 34;
/** How far above a booth's footprint its sign hangs. */
export const BOOTH_SIGN_HEIGHT = BOOTH_WALL + 22;

function target(ctx: Ctx, r: number) {
  const rings = [palette.red, palette.cream, palette.red, palette.cream];
  rings.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r * (1 - i / rings.length), 0, Math.PI * 2);
    ctx.fill();
  });
}

function booth(ctx: Ctx, slot: BoothSlot, name: string, t: number, glow: boolean) {
  const open = slot.gameId !== undefined;
  const scheme = open ? BOOTH_SCHEMES[slot.index % BOOTH_SCHEMES.length] : CLOSED_SCHEME;
  const x0 = slot.x + 0.15;
  const y0 = slot.y + 0.15;
  const s = 1.7;
  const x1 = x0 + s;
  const y1 = y0 + s;
  const wall = BOOTH_WALL;

  poly(ctx, rectPoints({ x: x0 + 0.35, y: y0 + 0.35, w: s, h: s }), palette.shadow);
  box(ctx, x0, y0, s, s, 0, wall, scheme.wall, scheme.wall, scheme.wallShade);

  // A window and counter on both faces we can see.
  const windows = [
    { a: { x: x0 + 0.15, y: y1 }, b: { x: x1 - 0.15, y: y1 }, out: { x: 0, y: 1 } },
    { a: { x: x1, y: y1 - 0.15 }, b: { x: x1, y: y0 + 0.15 }, out: { x: 1, y: 0 } },
  ];
  windows.forEach(({ a, b, out }, side) => {
    poly(
      ctx,
      [at(a.x, a.y, 9), at(b.x, b.y, 9), at(b.x, b.y, wall - 7), at(a.x, a.y, wall - 7)],
      palette.opening,
    );
    if (open) {
      for (let i = 0; i < 4; i++) {
        const p = at(lerp(a.x, b.x, (i + 0.5) / 4), lerp(a.y, b.y, (i + 0.5) / 4), 13);
        const hop = Math.sin(t * 2 + i + slot.index + side) > 0.9 ? 1.5 : 0;
        const color = palette.balloons[(i + side + slot.index) % palette.balloons.length];
        oval(ctx, p[0], p[1] - hop, 2.6, 2.6, color);
        oval(ctx, p[0] - 1.6, p[1] - 2.4 - hop, 1, 1, color);
        oval(ctx, p[0] + 1.6, p[1] - 2.4 - hop, 1, 1, color);
      }
    } else {
      // Shutters down.
      for (let i = 0; i < 4; i++) {
        const z = 9 + i * 3;
        poly(
          ctx,
          [at(a.x, a.y, z), at(b.x, b.y, z), at(b.x, b.y, z + 2.2), at(a.x, a.y, z + 2.2)],
          palette.metalShade,
        );
      }
    }
    const lip = 0.14;
    const aOut = { x: a.x + out.x * lip, y: a.y + out.y * lip };
    const bOut = { x: b.x + out.x * lip, y: b.y + out.y * lip };
    poly(
      ctx,
      [at(a.x, a.y, 9), at(b.x, b.y, 9), at(bOut.x, bOut.y, 9), at(aOut.x, aOut.y, 9)],
      palette.woodLight,
    );
    poly(
      ctx,
      [at(aOut.x, aOut.y, 9), at(bOut.x, bOut.y, 9), at(bOut.x, bOut.y, 7), at(aOut.x, aOut.y, 7)],
      palette.woodDark,
    );
  });

  box(
    ctx,
    x0 - 0.06,
    y0 - 0.06,
    s + 0.12,
    s + 0.12,
    wall,
    3,
    scheme.wall,
    scheme.wallShade,
    scheme.wallShade,
  );

  // Striped awnings over each window.
  const reach = open ? 0.42 : 0.12;
  const strips = 8;
  for (let i = 0; i < strips; i++) {
    const ya = lerp(y1 + 0.06, y0 - 0.06, i / strips);
    const yb = lerp(y1 + 0.06, y0 - 0.06, (i + 1) / strips);
    poly(
      ctx,
      [
        at(x1 + 0.06, ya, wall),
        at(x1 + 0.06, yb, wall),
        at(x1 + 0.06 + reach, yb, wall - 8),
        at(x1 + 0.06 + reach, ya, wall - 8),
      ],
      scheme.awningShade[i % 2],
    );
  }
  scallops(
    ctx,
    { x: x1 + 0.06 + reach, y: y1 + 0.06 },
    { x: x1 + 0.06 + reach, y: y0 - 0.06 },
    wall - 8,
    strips,
    2.5,
    scheme.awningShade,
  );
  for (let i = 0; i < strips; i++) {
    const xa = lerp(x0 - 0.06, x1 + 0.06, i / strips);
    const xb = lerp(x0 - 0.06, x1 + 0.06, (i + 1) / strips);
    poly(
      ctx,
      [
        at(xa, y1 + 0.06, wall),
        at(xb, y1 + 0.06, wall),
        at(xb, y1 + 0.06 + reach, wall - 8),
        at(xa, y1 + 0.06 + reach, wall - 8),
      ],
      scheme.awning[i % 2],
    );
  }
  scallops(
    ctx,
    { x: x0 - 0.06, y: y1 + 0.06 + reach },
    { x: x1 + 0.06, y: y1 + 0.06 + reach },
    wall - 8,
    strips,
    2.5,
    scheme.awning,
  );

  // The sign on the roof, with the game's name on it.
  const signAt = at(x0 + s / 2, y0 + s / 2, BOOTH_SIGN_HEIGHT - 6);
  onPlane(ctx, signAt, () => {
    ctx.fillStyle = palette.woodDark;
    ctx.fillRect(-20, 2, 2, 12);
    ctx.fillRect(18, 2, 2, 12);
    if (open) {
      ctx.save();
      ctx.translate(0, -18);
      target(ctx, 9);
      ctx.restore();
    }
    signBoard(
      ctx,
      name,
      60,
      16,
      open
        ? { board: palette.cream, edge: palette.red, text: palette.red }
        : { board: palette.metal, edge: palette.closedShade, text: palette.closedShade },
      glow,
    );
    if (open) {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = Math.sin(t * 5 + i * 1.3) > -0.2 ? palette.gold : palette.goldShade;
        ctx.beginPath();
        ctx.arc(-28 + i * (56 / 7), -10, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

// ── Bounds, for clicks and for fading things in front of the player ───────

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The screen box a booth and its sign are drawn in. */
export function boothBounds(slot: BoothSlot): Box {
  const c = toScreen(slot.x + 1, slot.y + 1);
  return { left: c.x - 32, right: c.x + 32, top: c.y - BOOTH_SIGN_HEIGHT - 30, bottom: c.y + 18 };
}

const PROP_HEIGHTS: Record<Prop['kind'], number> = {
  'big-top': 100,
  'peaked-tent': 56,
  wagon: 38,
  cart: 50,
  'ticket-booth': 46,
  bench: 16,
  planter: 22,
  balloons: 52,
  jugglers: 60,
  posse: 34,
  halfpipe: HALFPIPE.height + HALFPIPE.air + 40,
  'quarter-pipe': QUARTER_PIPE.height + QUARTER_PIPE.air + 40,
  'stair-rail': STAIR_SET.height + STAIR_SET.rail + STAIR_SET.air + 40,
  'grind-box': GRIND_BOX.height + GRIND_BOX.air + 40,
  'skate-pool': SKATE_POOL.air + 40,
  stage: CONCERT_STAGE.height + 70,
  billboard: BILLBOARD_HEIGHT + 40,
};

/** Roughly the screen box a prop is drawn in. */
export function propBounds(prop: Prop): Box {
  if (prop.kind === 'billboard') return billboardBounds(prop);
  const c = toScreen(prop.x + prop.w / 2, prop.y + prop.h / 2);
  const half = ((prop.w + prop.h) * 16) / 2;
  const footprint = ((prop.w + prop.h) * 8) / 2;
  return {
    left: c.x - half,
    right: c.x + half,
    top: c.y - footprint - PROP_HEIGHTS[prop.kind],
    bottom: c.y + footprint,
  };
}

// ── People ────────────────────────────────────────────────────────────────

export interface Look {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  cap?: string;
}

export function visitorLook(n: number): Look {
  return {
    skin: palette.skins[n % palette.skins.length],
    hair: palette.hairs[(n * 3 + 1) % palette.hairs.length],
    shirt: palette.shirts[(n * 2 + 1) % palette.shirts.length],
    pants: palette.pants[n % palette.pants.length],
  };
}

export const PLAYER_LOOK: Look = {
  skin: palette.skins[0],
  hair: palette.hairs[2],
  shirt: palette.red,
  pants: palette.pants[0],
  cap: palette.gold,
};

export function drawWalker(ctx: Ctx, walker: Walker, look: Look, player = false, t = 0) {
  const p = toScreen(walker.x, walker.y);
  const swing = walker.walking ? Math.sin(walker.stride * Math.PI * 2.2) : 0;
  person(ctx, p.x, p.y, look, {
    swing,
    back: walker.facing === 'back',
    dir: walker.flipped ? -1 : 1,
    player,
    t,
  });
}

/** The player on their board, in a skater's helmet the colour of their cap. */
const PLAYER_SKATER: SkaterLook = {
  skin: PLAYER_LOOK.skin,
  shirt: PLAYER_LOOK.shirt,
  pants: PLAYER_LOOK.pants,
  helmet: PLAYER_LOOK.cap ?? palette.gold,
};

/**
 * The player on the second course's quarter pipe or grind box, at `pose` in
 * tiles from its back corner. Riding along x, they lean into the ramp like
 * the skaters there; turning and riding round, they stand upright.
 */
function courseRider(ctx: Ctx, prop: Prop, pose: RailSkaterPose, look: SkaterLook) {
  const quarter = prop.kind === 'quarter-pipe';
  const height = (u: number) => (quarter ? quarterPipeHeight(u) : 0);
  const inside = pose.u >= 0 && pose.u <= prop.w && pose.v >= 0 && pose.v <= prop.h;
  const { start, end, far, near } = GRIND_BOX;
  const onBox = pose.u >= start && pose.u <= end && pose.v >= far && pose.v <= near;
  const surface = !inside ? 0 : quarter ? quarterPipeHeight(pose.u) : onBox ? GRIND_BOX.height : 0;
  if (Math.abs(pose.heading.y) > 0.01) return poseRider(ctx, prop, pose, look, 0, surface);
  const u = prop.x + pose.u;
  const v = prop.y + pose.v;
  const ground = at(u, v, Math.min(pose.z, surface));
  oval(ctx, ground[0], ground[1], 5, 2, palette.shadow);
  rideRamp(ctx, at(u, v, pose.z), pose, height, look);
}

/** The player on the halfpipe by the gate, at `pose` in tiles from its back corner. */
function halfpipeRider(ctx: Ctx, prop: Prop, pose: RailSkaterPose, look: SkaterLook) {
  const onPipe = pose.u >= 0 && pose.u <= HALFPIPE.length;
  const ground = at(prop.x + pose.u, prop.y + pose.v, onPipe ? halfpipeHeight(pose.u) : 0);
  oval(ctx, ground[0], ground[1], 5, 2, palette.shadow);
  const feet = at(prop.x + pose.u, prop.y + pose.v, pose.z);
  // On the halfpipe they ride along x like its skaters, leaning into the ramp.
  if (onPipe) {
    rideRamp(ctx, feet, pose, halfpipeHeight, look);
    return;
  }
  // Off it, the board lies the way they ride.
  const { x: hx, y: hy } = pose.heading;
  const dx = 16 * (hx - hy);
  const dy = 8 * (hx + hy);
  const run = Math.hypot(dx, dy);
  ctx.save();
  ctx.translate(feet[0], feet[1]);
  skater(ctx, pose, [dx / run, dy / run], look);
  ctx.restore();
}

/**
 * The player lying flat at `pose`, in tiles from the stage spot's back
 * corner, head first the way they're passed along, arms and legs flailing on
 * the beat.
 */
function crowdSurfer(ctx: Ctx, prop: Prop, pose: RailSkaterPose, look: Look, t: number) {
  const c = at(prop.x + pose.u, prop.y + pose.v, pose.z);
  const { x: hx, y: hy } = pose.heading;
  const run = Math.hypot(hx - hy, (hx + hy) / 2);
  // Head to feet along the ground, and side to side across it, on screen.
  const along: Pt = [(hx - hy) / run, (hx + hy) / 2 / run];
  const across: Pt = [(-hy - hx) / run, (hx - hy) / 2 / run];
  const point = (a: number, b: number, lift = 0): Pt => [
    c[0] + along[0] * a + across[0] * b,
    c[1] + along[1] * a + across[1] * b - lift,
  ];
  const kick = Math.sin((Math.PI * 2 * t) / PUNK_BEAT);
  for (const side of [-1, 1]) {
    stroke(ctx, [point(-3, side * 2), point(-10, side * 3.5, 1 + side * kick)], look.pants, 2.6);
  }
  stroke(ctx, [point(-3, 0), point(4, 0)], look.shirt, 7);
  for (const side of [-1, 1]) {
    stroke(ctx, [point(3, side * 3), point(7, side * 7, 3 - side * kick * 2)], look.skin, 2);
  }
  const [hx0, hy0] = point(8, 0, 1);
  oval(ctx, hx0, hy0, 4, 3.4, look.skin);
  oval(ctx, hx0, hy0 - 1.6, 4.2, 2.4, look.cap ?? look.hair);
}

/** The player partway through a trick on a skate feature, or crowd surfing. */
export function drawPlayerTrick(ctx: Ctx, trick: PlayerTrick, t = 0) {
  const pose = playerTrickAt(trick);
  if (trick.prop.kind === 'stage') crowdSurfer(ctx, trick.prop, pose, PLAYER_LOOK, t);
  else if (trick.prop.kind === 'stair-rail') railRider(ctx, trick.prop, pose, PLAYER_SKATER);
  else if (trick.prop.kind === 'halfpipe') halfpipeRider(ctx, trick.prop, pose, PLAYER_SKATER);
  else courseRider(ctx, trick.prop, pose, PLAYER_SKATER);
}

// ── The gate ──────────────────────────────────────────────────────────────

const ARCH_HEIGHT = 58;
const ARCH_LEFT = -0.45;
const ARCH_RIGHT = 2.2;

export function archBounds(map: MidwayMap): Box {
  const y = map.height - 1;
  const left = toScreen(map.avenueX + ARCH_LEFT - 0.6, y + 0.3);
  const right = toScreen(map.avenueX + ARCH_RIGHT + 0.8, y - 0.3);
  return { left: left.x, right: right.x, top: right.y - ARCH_HEIGHT - 26, bottom: left.y };
}

export function drawArch(ctx: Ctx, map: MidwayMap, t: number) {
  const y = map.height - 0.75;
  const left = map.avenueX + ARCH_LEFT;
  const right = map.avenueX + ARCH_RIGHT;
  for (const px of [left, right])
    box(
      ctx,
      px,
      y - 0.15,
      0.26,
      0.26,
      0,
      ARCH_HEIGHT,
      palette.woodLight,
      palette.wood,
      palette.woodDark,
    );
  const centre = at((left + right + 0.26) / 2, y, ARCH_HEIGHT + 2);
  onPlane(ctx, centre, () => {
    ctx.fillStyle = palette.gold;
    ctx.beginPath();
    ctx.ellipse(0, -10, 18, 14, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.red;
    ctx.beginPath();
    ctx.ellipse(0, -10, 12, 9, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    signBoard(ctx, "ADRIAN'S CARNIVAL", 92, 20, {
      board: palette.wood,
      edge: palette.woodDark,
      text: palette.gold,
    });
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = Math.sin(t * 5 - i * 0.8) > 0 ? palette.cream : palette.goldShade;
      ctx.beginPath();
      ctx.arc(-44 + i * (88 / 13), 13.5, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  for (const px of [left, right]) {
    const top = at(px + 0.13, y - 0.02, ARCH_HEIGHT);
    flag(ctx, top[0], top[1], t + px, palette.red);
  }
}

// ── The sky ───────────────────────────────────────────────────────────────

export interface Cloud {
  x: number;
  y: number;
  size: number;
  speed: number;
}

export function drawCloud(ctx: Ctx, x: number, y: number, size: number) {
  ctx.fillStyle = palette.cloud;
  ctx.beginPath();
  ctx.roundRect(x - 30 * size, y - 8 * size, 60 * size, 12 * size, 6 * size);
  ctx.arc(x - 14 * size, y - 8 * size, 11 * size, 0, Math.PI * 2);
  ctx.arc(x + 4 * size, y - 13 * size, 15 * size, 0, Math.PI * 2);
  ctx.arc(x + 20 * size, y - 6 * size, 9 * size, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.cloudShade;
  ctx.beginPath();
  ctx.roundRect(x - 30 * size, y, 60 * size, 4 * size, 2 * size);
  ctx.fill();
}

export interface Floater {
  x: number;
  y: number;
  age: number;
  color: string;
}

/** Balloons someone let go of, drifting up into the sky. */
export function drawFloaters(ctx: Ctx, floaters: readonly Floater[]) {
  for (const f of floaters) {
    ctx.globalAlpha = Math.max(0, Math.min(1, 6 - f.age));
    const sway = Math.sin(f.age * 2) * 3;
    ctx.strokeStyle = palette.metalShade;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(f.x + sway, f.y + 7);
    ctx.quadraticCurveTo(f.x + sway - 3, f.y + 13, f.x + sway, f.y + 18);
    ctx.stroke();
    oval(ctx, f.x + sway, f.y, 5, 6.5, f.color);
    oval(ctx, f.x + sway - 1.8, f.y - 2.5, 1.4, 2, 'rgba(255,255,255,0.6)');
  }
  ctx.globalAlpha = 1;
}

// ── Everything else ───────────────────────────────────────────────────────

/** Draws a prop; `trick` is the player's, when they're doing it on this prop. */
export function drawProp(ctx: Ctx, prop: Prop, t: number, trick?: PlayerTrick) {
  switch (prop.kind) {
    case 'big-top':
      return bigTop(ctx, prop, t);
    case 'peaked-tent':
      return peakedTent(ctx, prop, t);
    case 'wagon':
      return wagon(ctx, prop);
    case 'cart':
      return cart(ctx, prop, t);
    case 'ticket-booth':
      return ticketBooth(ctx, prop);
    case 'bench':
      return bench(ctx, prop);
    case 'planter':
      return planter(ctx, prop);
    case 'balloons':
      return balloons(ctx, prop, t);
    case 'jugglers':
      return jugglers(ctx, prop, t);
    case 'posse':
      return posse(ctx, prop, t);
    case 'halfpipe':
      return halfpipe(ctx, prop, t);
    case 'quarter-pipe':
      return quarterPipe(ctx, prop, t);
    case 'stair-rail':
      return stairRail(ctx, prop, t);
    case 'grind-box':
      return grindBox(ctx, prop, t);
    case 'skate-pool':
      return skatePool(ctx, prop, t);
    case 'stage':
      return concertStage(ctx, prop, t, trick);
    case 'billboard':
      return billboard(ctx, prop, t);
  }
}

export function drawBooth(ctx: Ctx, slot: BoothSlot, name: string, t: number, glow: boolean) {
  booth(ctx, slot, name, t, glow);
}

/** A rounded callout with a line of text, pointing down at a screen point. */
export function label(ctx: Ctx, text: string, x: number, y: number) {
  const { colors, radius } = theme;
  ctx.font = canvasFont('small', 'bold');
  const width = ctx.measureText(text).width + 22;
  const height = theme.font.small + 14;
  ctx.fillStyle = colors.background;
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - height / 2, width, height, Math.min(radius, height / 2));
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 6, y + height / 2);
  ctx.lineTo(x + 6, y + height / 2);
  ctx.lineTo(x, y + height / 2 + 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = colors.accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
}
