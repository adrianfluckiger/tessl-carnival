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
 * McTwist above each wall and the other a method air. The player can 50-50
 * grind, boardslide or lipslide the street course's handrail, do a frontside
 * air, a kickflip or a 540 above a lip of the halfpipe by the gate, and on
 * the second course indy grab the quarter pipe and 50-50 grind or manual the
 * grind box. Off the board, the player can crowd surf the punk concert's crowd.
 */
export type SkateTrick =
  | '360-flip'
  | 'christ-air'
  | 'kickflip-180'
  | 'boardslide'
  | 'lipslide'
  | 'indy-grab'
  | 'ollie'
  | '50-50'
  | 'manual'
  | 'kickflip'
  | 'shove-it'
  | 'mctwist'
  | 'method'
  | 'frontside-air'
  | '540'
  | 'crowd-surf';

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
/** Where on the run out the quarter pipe skater turns round, in tiles from its back. */
const QUARTER_OUT = QUARTER_PIPE.length - 0.2;

/**
 * Where the quarter pipe skater is `t` seconds into their run: up the ramp
 * for a trick above the lip (a kickflip 180, unless another is given), down
 * and out across the flat, then a kick turn to face the ramp again, over and
 * over.
 */
export function quarterSkaterAt(t: number, trick: SkateTrick = 'kickflip-180'): SkaterPose {
  const { deck, height, air } = QUARTER_PIPE;
  const lip = deck + 0.05;
  const out = QUARTER_OUT;
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

/** Where the moves along the handrail's line start and end, in tiles along the stair set. */
const RAIL_LINE = {
  /** Where the deck turns end. */
  top: 0.55,
  // Pop well before the handrail's end, so the flip is above it by the time it gets there.
  pop: STAIR_SET.deck - 0.35,
  on: STAIR_SET.deck + 0.3,
  off: STAIR_SET.deck + STAIR_SET.stairs - 0.15,
  land: STAIR_SET.deck + STAIR_SET.stairs + 0.3,
};

/** The tricks done down the handrail. */
export type RailTrick = '50-50' | 'boardslide' | 'lipslide';

/**
 * How far each rail trick turns the board from the way they ride: along the
 * rail for a 50-50, a quarter one way across it for a boardslide, and a
 * quarter the other way, tail first over the rail, for a lipslide.
 */
export const RAIL_BOARD_TURN: Record<RailTrick, number> = {
  '50-50': 0,
  boardslide: 1,
  lipslide: -1,
};

function railPose(
  u: number,
  v: number,
  z: number,
  heading: Point,
  progress: number,
  trick?: SkateTrick,
  boardTurn = 0,
): RailSkaterPose {
  return {
    u,
    v,
    z,
    heading,
    progress,
    trick,
    boardTurn,
    dir: heading.x - heading.y >= 0 ? 1 : -1,
  };
}

const FORWARD: Point = { x: 1, y: 0 };

/** Popping off the deck onto the handrail, `s` of the way there, turning the board to `turn`. */
function popOntoRail(s: number, trick: SkateTrick, turn: number): RailSkaterPose {
  const { railY, height, air } = STAIR_SET;
  const z = lerpNumber(height, railHeight(RAIL_LINE.on), s) + air * 4 * s * (1 - s);
  return railPose(
    lerpNumber(RAIL_LINE.pop, RAIL_LINE.on, s),
    railY,
    z,
    FORWARD,
    s,
    trick,
    turn * s,
  );
}

/** Riding a rail trick down the handrail, `s` of the way from getting on to getting off. */
function slideRail(s: number, trick: RailTrick): RailSkaterPose {
  const u = lerpNumber(RAIL_LINE.on, RAIL_LINE.off, s);
  return railPose(u, STAIR_SET.railY, railHeight(u), FORWARD, s, trick, RAIL_BOARD_TURN[trick]);
}

/** Hopping off the handrail's end, `s` of the way down, turning the board back from `turn`. */
function hopOffRail(s: number, turn: number): RailSkaterPose {
  const z = lerpNumber(railHeight(RAIL_LINE.off), 0, s) + 6 * 4 * s * (1 - s);
  const u = lerpNumber(RAIL_LINE.off, RAIL_LINE.land, s);
  return railPose(u, STAIR_SET.railY, z, FORWARD, s, undefined, turn * (1 - s));
}

/**
 * Where the stair set skater is `t` seconds into their run: along the deck,
 * a 360 flip onto the handrail, a boardslide down it, off onto the run out, a
 * turn, back up the bank and a turn on the deck, over and over.
 */
export function railSkaterAt(t: number): RailSkaterPose {
  const { railY, bankY, height } = STAIR_SET;
  const times = RAIL_TIMES;
  const cycle = Object.values(times).reduce((a, b) => a + b, 0);
  let time = ((t % cycle) + cycle) % cycle;
  const mid = (railY + bankY) / 2;
  const across = (bankY - railY) / 2;
  const { top, pop, land } = RAIL_LINE;
  const back = { x: -1, y: 0 };

  if (time < times.approach) {
    const s = time / times.approach;
    return railPose(lerpNumber(top, pop, s), railY, height, FORWARD, s);
  }
  time -= times.approach;
  // The board turns a quarter as it flips, to land across the rail.
  if (time < times.flip) return popOntoRail(time / times.flip, '360-flip', 1);
  time -= times.flip;
  if (time < times.slide) return slideRail(time / times.slide, 'boardslide');
  time -= times.slide;
  // And turns back under them as they hop off.
  if (time < times.hop) return hopOffRail(time / times.hop, 1);
  time -= times.hop;
  // Half an ellipse round the bottom of the bank, from the rail's line to the bank's.
  if (time < times.bottomTurn) {
    const s = time / times.bottomTurn;
    const a = Math.PI * s;
    const heading = { x: Math.cos(a), y: Math.sin(a) };
    return railPose(land + 0.5 * Math.sin(a), mid - across * Math.cos(a), 0, heading, s);
  }
  time -= times.bottomTurn;
  if (time < times.bank) {
    const s = time / times.bank;
    const u = lerpNumber(land, top, s);
    return railPose(u, bankY, stairSlopeHeight(u), back, s);
  }
  time -= times.bank;
  // And half an ellipse round on the deck, back to the rail's line.
  const s = time / times.topTurn;
  const a = Math.PI * s;
  const heading = { x: -Math.cos(a), y: -Math.sin(a) };
  return railPose(top - 0.45 * Math.sin(a), mid + across * Math.cos(a), height, heading, s);
}

// ── Skating as the player ─────────────────────────────────────────────────

/**
 * The features the player can do tricks on: the street course's stair set,
 * the halfpipe by the gate, the second course's quarter pipe and grind box as
 * a pair, and the crowd in front of the punk concert's stage to crowd surf.
 */
export type SkateFeatureKind = 'stair-rail' | 'halfpipe' | 'quarter-box' | 'crowd';

/** The tricks done above a lip of the halfpipe by the gate. */
export type HalfpipeTrick = 'frontside-air' | 'kickflip' | '540';

export interface SkateMove {
  trick: SkateTrick;
  name: string;
  /** The kind of prop the trick is done on. */
  on: PropKind;
}

export interface SkateFeature {
  kind: SkateFeatureKind;
  name: string;
  /** The props it's made of. */
  props: readonly Prop[];
  /** Where the player must stand next to, to use it; its props unless given. */
  near?: readonly Rect[];
  /** Its tricks, for keys 1, 2 and 3 in turn. */
  tricks: readonly SkateMove[];
}

/** What each kind of skate feature is called, and the tricks the player can do on it. */
export const SKATE_FEATURES: Record<SkateFeatureKind, Pick<SkateFeature, 'name' | 'tricks'>> = {
  'stair-rail': {
    name: 'Handrail',
    tricks: [
      { trick: '50-50', name: '50-50 grind', on: 'stair-rail' },
      { trick: 'boardslide', name: 'Boardslide', on: 'stair-rail' },
      { trick: 'lipslide', name: 'Lipslide', on: 'stair-rail' },
    ],
  },
  halfpipe: {
    name: 'Halfpipe',
    tricks: [
      { trick: 'frontside-air', name: 'Frontside air', on: 'halfpipe' },
      { trick: 'kickflip', name: 'Kickflip', on: 'halfpipe' },
      { trick: '540', name: '540', on: 'halfpipe' },
    ],
  },
  'quarter-box': {
    name: 'Quarter pipe and grind box',
    tricks: [
      { trick: 'indy-grab', name: 'Indy grab', on: 'quarter-pipe' },
      { trick: '50-50', name: '50-50 grind', on: 'grind-box' },
      { trick: 'manual', name: 'Manual', on: 'grind-box' },
    ],
  },
  crowd: {
    name: 'Punk crowd',
    tricks: [{ trick: 'crowd-surf', name: 'Crowd surf', on: 'stage' }],
  },
};

/** The crowd in front of the concert stage, in tiles on the midway. */
export function concertCrowd(stage: Prop): Rect {
  const { depth, crowd } = CONCERT_STAGE;
  return { x: stage.x, y: stage.y + depth, w: stage.w, h: crowd };
}

/** How close, in tiles, the player must stand to a skate feature to skate it. */
export const SKATE_REACH = 1.1;

/** Every skate feature on the midway that the player can do tricks on. */
export function skateFeatures(map: MidwayMap): SkateFeature[] {
  const features: SkateFeature[] = [];
  for (const prop of map.props) {
    if (prop.kind === 'stair-rail') {
      features.push({ kind: 'stair-rail', props: [prop], ...SKATE_FEATURES['stair-rail'] });
    }
    // Only the halfpipe by the gate is the player's; the one in the back
    // corner is its skater's.
    if (prop.kind === 'halfpipe' && prop.variant === 1) {
      features.push({ kind: 'halfpipe', props: [prop], ...SKATE_FEATURES.halfpipe });
    }
    if (prop.kind === 'stage') {
      features.push({
        kind: 'crowd',
        props: [prop],
        near: [concertCrowd(prop)],
        ...SKATE_FEATURES.crowd,
      });
    }
  }
  // The second course's quarter pipe and the grind box beside it.
  const quarter = map.props.find((prop) => prop.kind === 'quarter-pipe' && prop.variant === 1);
  const box = map.props.find((prop) => prop.kind === 'grind-box');
  if (quarter && box) {
    features.push({ kind: 'quarter-box', props: [quarter, box], ...SKATE_FEATURES['quarter-box'] });
  }
  return features;
}

/** The skate feature the player is near enough to skate, if any. */
export function featureInReach(
  features: readonly SkateFeature[],
  point: Point,
  reach = SKATE_REACH,
): SkateFeature | undefined {
  let nearest: SkateFeature | undefined;
  let nearestDistance = reach;
  for (const feature of features) {
    const areas = feature.near ?? feature.props;
    const distance = Math.min(...areas.map((area) => distanceToRect(point, area)));
    if (distance <= nearestDistance) {
      nearest = feature;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/**
 * How long each part of the player's run down the handrail takes, in
 * seconds: riding round to the bank and up it onto the deck, turning to face down the rail, popping
 * onto it, the trick down it, hopping off and rolling out to where they land.
 */
export const PLAYER_RAIL_TIMES = {
  rideUp: 1.6,
  setUp: 0.4,
  pop: 0.6,
  slide: 1.1,
  hop: 0.4,
  rollOut: 0.5,
} as const;

/** Seconds the player's run down the handrail takes, from riding up to getting control back. */
export const PLAYER_TRICK_LENGTH = Object.values(PLAYER_RAIL_TIMES).reduce((a, b) => a + b, 0);

/**
 * How long each part of the player's run on the halfpipe takes, in seconds:
 * riding round on the ground to the foot of its nearer end, climbing onto the
 * deck, dropping in and riding across to the other lip, the trick above it,
 * riding back up onto the deck, hopping off and rolling out to where they land.
 */
export const PLAYER_HALFPIPE_TIMES = {
  rideOver: 1,
  climb: 0.4,
  dropIn: 1.2,
  air: SKATE_AIR,
  rideBack: 1.2,
  hop: 0.4,
  rollOut: 0.4,
} as const;

/** Seconds the player's run on the halfpipe takes, from riding over to getting control back. */
export const PLAYER_HALFPIPE_LENGTH = Object.values(PLAYER_HALFPIPE_TIMES).reduce(
  (a, b) => a + b,
  0,
);

/**
 * How long each part of the player's crowd surf takes, in seconds: climbing
 * up onto the crowd at its end nearer where they stood, being passed along
 * across it, and being set down past its far end.
 */
export const PLAYER_SURF_TIMES = {
  climb: 0.6,
  surf: 3,
  setDown: 0.6,
} as const;

/** Seconds the player's crowd surf takes, from climbing up to getting control back. */
export const PLAYER_SURF_LENGTH = Object.values(PLAYER_SURF_TIMES).reduce((a, b) => a + b, 0);

/**
 * How the player lies on the crowd: `height` pixels up, on the fans' raised
 * hands, bobbing up to `bob` pixels more on the beat. The fans within `reach`
 * tiles of them reach up to hold them.
 */
export const CROWD_SURF = { height: 26, bob: 2, reach: 1.2 };

export interface PlayerTrick {
  feature: SkateFeature;
  /** The one of the feature's props the trick is done on. */
  prop: Prop;
  trick: SkateTrick;
  /** Where the player stood when they started. */
  from: Point;
  /** Where they land, and get control back. */
  to: Point;
  /** Seconds since they started. */
  t: number;
}

/**
 * Whether a point on a skate feature's prop, in tiles from its back corner,
 * is flat ground the player can roll across: the stair set's run out, the
 * quarter pipe's run out, or the grind box's flat clear of the box. None of
 * the halfpipe or the concert stage is.
 */
function flatOn(prop: Prop, u: number, v: number): boolean {
  if (prop.kind === 'stair-rail') return u >= STAIR_SET.deck + STAIR_SET.stairs;
  if (prop.kind === 'halfpipe' || prop.kind === 'stage') return false;
  if (prop.kind === 'quarter-pipe') return u >= QUARTER_PIPE.deck + QUARTER_PIPE.ramp;
  const { start, end, far, near } = GRIND_BOX;
  const r = WALKER_RADIUS;
  return u < start - r || u > end + r || v < far - r || v > near + r;
}

/**
 * Whether the player can roll along the ground at a point while leaving a
 * skate feature: on the flat parts of its props, or on open ground clear of
 * everything else.
 */
function canRollOut(map: MidwayMap, feature: SkateFeature, x: number, y: number): boolean {
  const inside = (prop: Prop, px: number, py: number) =>
    px >= prop.x && px <= prop.x + prop.w && py >= prop.y && py <= prop.y + prop.h;
  const on = feature.props.find((prop) => inside(prop, x, y));
  if (on) return flatOn(on, x - on.x, y - on.y);
  const r = WALKER_RADIUS;
  for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++) {
    for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
      const onFeature = feature.props.some((prop) => inside(prop, tx + 0.5, ty + 0.5));
      if (!onFeature && isBlocked(map, tx, ty)) return false;
    }
  }
  return true;
}

/** Whether the player can roll in a straight line from `from` to `to` while leaving a feature. */
function clearRollOut(map: MidwayMap, feature: SkateFeature, from: Point, to: Point): boolean {
  const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 0.05);
  for (let i = 0; i <= steps; i++) {
    const s = steps === 0 ? 0 : i / steps;
    if (!canRollOut(map, feature, lerpNumber(from.x, to.x, s), lerpNumber(from.y, to.y, s))) {
      return false;
    }
  }
  return true;
}

/**
 * Where the player starts rolling out at the end of a trick on a prop, in
 * tiles from its back corner, and the way they roll straight on from there:
 * on from the handrail's end, out from the foot of the halfpipe's end nearer
 * `from`, out towards the midway from the bottom of the quarter pipe or the
 * far end of the grind box, or on from just past the crowd's far end.
 */
function rollOutStart(prop: Prop, trick: SkateTrick, from: Point): { at: Point; heading: Point } {
  if (prop.kind === 'stage') {
    const line = surfLine(prop, from);
    return { at: { x: line.off, y: line.v }, heading: { x: line.dir, y: 0 } };
  }
  if (prop.kind === 'stair-rail') {
    return { at: { x: RAIL_LINE.land, y: STAIR_SET.railY }, heading: FORWARD };
  }
  if (prop.kind === 'halfpipe') {
    const foot = halfpipeFoot(prop, from);
    return { at: { x: foot.u, y: foot.v }, heading: { x: foot.side, y: 0 } };
  }
  const towardsMidway = { x: 0, y: 1 };
  if (prop.kind === 'quarter-pipe') {
    return { at: { x: QUARTER_OUT, y: prop.h / 2 }, heading: towardsMidway };
  }
  return {
    at: { x: GRIND_BOX.length - GRIND_BOX.turn, y: BOX_LINES[boxLine(trick)] },
    heading: towardsMidway,
  };
}

/**
 * Where the player lands after a trick on one of a feature's props, set off
 * from `from`: rolling straight on from where the trick ends to the first
 * open ground, or else the nearest open tile they can roll to without passing
 * through anything.
 */
export function landingSpot(
  map: MidwayMap,
  feature: SkateFeature,
  prop: Prop,
  trick: SkateTrick,
  from: Point,
): Point {
  const start = rollOutStart(prop, trick, from);
  const end = { x: prop.x + start.at.x, y: prop.y + start.at.y };
  for (let d = 0; d <= 4; d += 0.1) {
    const at = { x: end.x + start.heading.x * d, y: end.y + start.heading.y * d };
    if (!canRollOut(map, feature, at.x, at.y)) break;
    if (canStand(map, at.x, at.y)) return at;
  }
  let best = end;
  let bestDistance = Infinity;
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const at = { x: tx + 0.5, y: ty + 0.5 };
      const distance = Math.hypot(at.x - end.x, at.y - end.y);
      if (distance >= bestDistance || !canStand(map, at.x, at.y)) continue;
      if (!clearRollOut(map, feature, end, at)) continue;
      best = at;
      bestDistance = distance;
    }
  }
  return best;
}

/** Starts the player doing the `index`th of a feature's tricks from where they stand. */
export function startTrick(
  map: MidwayMap,
  feature: SkateFeature,
  index: number,
  from: Point,
): PlayerTrick {
  const move = feature.tricks[index];
  const prop = feature.props.find((p) => p.kind === move.on)!;
  return {
    feature,
    prop,
    trick: move.trick,
    from: { x: from.x, y: from.y },
    to: landingSpot(map, feature, prop, move.trick, from),
    t: 0,
  };
}

/** Seconds a trick takes, from riding up to getting control back. */
export function trickLength(trick: PlayerTrick): number {
  if (trick.prop.kind === 'quarter-pipe') return PLAYER_QUARTER_LENGTH;
  if (trick.prop.kind === 'grind-box') return PLAYER_BOX_LENGTH;
  if (trick.prop.kind === 'halfpipe') return PLAYER_HALFPIPE_LENGTH;
  if (trick.prop.kind === 'stage') return PLAYER_SURF_LENGTH;
  return PLAYER_TRICK_LENGTH;
}

/** Moves a trick on by `dt` seconds. Returns true once it's over. */
export function updateTrick(trick: PlayerTrick, dt: number): boolean {
  const length = trickLength(trick);
  trick.t = Math.min(length, trick.t + dt);
  return trick.t >= length;
}

function headingTo(from: Point, to: Point): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  return length < 1e-6 ? FORWARD : { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

/**
 * How high the stair set's surface is at a point, in tiles from its back
 * corner: the deck, the stairs and the bank inside it, and the ground around it.
 */
function stairSurfaceHeight(u: number, v: number): number {
  const { length, width } = STAIR_SET;
  return u >= 0 && u <= length && v >= 0 && v <= width ? stairSlopeHeight(u) : 0;
}

/**
 * The way the player rides up onto the deck from where they stood, in tiles
 * from the stair set's back corner: round the stair set on the ground to the
 * foot of the bank, up the bank, then across the deck to the top of the rail.
 */
function rideUpPath(from: Point): Point[] {
  const { deck, stairs, width, railY, bankY } = STAIR_SET;
  // Just past the foot of the stairs and the bank, where the ground is flat.
  const foot = deck + stairs + 0.4;
  const path = [from];
  if (from.x < foot && from.y > 0 && from.y < width) path.push({ x: from.x, y: width + 0.4 });
  const last = path[path.length - 1];
  if (last.x < foot) path.push({ x: foot, y: last.y });
  path.push({ x: foot, y: bankY }, { x: RAIL_LINE.top, y: bankY }, { x: RAIL_LINE.top, y: railY });
  return path;
}

/** The point `s` of the way along a path, by distance, and the way it heads there. */
function alongPath(path: readonly Point[], s: number): { at: Point; heading: Point } {
  const legs = path.slice(1).map((to, i) => Math.hypot(to.x - path[i].x, to.y - path[i].y));
  let left = s * legs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < legs.length; i++) {
    if (legs[i] < 1e-6) continue;
    if (left <= legs[i] || i === legs.length - 1) {
      const k = Math.min(1, left / legs[i]);
      const from = path[i];
      const to = path[i + 1];
      return {
        at: { x: lerpNumber(from.x, to.x, k), y: lerpNumber(from.y, to.y, k) },
        heading: headingTo(from, to),
      };
    }
    left -= legs[i];
  }
  return { at: path[path.length - 1], heading: FORWARD };
}

/**
 * Where the player is `t` seconds into a trick, in tiles from the feature's
 * back corner like the stair set skater: round to the bank and up it onto
 * the deck from where they stood, a turn to face down the rail, an ollie onto it, the trick down it,
 * a hop off and a roll out to where they land.
 */
export function playerTrickAt(trick: PlayerTrick, t = trick.t): RailSkaterPose {
  if (trick.prop.kind === 'quarter-pipe') return playerQuarterAt(trick, t);
  if (trick.prop.kind === 'grind-box') return playerBoxAt(trick, t);
  if (trick.prop.kind === 'halfpipe') return playerHalfpipeAt(trick, t);
  if (trick.prop.kind === 'stage') return playerSurfAt(trick, t);
  const { railY, height } = STAIR_SET;
  const times = PLAYER_RAIL_TIMES;
  const { x: x0, y: y0 } = trick.prop;
  const from = { x: trick.from.x - x0, y: trick.from.y - y0 };
  const top = { x: RAIL_LINE.top, y: railY };
  const ease = (s: number) => (1 - Math.cos(Math.PI * s)) / 2;
  let time = Math.max(0, Math.min(t, PLAYER_TRICK_LENGTH));
  const path = rideUpPath(from);
  const up = headingTo(path[path.length - 2], top);
  if (time < times.rideUp) {
    const s = time / times.rideUp;
    const { at, heading } = alongPath(path, ease(s));
    return railPose(at.x, at.y, stairSurfaceHeight(at.x, at.y), heading, s);
  }
  time -= times.rideUp;
  if (time < times.setUp) {
    // Turn the shorter way round, from the way they rode up to down the rail.
    const s = time / times.setUp;
    const a = Math.atan2(up.y, up.x) * (1 - s);
    const heading = { x: Math.cos(a), y: Math.sin(a) };
    return railPose(lerpNumber(RAIL_LINE.top, RAIL_LINE.pop, s), railY, height, heading, s);
  }
  time -= times.setUp;
  const railTrick = trick.trick as RailTrick;
  const turn = RAIL_BOARD_TURN[railTrick];
  if (time < times.pop) return popOntoRail(time / times.pop, 'ollie', turn);
  time -= times.pop;
  if (time < times.slide) return slideRail(time / times.slide, railTrick);
  time -= times.slide;
  if (time < times.hop) return hopOffRail(time / times.hop, turn);
  time -= times.hop;
  const land = { x: RAIL_LINE.land, y: railY };
  const to = { x: trick.to.x - x0, y: trick.to.y - y0 };
  const s = Math.min(1, time / times.rollOut);
  const e = ease(s);
  const heading = headingTo(land, to);
  return railPose(lerpNumber(land.x, to.x, e), lerpNumber(land.y, to.y, e), 0, heading, s);
}

/**
 * The foot of the halfpipe's end nearer `from`, on the ground just past it
 * across the middle, in tiles from the halfpipe's back corner, and which way
 * along x is out from that end.
 */
function halfpipeFoot(prop: Prop, from: Point): { u: number; v: number; side: 1 | -1 } {
  const { length } = HALFPIPE;
  const left = from.x - prop.x < length / 2;
  return { u: left ? -0.4 : length + 0.4, v: prop.h / 2, side: left ? -1 : 1 };
}

/**
 * Where the player is `t` seconds into a trick on the halfpipe by the gate,
 * in tiles from its back corner: round on the ground to the foot of its
 * nearer end, a hop up onto the deck, a drop in and a ride across to the
 * other lip, the trick above it, back down and up onto the deck they
 * dropped in from, a hop off the end and a roll out to where they land.
 */
function playerHalfpipeAt(trick: PlayerTrick, t: number): RailSkaterPose {
  const { length, deck, height, air } = HALFPIPE;
  const times = PLAYER_HALFPIPE_TIMES;
  const { x: x0, y: y0 } = trick.prop;
  const from = { x: trick.from.x - x0, y: trick.from.y - y0 };
  const foot = halfpipeFoot(trick.prop, trick.from);
  const footPoint = { x: foot.u, y: foot.v };
  // Into the pipe is the way back from the end they climb.
  const dir: 1 | -1 = foot.side === -1 ? 1 : -1;
  const into = { x: dir, y: 0 };
  const top = foot.side === -1 ? deck / 2 : length - deck / 2;
  const lip = foot.side === -1 ? length - deck - 0.05 : deck + 0.05;
  const ease = (s: number) => (1 - Math.cos(Math.PI * s)) / 2;
  const pose = (u: number, z: number, heading: Point, progress: number, skate?: SkateTrick) =>
    railPose(u, foot.v, z, heading, progress, skate);
  let time = Math.max(0, Math.min(t, PLAYER_HALFPIPE_LENGTH));
  if (time < times.rideOver) {
    // Along the side they stood on, then round the end, never across the pipe.
    const path = [from, { x: foot.u, y: from.y }, footPoint];
    const s = time / times.rideOver;
    const { at, heading } = alongPath(path, ease(s));
    return railPose(at.x, at.y, 0, heading, s);
  }
  time -= times.rideOver;
  if (time < times.climb) {
    const s = time / times.climb;
    return pose(lerpNumber(foot.u, top, s), height * s + 8 * 4 * s * (1 - s), into, s);
  }
  time -= times.climb;
  if (time < times.dropIn) {
    const s = time / times.dropIn;
    const u = lerpNumber(top, lip, ease(s));
    return pose(u, halfpipeHeight(u), into, s);
  }
  time -= times.dropIn;
  if (time < times.air) {
    // Up past the lip and back down into the pipe, turning at the top.
    const s = time / times.air;
    const z0 = halfpipeHeight(lip);
    const z = z0 + (height + air - z0) * 4 * s * (1 - s);
    const heading = s < 0.5 ? into : { x: -dir, y: 0 };
    return pose(lip, z, heading, s, trick.trick);
  }
  time -= times.air;
  if (time < times.rideBack) {
    const s = time / times.rideBack;
    const u = lerpNumber(lip, top, ease(s));
    return pose(u, halfpipeHeight(u), { x: -dir, y: 0 }, s);
  }
  time -= times.rideBack;
  const out = { x: foot.side, y: 0 };
  if (time < times.hop) {
    const s = time / times.hop;
    return pose(lerpNumber(top, foot.u, s), height * (1 - s) + 8 * 4 * s * (1 - s), out, s);
  }
  time -= times.hop;
  const to = { x: trick.to.x - x0, y: trick.to.y - y0 };
  const s = Math.min(1, time / times.rollOut);
  const e = ease(s);
  const heading = headingTo(footPoint, to);
  return railPose(lerpNumber(foot.u, to.x, e), lerpNumber(foot.v, to.y, e), 0, heading, s);
}

/**
 * The line the player is passed along across the crowd, in tiles from the
 * stage spot's back corner: along x through the middle of the crowd, from
 * its end nearer `from` (`start`) to its far end (`end`), heading `dir`
 * along x, and `off`, just past the far end, where they're set down.
 */
function surfLine(
  prop: Prop,
  from: Point,
): { start: number; end: number; off: number; v: number; dir: 1 | -1 } {
  const { depth, crowd } = CONCERT_STAGE;
  const v = depth + crowd / 2;
  const edge = 0.3;
  const off = WALKER_RADIUS + 0.1;
  if (from.x - prop.x < prop.w / 2) {
    return { start: edge, end: prop.w - edge, off: prop.w + off, v, dir: 1 };
  }
  return { start: prop.w - edge, end: edge, off: -off, v, dir: -1 };
}

/** How high the player rides on the crowd `time` seconds into being passed along, in pixels. */
function surfHeight(time: number): number {
  return CROWD_SURF.height + CROWD_SURF.bob * Math.abs(Math.sin((Math.PI * time) / PUNK_BEAT));
}

/**
 * Where the player is `t` seconds into a crowd surf, in tiles from the stage
 * spot's back corner: climbing from where they stood up onto the crowd's
 * nearer end, lying flat on the fans' hands as they're passed along across
 * it, bobbing on the beat, then set down past its far end where they land.
 */
function playerSurfAt(trick: PlayerTrick, t: number): RailSkaterPose {
  const times = PLAYER_SURF_TIMES;
  const { x: x0, y: y0 } = trick.prop;
  const line = surfLine(trick.prop, trick.from);
  const from = { x: trick.from.x - x0, y: trick.from.y - y0 };
  const to = { x: trick.to.x - x0, y: trick.to.y - y0 };
  const along = { x: line.dir, y: 0 };
  const ease = (s: number) => (1 - Math.cos(Math.PI * s)) / 2;
  let time = Math.max(0, Math.min(t, PLAYER_SURF_LENGTH));
  if (time < times.climb) {
    const s = time / times.climb;
    const e = ease(s);
    const u = lerpNumber(from.x, line.start, e);
    return railPose(u, lerpNumber(from.y, line.v, e), CROWD_SURF.height * e, along, s);
  }
  time -= times.climb;
  if (time < times.surf) {
    const s = time / times.surf;
    const u = lerpNumber(line.start, line.end, s);
    return railPose(u, line.v, surfHeight(time), along, s, 'crowd-surf');
  }
  time -= times.surf;
  const s = Math.min(1, time / times.setDown);
  const e = ease(s);
  const z = surfHeight(times.surf) * (1 - e);
  return railPose(lerpNumber(line.end, to.x, e), lerpNumber(line.v, to.y, e), z, along, s);
}

/**
 * How high a fan at `fan`, in tiles on the midway, reaches up to hold the
 * player crowd surfing `t` seconds in: from 0, not at all, to 1, both hands
 * straight up, for the fans right under them. Always 0 for any other trick.
 */
export function crowdReach(trick: PlayerTrick | undefined, fan: Point, t = trick?.t ?? 0): number {
  if (trick?.prop.kind !== 'stage') return 0;
  const pose = playerTrickAt(trick, t);
  const surfer = { x: trick.prop.x + pose.u, y: trick.prop.y + pose.v };
  const near = Math.max(0, 1 - Math.hypot(fan.x - surfer.x, fan.y - surfer.y) / CROWD_SURF.reach);
  return near * Math.min(1, pose.z / CROWD_SURF.height);
}

/** Where the player is on the midway `t` seconds into a trick, in tiles. */
export function trickPosition(trick: PlayerTrick, t = trick.t): Point {
  const pose = playerTrickAt(trick, t);
  return { x: trick.prop.x + pose.u, y: trick.prop.y + pose.v };
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

// ── Skating the second course as the player ───────────────────────────────

/** Seconds a grind box skater takes to ride from one end of the flat to the other. */
const BOX_PASS = (GRIND_BOX.length - 2 * GRIND_BOX.turn) / BOX_SPEED;

/**
 * How long each part of the player's indy grab off the quarter pipe takes, in
 * seconds: riding round to its run out, turning to face the ramp, riding up
 * it, the grab above the lip, riding back down, turning towards the midway
 * and rolling out to where they land.
 */
export const PLAYER_QUARTER_TIMES = {
  rideIn: 1.2,
  setUp: 0.3,
  up: QUARTER_RIDE,
  air: QUARTER_AIR,
  down: QUARTER_RIDE,
  turn: 0.3,
  rollOut: 0.6,
} as const;

/**
 * How long each part of the player's run along the grind box takes, in
 * seconds: riding round to the near end of the flat, turning to face along
 * it, the ollie onto the box, the trick along it and the drop off the far
 * end, then turning towards the midway and rolling out to where they land.
 */
export const PLAYER_BOX_TIMES = {
  rideIn: 1.4,
  setUp: 0.3,
  pass: BOX_PASS,
  turn: 0.3,
  rollOut: 0.6,
} as const;

/** Seconds the player's indy grab off the quarter pipe takes. */
const PLAYER_QUARTER_LENGTH = Object.values(PLAYER_QUARTER_TIMES).reduce((a, b) => a + b, 0);
/** Seconds the player's run along the grind box takes. */
const PLAYER_BOX_LENGTH = Object.values(PLAYER_BOX_TIMES).reduce((a, b) => a + b, 0);

/** The grind box line the player rides for a trick: the far coping for a 50-50, the top for a manual. */
function boxLine(trick: SkateTrick): BoxLine {
  return trick === 'manual' ? 'manual' : 'grind';
}

/** A heading `s` of the way round from `from` to `to`, turning the shorter way. */
function turnHeading(from: Point, to: Point, s: number): Point {
  const a = Math.atan2(from.y, from.x);
  const d = Math.atan2(to.y, to.x) - a;
  const b = a + (((d + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * s;
  return { x: Math.cos(b), y: Math.sin(b) };
}

/** A pose riding on the flat ground, turning on the spot from one heading to another. */
function turnPose(at: Point, from: Point, to: Point, s: number): RailSkaterPose {
  return railPose(at.x, at.y, 0, turnHeading(from, to, s), s);
}

/** A pose riding along x, from a quarter pipe or grind box skater's pose. */
function alongX(pose: SkaterPose, v: number): RailSkaterPose {
  return { ...pose, v, heading: { x: pose.dir, y: 0 }, boardTurn: 0 };
}

/** The end of a trick: rolling out from `at` to where they land, `s` of the way there. */
function rollOutPose(trick: PlayerTrick, at: Point, s: number): RailSkaterPose {
  const to = { x: trick.to.x - trick.prop.x, y: trick.to.y - trick.prop.y };
  const e = (1 - Math.cos(Math.PI * Math.min(1, s))) / 2;
  return railPose(lerpNumber(at.x, to.x, e), lerpNumber(at.y, to.y, e), 0, headingTo(at, to), s);
}

/**
 * Where the player is `t` seconds into an indy grab off the quarter pipe, in
 * tiles from its back corner: round on the ground to the bottom of its run
 * out, up the ramp, the grab above the lip, back down and out to where they
 * land.
 */
function playerQuarterAt(trick: PlayerTrick, t: number): RailSkaterPose {
  const times = PLAYER_QUARTER_TIMES;
  const { prop } = trick;
  const mid = prop.h / 2;
  const from = { x: trick.from.x - prop.x, y: trick.from.y - prop.y };
  const bottom = { x: QUARTER_OUT, y: mid };
  // From beside the grind box, round along the flat in front of it.
  const lane = BOX_LINES.flat;
  const path =
    from.x > QUARTER_OUT
      ? [from, { x: from.x, y: lane }, { x: QUARTER_OUT, y: lane }, bottom]
      : [from, { x: QUARTER_OUT, y: from.y }, bottom];
  const toRamp = { x: -1, y: 0 };
  let time = Math.max(0, Math.min(t, PLAYER_QUARTER_LENGTH));
  if (time < times.rideIn) {
    const s = time / times.rideIn;
    const { at, heading } = alongPath(path, (1 - Math.cos(Math.PI * s)) / 2);
    const inside = at.x >= 0 && at.x <= prop.w && at.y >= 0 && at.y <= prop.h;
    return railPose(at.x, at.y, inside ? quarterPipeHeight(at.x) : 0, heading, s);
  }
  time -= times.rideIn;
  if (time < times.setUp) {
    const last = headingTo(path[path.length - 2], bottom);
    return turnPose(bottom, last, toRamp, time / times.setUp);
  }
  time -= times.setUp;
  const run = times.up + times.air + times.down;
  if (time < run) return alongX(quarterSkaterAt(time, trick.trick), mid);
  time -= run;
  const start = rollOutStart(prop, trick.trick, trick.from);
  const out = headingTo(bottom, { x: trick.to.x - prop.x, y: trick.to.y - prop.y });
  if (time < times.turn) return turnPose(bottom, FORWARD, out, time / times.turn);
  time -= times.turn;
  return rollOutPose(trick, start.at, time / times.rollOut);
}

/**
 * Where the player is `t` seconds into a trick along the grind box, in tiles
 * from its back corner: round on the ground, along the flat in front of the
 * box, to the near end of the trick's line, then along it like the grind box
 * skaters, and out to where they land.
 */
function playerBoxAt(trick: PlayerTrick, t: number): RailSkaterPose {
  const times = PLAYER_BOX_TIMES;
  const { prop } = trick;
  const line = boxLine(trick.trick);
  const v = BOX_LINES[line];
  const { turn, length } = GRIND_BOX;
  const from = { x: trick.from.x - prop.x, y: trick.from.y - prop.y };
  // In front of the box, where the ride round never passes through it. From
  // in front of the quarter pipe, along the ground past its ramp first.
  const lane = BOX_LINES.flat;
  const start = { x: turn, y: v };
  const side = { x: Math.max(from.x, 0), y: from.y };
  const path = [from, side, { x: side.x, y: lane }, { x: turn, y: lane }, start];
  let time = Math.max(0, Math.min(t, PLAYER_BOX_LENGTH));
  if (time < times.rideIn) {
    const s = time / times.rideIn;
    const { at, heading } = alongPath(path, (1 - Math.cos(Math.PI * s)) / 2);
    return railPose(at.x, at.y, 0, heading, s);
  }
  time -= times.rideIn;
  if (time < times.setUp) {
    const last = headingTo(path[path.length - 2], start);
    return turnPose(start, last, FORWARD, time / times.setUp);
  }
  time -= times.setUp;
  if (time < times.pass) {
    return alongX(boxSkaterAt(time - BOX_START[line], line), v);
  }
  time -= times.pass;
  const end = { x: length - turn, y: v };
  const out = headingTo(end, { x: trick.to.x - prop.x, y: trick.to.y - prop.y });
  if (time < times.turn) return turnPose(end, FORWARD, out, time / times.turn);
  time -= times.turn;
  return rollOutPose(trick, end, time / times.rollOut);
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
