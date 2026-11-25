/**
 * The walkable midway: the map layout, isometric projection, movement and
 * pathfinding. Plain functions with no canvas or DOM, so Vitest can run them.
 *
 * Positions are in tiles. Tile (x, y) covers [x, x + 1) × [y, y + 1). On
 * screen, +x runs down-right and +y runs down-left.
 */

export const TILE_W = 32;
export const TILE_H = 16;

export const WALK_SPEED = 4.2;
export const VISITOR_SPEED = 1.6;
export const WALKER_RADIUS = 0.3;
/** How close, in tiles, the player must stand to a booth to play it. */
export const BOOTH_REACH = 1.1;

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Ground = 'grass' | 'path' | 'concrete';

export interface BoothSlot extends Rect {
  index: number;
  /** The game this booth runs, or undefined for a "coming soon" booth. */
  gameId?: string;
}

export type PropKind =
  | 'big-top'
  | 'peaked-tent'
  | 'wagon'
  | 'cart'
  | 'ticket-booth'
  | 'bench'
  | 'planter'
  | 'balloons'
  | 'jugglers'
  | 'posse'
  | 'halfpipe'
  | 'quarter-pipe'
  | 'stair-rail'
  | 'grind-box'
  | 'skate-pool'
  | 'stage'
  | 'billboard';

export interface Prop extends Rect {
  kind: PropKind;
  /** Picks a colour scheme, or which kind of cart. */
  variant: number;
}

export interface MidwayMap {
  width: number;
  height: number;
  ground: Ground[];
  blocked: boolean[];
  /** The paved areas, for drawing. */
  paths: Rect[];
  /** The concrete under the street skating features, for drawing. */
  pads: Rect[];
  booths: BoothSlot[];
  props: Prop[];
  /** The first x of the two-tile avenue; the gate sits at its south end. */
  avenueX: number;
  spawn: Point;
}

export const CART_KINDS = ['Popcorn', 'Cotton candy', 'Ice cream', 'Drinks'] as const;

const MAP_WIDTH = 24;
const AVENUE_X = 11;
const FIRST_ROW_Y = 9;
const ROW_SPACING = 3;
const MIN_ROWS = 2;

/** Small seeded random numbers, for anything that should look random but stay put. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Lays out the midway for a list of games. Booths line both sides of the
 * avenue, two per row starting by the gate, and the avenue grows as games are
 * added. Slots without a game stay open ground. Tents, rides and carts fill
 * the space around them.
 */
export function layoutMidway(gameIds: readonly string[]): MidwayMap {
  const rows = Math.max(MIN_ROWS, Math.ceil(gameIds.length / 2));
  const avenueEnd = FIRST_ROW_Y + rows * ROW_SPACING;
  const entrance = avenueEnd + 2;
  const width = MAP_WIDTH;
  const height = entrance + 6;
  const ground: Ground[] = new Array(width * height).fill('grass');
  const blocked: boolean[] = new Array(width * height).fill(false);

  const block = (area: Rect) => {
    for (let y = area.y; y < area.y + area.h; y++) {
      for (let x = area.x; x < area.x + area.w; x++) blocked[y * width + x] = true;
    }
  };

  // A hedge runs round the edge; the outermost ring of tiles is the hedge.
  block({ x: 0, y: 0, w: width, h: 1 });
  block({ x: 0, y: height - 1, w: width, h: 1 });
  block({ x: 0, y: 0, w: 1, h: height });
  block({ x: width - 1, y: 0, w: 1, h: height });

  const paths: Rect[] = [
    { x: AVENUE_X, y: 6, w: 2, h: height - 6 },
    { x: 1, y: 6, w: width - 2, h: 2 },
    { x: 1, y: avenueEnd, w: width - 2, h: 2 },
    { x: AVENUE_X - 3, y: height - 4, w: 8, h: 3 },
  ];
  for (const path of paths) {
    for (let y = path.y; y < path.y + path.h; y++) {
      for (let x = path.x; x < path.x + path.w; x++) ground[y * width + x] = 'path';
    }
  }

  // Concrete under the street skating course, and under the second course to
  // the right of it, where the back left corner used to hold a ride.
  const side = FIRST_ROW_Y;
  const pads: Rect[] = [
    { x: 1, y: side - 1, w: 7, h: 7 },
    { x: 1, y: 1, w: 8, h: 4 },
  ];
  for (const pad of pads) {
    for (let y = pad.y; y < pad.y + pad.h; y++) {
      for (let x = pad.x; x < pad.x + pad.w; x++) ground[y * width + x] = 'concrete';
    }
  }

  const props: Prop[] = [];
  const add = (kind: PropKind, x: number, y: number, w = 1, h = 1, variant = 0) => {
    props.push({ kind, x, y, w, h, variant });
    block({ x, y, w, h });
  };

  // Along the back, the ground at the head of the avenue stays open.
  // A skateboard halfpipe in the back right corner, running along x.
  add('halfpipe', 19, 1, HALFPIPE.length, 4);
  add('planter', 5, 5);
  add('planter', 9, 5);
  add('planter', 14, 5);
  add('balloons', 18, 5);

  const booths: BoothSlot[] = [];
  for (let index = 0; index < gameIds.length; index++) {
    const row = Math.floor(index / 2);
    const booth: BoothSlot = {
      index,
      x: index % 2 === 0 ? AVENUE_X - 3 : AVENUE_X + 3,
      y: avenueEnd - (row + 1) * ROW_SPACING,
      w: 2,
      h: 2,
      gameId: gameIds[index],
    };
    booths.push(booth);
    block(booth);
  }

  // Beside the booths: a street skating course on the left.
  // A billboard for AI DevCon, on the right, with a skate pool in front of it.
  add('billboard', 19, side - 1, 3, 1);
  add(
    'skate-pool',
    18,
    side,
    SKATE_POOL.length + 2 * SKATE_POOL.rim,
    SKATE_POOL.width + 2 * SKATE_POOL.rim,
  );
  // A quarter pipe against the left hedge, facing the midway, and a stair set
  // with a handrail down the middle beside it.
  add('quarter-pipe', 1, side, QUARTER_PIPE.length, 6);
  add('stair-rail', 4, side - 1, STAIR_SET.length, STAIR_SET.width);
  add('planter', 6, side + 5);
  // To the right of it, across the path: a second quarter pipe against the
  // left hedge, and a grind box with three skaters riding it.
  add('quarter-pipe', 1, 1, QUARTER_PIPE.length, 4, 1);
  add('grind-box', 3, 1, GRIND_BOX.length, GRIND_BOX.width);
  // Each extra row of booths gets a little more scenery beside it.
  for (let band = 2; band < rows; band++) {
    const y = side + band * ROW_SPACING;
    add('planter', 2, y);
    add('bench', 4, y + 1);
    add('balloons', 6, y + 2);
    add('cart', 18, y + 1, 1, 1, band % CART_KINDS.length);
    add('planter', 21, y);
    add('bench', 20, y + 2);
  }

  // By the gate: a punk band on a stage, with a crowd rocking out in front.
  add('stage', 2, entrance, 4, CONCERT_STAGE.depth + CONCERT_STAGE.crowd);
  add('cart', 7, entrance + 1, 1, 1, 3);
  add('ticket-booth', AVENUE_X - 2, height - 2);
  // A second halfpipe where the carousel used to stand, with two skaters on it.
  add('halfpipe', 17, entrance, HALFPIPE.length, 4, 1);
  add('balloons', 22, entrance + 4);
  add('planter', 15, entrance);
  // Three face-painted clowns hanging out at the crossroads in front of the gate.
  add('posse', AVENUE_X + 2, entrance, 2, 1);
  add('planter', 1, height - 2);

  return {
    width,
    height,
    ground,
    blocked,
    paths,
    pads,
    booths,
    props,
    avenueX: AVENUE_X,
    // Just inside the gate, off to the side so the arch doesn't hide the player.
    spawn: { x: AVENUE_X + 3.5, y: height - 3 },
  };
}

/**
 * The halfpipe's shape along its length, in tiles from its left end: a flat
 * deck at each end, a curved ramp down from each lip and a flat bottom.
 * Heights are in pixels, like everything drawn above the ground.
 */
export const HALFPIPE = { length: 4, deck: 0.45, ramp: 1.05, height: 24, air: 26 };

/** How high the halfpipe's surface is, in pixels, at `u` tiles along it. */
export function halfpipeHeight(u: number): number {
  const { length, deck, ramp, height } = HALFPIPE;
  const fromLip = Math.min(u - deck, length - deck - u);
  if (fromLip <= 0) return height;
  const s = Math.max(0, 1 - fromLip / ramp);
  return height * s * s;
}

/** Seconds the skater takes to ride from one lip to the other. */
export const SKATE_RIDE = 1.5;
/** Seconds the skater spends in the air above a lip. */
export const SKATE_AIR = 0.9;

/**
 * On the halfpipe, the 360 flip comes off the left lip and the Christ air off
 * the right one. On the halfpipe by the gate, one skater does a kickflip off
 * the right lip and an indy grab off the left, and the other a method air off
 * the right lip and a pop shove-it off the left. On the street course, the kickflip 180 is above the quarter
 * pipe, and the 360 flip leads into a boardslide down the handrail. On the
 * second course, the indy grab is above its quarter pipe, an ollie gets onto
 * the grind box for a 50-50 grind or a manual along it, and the kickflip and
 * pop shove-it are on the flat beside it. In the skate pool, one skater does a
 * McTwist above each wall and the other a method air.
 */
export type SkateTrick =
  | '360-flip'
  | 'christ-air'
  | 'kickflip-180'
  | 'boardslide'
  | 'indy-grab'
  | 'ollie'
  | '50-50'
  | 'manual'
  | 'kickflip'
  | 'shove-it'
  | 'mctwist'
  | 'method';

export interface SkaterPose {
  /** Tiles along the halfpipe from its left end. */
  u: number;
  /** Pixels above the ground. */
  z: number;
  /** 1 while heading towards the right end, -1 towards the left. */
  dir: 1 | -1;
  /** The trick they're doing, if any. */
  trick?: SkateTrick;
  /** How far through the trick, from 0 to 1. */
  progress: number;
}

/**
 * Where a halfpipe skater is `t` seconds into their run: down the pipe and up
 * to the right lip for `tricks[0]`, a Christ air unless told otherwise, then
 * back across to the left lip for `tricks[1]`, a 360 flip, over and over.
 */
export function skaterAt(
  t: number,
  tricks: readonly [SkateTrick, SkateTrick] = ['christ-air', '360-flip'],
): SkaterPose {
  const { length, deck, height, air } = HALFPIPE;
  const left = deck + 0.05;
  const right = length - deck - 0.05;
  const cycle = 2 * (SKATE_RIDE + SKATE_AIR);
  let time = ((t % cycle) + cycle) % cycle;
  const ride = (from: number, to: number, dir: 1 | -1): SkaterPose => {
    const s = time / SKATE_RIDE;
    const u = lerpNumber(from, to, (1 - Math.cos(Math.PI * s)) / 2);
    return { u, z: halfpipeHeight(u), dir, progress: s };
  };
  const pop = (u: number, dir: 1 | -1, trick: SkateTrick): SkaterPose => {
    const s = time / SKATE_AIR;
    const lip = halfpipeHeight(u);
    return { u, z: lip + (height + air - lip) * 4 * s * (1 - s), dir, trick, progress: s };
  };
  if (time < SKATE_RIDE) return ride(left, right, 1);
  time -= SKATE_RIDE;
  if (time < SKATE_AIR) return pop(right, time < SKATE_AIR / 2 ? 1 : -1, tricks[0]);
  time -= SKATE_AIR;
  if (time < SKATE_RIDE) return ride(right, left, -1);
  time -= SKATE_RIDE;
  return pop(left, time < SKATE_AIR / 2 ? -1 : 1, tricks[1]);
}

/**
 * The quarter pipe's shape along x, in tiles from its back against the hedge:
 * a flat deck, a curved ramp down from the lip and a flat run out.
 */
export const QUARTER_PIPE = { length: 2, deck: 0.3, ramp: 1.05, height: 26, air: 24 };

/** How high the quarter pipe's surface is, in pixels, at `u` tiles from its back. */
export function quarterPipeHeight(u: number): number {
  const { deck, ramp, height } = QUARTER_PIPE;
  if (u <= deck) return height;
  const s = Math.max(0, 1 - (u - deck) / ramp);
  return height * s * s;
}

/** Seconds the quarter pipe skater takes to ride from the run out up to the lip. */
export const QUARTER_RIDE = 1.2;
/** Seconds the quarter pipe skater spends in the air above the lip. */
export const QUARTER_AIR = 0.8;
/** Seconds the quarter pipe skater takes to kick turn at the end of the run out. */
export const QUARTER_TURN = 0.5;

/**
 * Where the quarter pipe skater is `t` seconds into their run: up the ramp
 * for a trick above the lip (a kickflip 180, unless another is given), down
 * and out across the flat, then a kick turn to face the ramp again, over and
 * over.
 */
export function quarterSkaterAt(t: number, trick: SkateTrick = 'kickflip-180'): SkaterPose {
  const { length, deck, height, air } = QUARTER_PIPE;
  const lip = deck + 0.05;
  const out = length - 0.2;
  const cycle = 2 * QUARTER_RIDE + QUARTER_AIR + QUARTER_TURN;
  let time = ((t % cycle) + cycle) % cycle;
  const ride = (from: number, to: number, dir: 1 | -1): SkaterPose => {
    const s = time / QUARTER_RIDE;
    const u = lerpNumber(from, to, (1 - Math.cos(Math.PI * s)) / 2);
    return { u, z: quarterPipeHeight(u), dir, progress: s };
  };
  if (time < QUARTER_RIDE) return ride(out, lip, -1);
  time -= QUARTER_RIDE;
  if (time < QUARTER_AIR) {
    const s = time / QUARTER_AIR;
    const z = lerpNumber(quarterPipeHeight(lip), height + air, 4 * s * (1 - s));
    return { u: lip, z, dir: s < 0.5 ? -1 : 1, trick, progress: s };
  }
  time -= QUARTER_AIR;
  if (time < QUARTER_RIDE) return ride(lip, out, 1);
  time -= QUARTER_RIDE;
  const s = time / QUARTER_TURN;
  return { u: out, z: 0, dir: s < 0.5 ? 1 : -1, progress: s };
}

/**
 * The stair set, in tiles from its back corner: a deck along its back, stairs
 * down along x with a handrail down their middle, a bank beside the stairs to
 * ride back up, and a flat run out at the bottom. Heights are in pixels.
 */
export const STAIR_SET = {
  length: 4,
  width: 4,
  deck: 1,
  stairs: 2,
  steps: 4,
  /** How far along y the stairs reach; the bank fills the rest. */
  stairWidth: 2.4,
  /** How far along y the handrail runs. */
  railY: 1.2,
  /** How far along y the skater rides back up the bank. */
  bankY: 3.2,
  height: 24,
  /** How high the handrail stands above the stairs' nosing. */
  rail: 12,
  air: 14,
};

/**
 * How high the stair set's slope is at `u` tiles along it: the line along
 * the stairs' nosing, which is also the bank's surface.
 */
export function stairSlopeHeight(u: number): number {
  const { deck, stairs, height } = STAIR_SET;
  if (u <= deck) return height;
  return height * Math.max(0, 1 - (u - deck) / stairs);
}

/** How high the top of the handrail is at `u` tiles along the stair set. */
export function railHeight(u: number): number {
  return stairSlopeHeight(u) + STAIR_SET.rail;
}

export interface RailSkaterPose extends SkaterPose {
  /** Tiles across the stair set from its back corner. */
  v: number;
  /** The way they're riding, along the ground, in tiles. */
  heading: Point;
  /**
   * How far the board has turned from the way they're riding, from 0 (along
   * it) to 1 (a quarter turn, across the rail, for the boardslide).
   */
  boardTurn: number;
}

/** How long each part of the stair skater's run takes, in seconds. */
export const RAIL_TIMES = {
  approach: 0.3,
  flip: 0.7,
  slide: 1.1,
  hop: 0.4,
  bottomTurn: 0.9,
  bank: 1.4,
  topTurn: 0.9,
} as const;

/**
 * Where the stair set skater is `t` seconds into their run: along the deck,
 * a 360 flip onto the handrail, a boardslide down it, off onto the run out, a
 * turn, back up the bank and a turn on the deck, over and over.
 */
export function railSkaterAt(t: number): RailSkaterPose {
  const { deck, stairs, railY, bankY, height, air } = STAIR_SET;
  const times = RAIL_TIMES;
  const cycle = Object.values(times).reduce((a, b) => a + b, 0);
  let time = ((t % cycle) + cycle) % cycle;
  const mid = (railY + bankY) / 2;
  const across = (bankY - railY) / 2;
  // Pop well before the handrail's end, so the flip is above it by the time it gets there.
  const pop = deck - 0.35;
  const on = deck + 0.3;
  const off = deck + stairs - 0.15;
  const land = deck + stairs + 0.3;
  const top = 0.55;
  const pose = (
    u: number,
    v: number,
    z: number,
    heading: Point,
    progress: number,
    trick?: SkateTrick,
    boardTurn = 0,
  ): RailSkaterPose => ({
    u,
    v,
    z,
    heading,
    progress,
    trick,
    boardTurn,
    dir: heading.x - heading.y >= 0 ? 1 : -1,
  });
  const forward = { x: 1, y: 0 };
  const back = { x: -1, y: 0 };

  if (time < times.approach) {
    const s = time / times.approach;
    return pose(lerpNumber(top, pop, s), railY, height, forward, s);
  }
  time -= times.approach;
  if (time < times.flip) {
    const s = time / times.flip;
    const z = lerpNumber(height, railHeight(on), s) + air * 4 * s * (1 - s);
    // The board turns a quarter as it flips, to land across the rail.
    return pose(lerpNumber(pop, on, s), railY, z, forward, s, '360-flip', s);
  }
  time -= times.flip;
  if (time < times.slide) {
    const s = time / times.slide;
    const u = lerpNumber(on, off, s);
    return pose(u, railY, railHeight(u), forward, s, 'boardslide', 1);
  }
  time -= times.slide;
  if (time < times.hop) {
    const s = time / times.hop;
    const z = lerpNumber(railHeight(off), 0, s) + 6 * 4 * s * (1 - s);
    // And turns back under them as they hop off.
    return pose(lerpNumber(off, land, s), railY, z, forward, s, undefined, 1 - s);
  }
  time -= times.hop;
  // Half an ellipse round the bottom of the bank, from the rail's line to the bank's.
  if (time < times.bottomTurn) {
    const s = time / times.bottomTurn;
    const a = Math.PI * s;
    const heading = { x: Math.cos(a), y: Math.sin(a) };
    return pose(land + 0.5 * Math.sin(a), mid - across * Math.cos(a), 0, heading, s);
  }
  time -= times.bottomTurn;
  if (time < times.bank) {
    const s = time / times.bank;
    const u = lerpNumber(land, top, s);
    return pose(u, bankY, stairSlopeHeight(u), back, s);
  }
  time -= times.bank;
  // And half an ellipse round on the deck, back to the rail's line.
  const s = time / times.topTurn;
  const a = Math.PI * s;
  const heading = { x: -Math.cos(a), y: -Math.sin(a) };
  return pose(top - 0.45 * Math.sin(a), mid + across * Math.cos(a), height, heading, s);
}

/**
 * The grind box, in tiles from its back corner: a long, low box along x in
 * the middle of a flat, with room to ride past either end. `start` and `end`
 * are where it runs along x, and `far` and `near` its edges along y, with
 * metal coping on both. Heights are in pixels.
 */
export const GRIND_BOX = {
  length: 6,
  width: 4,
  start: 2,
  end: 4,
  far: 1.5,
  near: 2.5,
  height: 10,
  /** How far in from either end of the flat the skaters turn round. */
  turn: 0.5,
  /** How high an ollie onto the box pops above it. */
  air: 14,
  /** How high a flip on the flat pops. */
  flatAir: 16,
};

/**
 * The three ways across the grind box: a 50-50 grind along its far coping,
 * a manual along its top, and kickflips and pop shove-its on the flat in
 * front of it.
 */
export type BoxLine = 'grind' | 'manual' | 'flat';

/** How far along y each grind box skater rides, in tiles from its back corner. */
export const BOX_LINES: Record<BoxLine, number> = {
  grind: GRIND_BOX.far,
  manual: (GRIND_BOX.far + GRIND_BOX.near) / 2,
  flat: 3.3,
};

/** How fast the grind box skaters ride, in tiles a second. */
export const BOX_SPEED = 2.4;
/** Seconds a grind box skater takes to kick turn at either end. */
export const BOX_TURN = 0.5;
/** How far into their run each grind box skater starts, so they don't move in step. */
const BOX_START: Record<BoxLine, number> = { grind: 0, manual: 1.4, flat: 2.9 };

/**
 * Where a grind box skater is `t` seconds into their run: across the flat
 * and back, with a kick turn at either end, over and over. On the grind and
 * manual lines they ollie up onto the box, grind or manual along it and drop
 * off the other end, both ways. On the flat line they kickflip on the way
 * along and pop shove-it on the way back.
 */
export function boxSkaterAt(t: number, line: BoxLine): SkaterPose {
  const { length, start, end, height, turn, air, flatAir } = GRIND_BOX;
  const from = turn;
  const to = length - turn;
  const pass = (to - from) / BOX_SPEED;
  const cycle = 2 * (pass + BOX_TURN);
  let time = (((t + BOX_START[line]) % cycle) + cycle) % cycle;
  let dir: 1 | -1 = 1;
  if (time >= pass + BOX_TURN) {
    time -= pass + BOX_TURN;
    dir = -1;
  }
  if (time >= pass) {
    const s = (time - pass) / BOX_TURN;
    return { u: dir === 1 ? to : from, z: 0, dir: s < 0.5 ? dir : dir === 1 ? -1 : 1, progress: s };
  }
  // The box sits in the middle of the flat, so each way along it looks the
  // same from where the skater set off.
  const p = from + time * BOX_SPEED;
  const u = dir === 1 ? p : length - p;
  if (line === 'flat') {
    const pop = length / 2 - 0.6;
    const s = (p - pop) / 1.2;
    if (s <= 0 || s >= 1) return { u, z: 0, dir, progress: 0 };
    const trick = dir === 1 ? 'kickflip' : 'shove-it';
    return { u, z: flatAir * 4 * s * (1 - s), dir, trick, progress: s };
  }
  const up = start - 0.9;
  const down = end + 0.5;
  if (p > up && p < start) {
    const s = (p - up) / (start - up);
    return { u, z: height * s + air * 4 * s * (1 - s), dir, trick: 'ollie', progress: s };
  }
  if (p >= start && p <= end) {
    const trick = line === 'grind' ? '50-50' : 'manual';
    return { u, z: height, dir, trick, progress: (p - start) / (end - start) };
  }
  if (p > end && p < down) {
    const s = (p - end) / (down - end);
    return { u, z: height * (1 - s) + 4 * 4 * s * (1 - s), dir, progress: s };
  }
  return { u, z: 0, dir, progress: 0 };
}

/**
 * The skate pool, in tiles: a bowl `length` long along x and `width` across,
 * sunk into a concrete deck `rim` wide. Its floor is flat in the middle and
 * curves up into a wall at either end. Heights are in pixels, below the deck.
 */
export const SKATE_POOL = { length: 4, width: 3, rim: 0.5, ramp: 1.3, depth: 22, air: 30 };

/** How far along y, in tiles from the bowl's far edge, each pool skater rides. */
export const POOL_LANES = [1, 2] as const;

/** How high the pool's surface is, in pixels, at `u` tiles along the bowl: 0 at the coping, below it inside. */
export function poolHeight(u: number): number {
  const { length, ramp, depth } = SKATE_POOL;
  const fromWall = Math.min(u, length - u);
  if (fromWall <= 0) return 0;
  const s = Math.max(0, 1 - fromWall / ramp);
  return -depth * (1 - s * s);
}

/** Seconds a pool skater takes to ride from one wall to the other. */
export const POOL_RIDE = 1.4;
/** Seconds a pool skater spends in the air above a wall. */
export const POOL_AIR = 1;

/**
 * Where a pool skater is `t` seconds into their run: across the bowl, up the
 * wall at its right end, `trick` in the air above the coping and back down
 * into the bowl, then the same off the wall at its left end, over and over.
 */
export function poolSkaterAt(t: number, trick: SkateTrick): SkaterPose {
  const { length, air } = SKATE_POOL;
  const left = 0.05;
  const right = length - 0.05;
  const cycle = 2 * (POOL_RIDE + POOL_AIR);
  let time = ((t % cycle) + cycle) % cycle;
  const ride = (from: number, to: number, dir: 1 | -1): SkaterPose => {
    const s = time / POOL_RIDE;
    const u = lerpNumber(from, to, (1 - Math.cos(Math.PI * s)) / 2);
    return { u, z: poolHeight(u), dir, progress: s };
  };
  const pop = (u: number, dir: 1 | -1): SkaterPose => {
    const s = time / POOL_AIR;
    const lip = poolHeight(u);
    return { u, z: lip + (air - lip) * 4 * s * (1 - s), dir, trick, progress: s };
  };
  if (time < POOL_RIDE) return ride(left, right, 1);
  time -= POOL_RIDE;
  if (time < POOL_AIR) return pop(right, time < POOL_AIR / 2 ? 1 : -1);
  time -= POOL_AIR;
  if (time < POOL_RIDE) return ride(right, left, -1);
  time -= POOL_RIDE;
  return pop(left, time < POOL_AIR / 2 ? -1 : 1);
}

/**
 * The concert stage by the gate: a deck `depth` tiles deep and `height` pixels
 * tall across the back of its spot, facing the gate, with `crowd` tiles of
 * grass in front of it for the fans.
 */
export const CONCERT_STAGE = { depth: 2, crowd: 2, height: 10 };

/** Seconds between beats of the punk band's song. */
export const PUNK_BEAT = 0.34;

/** How a fan rocks out: jumping with both hands up, banging their head, or pumping a fist. */
export type RockMove = 'jump' | 'headbang' | 'fist';

export interface RockerPose {
  /** Pixels off the ground. */
  z: number;
  /** How far the head is thrown forward, from 0 to 1. */
  nod: number;
  /** How high the hands are, from 0 (hanging down) to 1 (straight up). */
  hands: number;
}

/**
 * How a fan doing `move` stands `t` seconds into the song. Every move lands
 * on the beat, feet down and head or fist at its hardest; `offset` puts a fan a little ahead of it or
 * behind it, so the crowd doesn't move as one.
 */
export function rockerAt(t: number, move: RockMove, offset = 0): RockerPose {
  const beats = (t + offset) / PUNK_BEAT;
  const bounce = Math.sin(Math.PI * (beats - Math.floor(beats)));
  switch (move) {
    case 'jump':
      return { z: 7 * bounce, nod: 0, hands: 0.7 + 0.3 * bounce };
    case 'headbang':
      return { z: 0, nod: 1 - bounce, hands: 0.15 };
    case 'fist':
      return { z: 1.5 * bounce, nod: 0.3 * (1 - bounce), hands: 1 - 0.6 * bounce };
  }
}

function lerpNumber(a: number, b: number, s: number): number {
  return a + (b - a) * s;
}

/** Tile position to isometric screen pixels, relative to tile (0, 0)'s top corner. */
export function toScreen(x: number, y: number): Point {
  return { x: ((x - y) * TILE_W) / 2, y: ((x + y) * TILE_H) / 2 };
}

/** Isometric screen pixels back to a tile position. */
export function toTile(sx: number, sy: number): Point {
  return { x: sx / TILE_W + sy / TILE_H, y: sy / TILE_H - sx / TILE_W };
}

/**
 * Turns screen-relative input (each of -1, 0 or 1; up is negative) into a
 * unit direction in tiles, so "up" walks up the screen.
 */
export function inputDirection(right: number, down: number): Point {
  const x = right + down;
  const y = down - right;
  const length = Math.hypot(x, y);
  return length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length };
}

export function isBlocked(map: MidwayMap, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
  return map.blocked[ty * map.width + tx];
}

/** Whether a walker of the given radius fits at a position. */
export function canStand(map: MidwayMap, x: number, y: number, radius = WALKER_RADIUS): boolean {
  for (let ty = Math.floor(y - radius); ty <= Math.floor(y + radius); ty++) {
    for (let tx = Math.floor(x - radius); tx <= Math.floor(x + radius); tx++) {
      if (isBlocked(map, tx, ty)) return false;
    }
  }
  return true;
}

export type Facing = 'front' | 'back';

export interface Walker extends Point {
  path: Point[];
  facing: Facing;
  /** True when the walker faces screen-left. */
  flipped: boolean;
  walking: boolean;
  /** Distance walked, in tiles; drives the walking animation. */
  stride: number;
}

export function createWalker(at: Point): Walker {
  return { x: at.x, y: at.y, path: [], facing: 'front', flipped: false, walking: false, stride: 0 };
}

function face(walker: Walker, dx: number, dy: number) {
  // Screen direction of a tile step: x is (dx - dy), y is (dx + dy).
  const sx = dx - dy;
  const sy = dx + dy;
  if (Math.abs(sy) > 1e-6) walker.facing = sy > 0 ? 'front' : 'back';
  if (Math.abs(sx) > 1e-6) walker.flipped = sx < 0;
}

/**
 * Moves a walker along a tile direction for `dt` seconds, sliding along
 * anything in the way. Returns how far it actually moved.
 */
export function walk(
  map: MidwayMap,
  walker: Walker,
  direction: Point,
  dt: number,
  speed = WALK_SPEED,
): number {
  const startX = walker.x;
  const startY = walker.y;
  const nx = walker.x + direction.x * speed * dt;
  if (canStand(map, nx, walker.y)) walker.x = nx;
  const ny = walker.y + direction.y * speed * dt;
  if (canStand(map, walker.x, ny)) walker.y = ny;

  const moved = Math.hypot(walker.x - startX, walker.y - startY);
  walker.walking = moved > 0;
  if (moved > 0) {
    face(walker, direction.x, direction.y);
    walker.stride += moved;
  }
  return moved;
}

/**
 * Moves a walker along its path for `dt` seconds. Returns true once the path
 * is used up.
 */
export function followPath(walker: Walker, dt: number, speed = WALK_SPEED): boolean {
  let budget = speed * dt;
  walker.walking = false;
  while (budget > 0 && walker.path.length > 0) {
    const next = walker.path[0];
    const dx = next.x - walker.x;
    const dy = next.y - walker.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= budget) {
      walker.x = next.x;
      walker.y = next.y;
      walker.path.shift();
      budget -= distance;
      walker.stride += distance;
    } else {
      walker.x += (dx / distance) * budget;
      walker.y += (dy / distance) * budget;
      walker.stride += budget;
      budget = 0;
    }
    if (distance > 0) face(walker, dx, dy);
    walker.walking = true;
  }
  return walker.path.length === 0;
}

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/**
 * The shortest walk from a position to the centre of a tile, as a list of tile
 * centres (A* over eight directions, without cutting corners). Returns
 * undefined when the tile can't be reached.
 */
export function findPath(map: MidwayMap, from: Point, to: Point): Point[] | undefined {
  const start = { x: Math.floor(from.x), y: Math.floor(from.y) };
  const goal = { x: Math.floor(to.x), y: Math.floor(to.y) };
  if (isBlocked(map, goal.x, goal.y)) return undefined;

  const key = (x: number, y: number) => y * map.width + x;
  const heuristic = (x: number, y: number) => {
    const dx = Math.abs(x - goal.x);
    const dy = Math.abs(y - goal.y);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const cost = new Map<number, number>([[key(start.x, start.y), 0]]);
  const cameFrom = new Map<number, number>();
  const open: { x: number; y: number; f: number }[] = [
    { ...start, f: heuristic(start.x, start.y) },
  ];
  const closed = new Set<number>();

  while (open.length > 0) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
    const current = open.splice(best, 1)[0];
    const currentKey = key(current.x, current.y);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);

    if (current.x === goal.x && current.y === goal.y) {
      const path: Point[] = [];
      let k: number | undefined = currentKey;
      while (k !== undefined && k !== key(start.x, start.y)) {
        path.unshift({ x: (k % map.width) + 0.5, y: Math.floor(k / map.width) + 0.5 });
        k = cameFrom.get(k);
      }
      return path;
    }

    for (const [dx, dy] of STEPS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (isBlocked(map, nx, ny)) continue;
      if (
        dx !== 0 &&
        dy !== 0 &&
        (isBlocked(map, current.x + dx, current.y) || isBlocked(map, current.x, current.y + dy))
      ) {
        continue;
      }
      const nextKey = key(nx, ny);
      const nextCost = cost.get(currentKey)! + (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
      if (nextCost < (cost.get(nextKey) ?? Infinity)) {
        cost.set(nextKey, nextCost);
        cameFrom.set(nextKey, currentKey);
        open.push({ x: nx, y: ny, f: nextCost + heuristic(nx, ny) });
      }
    }
  }
  return undefined;
}

/** Distance in tiles from a point to the nearest edge of a rectangle. */
export function distanceToRect(point: Point, rect: Rect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.w));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.h));
  return Math.hypot(dx, dy);
}

/** The booth the walker is close enough to use, if any. */
export function boothInReach(
  map: MidwayMap,
  point: Point,
  reach = BOOTH_REACH,
): BoothSlot | undefined {
  let nearest: BoothSlot | undefined;
  let nearestDistance = reach;
  for (const booth of map.booths) {
    const distance = distanceToRect(point, booth);
    if (distance <= nearestDistance) {
      nearest = booth;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/** A walk to the open tile beside a booth that is closest to `from`. */
export function pathToBooth(map: MidwayMap, from: Point, booth: BoothSlot): Point[] | undefined {
  let best: Point[] | undefined;
  let bestLength = Infinity;
  for (let y = booth.y - 1; y <= booth.y + booth.h; y++) {
    for (let x = booth.x - 1; x <= booth.x + booth.w; x++) {
      if (isBlocked(map, x, y)) continue;
      const path = findPath(map, from, { x, y });
      if (!path) continue;
      let length = 0;
      let prev: Point = from;
      for (const step of path) {
        length += Math.hypot(step.x - prev.x, step.y - prev.y);
        prev = step;
      }
      if (length < bestLength) {
        best = path;
        bestLength = length;
      }
    }
  }
  return best;
}

export interface Visitor extends Walker {
  /** Seconds to wait before setting off again. */
  rest: number;
  look: number;
}

/** Tiles visitors like to stroll to: the avenue and the plazas. */
export function strollTiles(map: MidwayMap): Point[] {
  const tiles: Point[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.ground[y * map.width + x] === 'path' && !isBlocked(map, x, y)) tiles.push({ x, y });
    }
  }
  return tiles;
}

export function createVisitors(map: MidwayMap, count: number, random: () => number): Visitor[] {
  const tiles = strollTiles(map);
  return Array.from({ length: count }, (_, look) => {
    const tile = tiles[Math.floor(random() * tiles.length)];
    return { ...createWalker({ x: tile.x + 0.5, y: tile.y + 0.5 }), rest: random() * 3, look };
  });
}

/** Visitors rest a while, then stroll to somewhere else on the midway. */
export function updateVisitor(
  map: MidwayMap,
  visitor: Visitor,
  dt: number,
  random: () => number,
  tiles = strollTiles(map),
) {
  if (visitor.path.length > 0) {
    if (followPath(visitor, dt, VISITOR_SPEED)) visitor.rest = 1 + random() * 4;
    return;
  }
  visitor.walking = false;
  visitor.rest -= dt;
  if (visitor.rest > 0) return;
  const tile = tiles[Math.floor(random() * tiles.length)];
  visitor.path = findPath(map, visitor, tile) ?? [];
  visitor.rest = 1;
}
