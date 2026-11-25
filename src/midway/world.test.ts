import { describe, expect, it } from 'vitest';
import {
  BOX_LINES,
  BOX_SPEED,
  BOX_TURN,
  boxSkaterAt,
  boothInReach,
  canStand,
  createVisitors,
  createWalker,
  findPath,
  followPath,
  GRIND_BOX,
  HALFPIPE,
  halfpipeHeight,
  inputDirection,
  isBlocked,
  layoutMidway,
  pathToBooth,
  POOL_AIR,
  POOL_LANES,
  POOL_RIDE,
  poolHeight,
  poolSkaterAt,
  QUARTER_AIR,
  QUARTER_PIPE,
  QUARTER_RIDE,
  QUARTER_TURN,
  quarterPipeHeight,
  quarterSkaterAt,
  RAIL_TIMES,
  railHeight,
  railSkaterAt,
  seededRandom,
  strollTiles,
  SKATE_AIR,
  SKATE_RIDE,
  SKATE_POOL,
  skaterAt,
  STAIR_SET,
  stairSlopeHeight,
  toScreen,
  toTile,
  updateVisitor,
  walk,
} from './world';

describe('layoutMidway', () => {
  it('gives every game its own booth, nearest the gate first', () => {
    const map = layoutMidway(['water-cannon', 'ring-toss', 'hook-a-duck']);
    const open = map.booths.filter((b) => b.gameId);
    expect(open.map((b) => b.gameId)).toEqual(['water-cannon', 'ring-toss', 'hook-a-duck']);
    expect(open[0].y).toBeGreaterThan(open[2].y);
  });

  it('builds a booth only for each game, with no empty booths', () => {
    expect(layoutMidway(['water-cannon']).booths).toHaveLength(1);
    expect(layoutMidway([]).booths).toHaveLength(0);
  });

  it('leaves the ground across the avenue from the skating course open', () => {
    const map = layoutMidway([]);
    // The street course beside the booths: the stair set and the quarter pipe
    // level with it, not the second course up in the back corner.
    const stairs = map.props.find((p) => p.kind === 'stair-rail')!;
    const course = map.props.filter(
      (p) => (p.kind === 'quarter-pipe' || p.kind === 'stair-rail') && p.y + p.h > stairs.y,
    );
    const top = Math.min(...course.map((p) => p.y));
    const bottom = Math.max(...course.map((p) => p.y + p.h));
    const right = Math.max(...course.map((p) => p.x + p.w));
    for (const prop of map.props) {
      if (['bunting-pole', 'billboard', 'skate-pool'].includes(prop.kind)) continue;
      const level = prop.y < bottom && top < prop.y + prop.h;
      expect(level && prop.x >= right, `${prop.kind} at ${prop.x},${prop.y}`).toBe(false);
    }
    expect(map.props.some((p) => p.kind === 'cart' && p.y < bottom)).toBe(false);
  });

  it('grows the avenue as games are added', () => {
    const ids = Array.from({ length: 9 }, (_, i) => `game-${i}`);
    const small = layoutMidway(ids.slice(0, 1));
    const big = layoutMidway(ids);
    expect(big.booths.filter((b) => b.gameId)).toHaveLength(9);
    expect(big.height).toBeGreaterThan(small.height);
  });

  it('blocks booths and keeps the edge fenced', () => {
    const map = layoutMidway(['water-cannon']);
    const booth = map.booths[0];
    expect(isBlocked(map, booth.x, booth.y)).toBe(true);
    expect(isBlocked(map, 0, 5)).toBe(true);
    expect(isBlocked(map, map.width - 1, 5)).toBe(true);
    expect(isBlocked(map, -1, 0)).toBe(true);
  });

  it('puts the clown posse on the grass by the crossroads in front of the gate', () => {
    const map = layoutMidway(['water-cannon']);
    const posse = map.props.filter((p) => p.kind === 'posse');
    expect(posse).toHaveLength(1);
    const spot = posse[0];
    expect(map.ground[spot.y * map.width + spot.x]).toBe('grass');
    // Right beside where the avenue meets the cross path, south of it.
    expect(spot.x).toBe(map.avenueX + 2);
    expect(map.ground[(spot.y - 1) * map.width + spot.x]).toBe('path');
    expect(map.ground[spot.y * map.width + map.avenueX + 1]).toBe('path');
    for (const other of [...map.props, ...map.booths]) {
      if (other === spot) continue;
      const overlaps =
        other.x < spot.x + spot.w &&
        spot.x < other.x + other.w &&
        other.y < spot.y + spot.h &&
        spot.y < other.y + other.h;
      expect(overlaps).toBe(false);
    }
  });

  it('puts the halfpipe in the back right corner, out of the way', () => {
    const map = layoutMidway(['water-cannon']);
    const pipes = map.props.filter((p) => p.kind === 'halfpipe');
    expect(pipes).toHaveLength(1);
    const pipe = pipes[0];
    // Against the back hedge and the right hedge.
    expect(pipe.y).toBe(1);
    expect(pipe.x + pipe.w).toBe(map.width - 1);
    expect(pipe.w).toBe(HALFPIPE.length);
    expect(isBlocked(map, pipe.x, pipe.y)).toBe(true);
    for (const other of [...map.props, ...map.booths]) {
      if (other === pipe) continue;
      const overlaps =
        other.x < pipe.x + pipe.w &&
        pipe.x < other.x + other.w &&
        other.y < pipe.y + pipe.h &&
        pipe.y < other.y + other.h;
      expect(overlaps).toBe(false);
    }
  });

  it('puts the street skating course in the upper left, out of the way', () => {
    for (const games of [1, 5, 9]) {
      const map = layoutMidway(Array.from({ length: games }, (_, i) => `game-${i}`));
      const course = map.props.filter(
        (p) => (p.kind === 'quarter-pipe' && p.variant === 0) || p.kind === 'stair-rail',
      );
      expect(course.map((p) => p.kind).sort()).toEqual(['quarter-pipe', 'stair-rail']);
      const [quarter, stairs] = ['quarter-pipe', 'stair-rail'].map((kind) =>
        course.find((p) => p.kind === kind)!,
      );
      // The quarter pipe has its back to the left hedge, with the stairs beside it.
      expect(quarter.x).toBe(1);
      expect(quarter.w).toBe(QUARTER_PIPE.length);
      expect(stairs.x).toBeGreaterThanOrEqual(quarter.x + quarter.w);
      expect(stairs.w).toBe(STAIR_SET.length);
      // Up and to the left of the middle of the grounds, as they look on screen.
      const middle = toScreen(map.width / 2, map.height / 2);
      for (const part of course) {
        const centre = toScreen(part.x + part.w / 2, part.y + part.h / 2);
        // A much longer avenue moves the middle down the left side, level with the course.
        if (games <= 5) {
          expect(centre.x).toBeLessThan(middle.x);
          expect(centre.y).toBeLessThan(middle.y);
        }
        expect(part.x + part.w).toBeLessThanOrEqual(map.avenueX);
        expect(isBlocked(map, part.x, part.y)).toBe(true);
        for (const other of [...map.props, ...map.booths]) {
          if (other === part) continue;
          const overlaps =
            other.x < part.x + part.w &&
            part.x < other.x + other.w &&
            other.y < part.y + part.h &&
            part.y < other.y + other.h;
          expect(overlaps).toBe(false);
        }
      }
    }
  });

  it('builds a second course to the right of the street course, with concrete under both', () => {
    for (const games of [1, 5, 9]) {
      const map = layoutMidway(Array.from({ length: games }, (_, i) => `game-${i}`));
      const stairs = map.props.find((p) => p.kind === 'stair-rail')!;
      const quarters = map.props.filter((p) => p.kind === 'quarter-pipe');
      expect(quarters).toHaveLength(2);
      const second = quarters.find((p) => p.variant === 1)!;
      const boxes = map.props.filter((p) => p.kind === 'grind-box');
      expect(boxes).toHaveLength(1);
      const box = boxes[0];
      // The second quarter pipe has its back to the left hedge too, with the box beside it.
      expect(second.x).toBe(1);
      expect(box.x).toBeGreaterThanOrEqual(second.x + second.w);
      expect(box.w).toBe(GRIND_BOX.length);
      expect(box.x + box.w).toBeLessThanOrEqual(map.avenueX - 1);
      const centre = (p: { x: number; y: number; w: number; h: number }) =>
        toScreen(p.x + p.w / 2, p.y + p.h / 2);
      for (const part of [second, box]) {
        // To the right of the stair set, as it looks on screen.
        expect(centre(part).x).toBeGreaterThan(centre(stairs).x);
      }
      // Every tile under every street skating feature is concrete, and only those
      // and the gaps between them are.
      const features = map.props.filter((p) =>
        ['quarter-pipe', 'stair-rail', 'grind-box'].includes(p.kind),
      );
      expect(features).toHaveLength(4);
      for (const part of features) {
        for (let y = part.y; y < part.y + part.h; y++) {
          for (let x = part.x; x < part.x + part.w; x++) {
            expect(map.ground[y * map.width + x]).toBe('concrete');
          }
        }
      }
      for (const pad of map.pads) {
        expect(features.some((p) => p.x < pad.x + pad.w && pad.x < p.x + p.w)).toBe(true);
      }
      // Visitors stroll the paths, not the skate park.
      for (const tile of strollTiles(map)) {
        expect(map.ground[tile.y * map.width + tile.x]).toBe('path');
      }
    }
  });

  it('puts the skate pool in front of the AI DevCon billboard', () => {
    for (const games of [0, 5, 9]) {
      const map = layoutMidway(Array.from({ length: games }, (_, i) => `game-${i}`));
      const pools = map.props.filter((p) => p.kind === 'skate-pool');
      expect(pools).toHaveLength(1);
      const pool = pools[0];
      const billboard = map.props.find((p) => p.kind === 'billboard')!;
      // Right in front of it, and wide enough to span it.
      expect(pool.y).toBe(billboard.y + billboard.h);
      expect(pool.x).toBeLessThanOrEqual(billboard.x);
      expect(pool.x + pool.w).toBeGreaterThanOrEqual(billboard.x + billboard.w);
      expect(pool.w).toBe(SKATE_POOL.length + 2 * SKATE_POOL.rim);
      expect(pool.h).toBe(SKATE_POOL.width + 2 * SKATE_POOL.rim);
      expect(isBlocked(map, pool.x, pool.y)).toBe(true);
      for (const other of [...map.props, ...map.booths]) {
        if (other === pool) continue;
        const overlaps =
          other.x < pool.x + pool.w &&
          pool.x < other.x + other.w &&
          other.y < pool.y + pool.h &&
          pool.y < other.y + other.h;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('lets the player reach every booth from the gate', () => {
    const ids = Array.from({ length: 7 }, (_, i) => `game-${i}`);
    const map = layoutMidway(ids);
    expect(canStand(map, map.spawn.x, map.spawn.y)).toBe(true);
    for (const booth of map.booths) {
      const path = pathToBooth(map, map.spawn, booth);
      expect(path, `booth ${booth.index}`).toBeDefined();
      expect(boothInReach(map, path!.at(-1)!)).toBe(booth);
    }
  });

  it('never stacks booths and scenery on the same tile, however many games there are', () => {
    for (const count of [0, 1, 4, 9, 15]) {
      const map = layoutMidway(Array.from({ length: count }, (_, i) => `game-${i}`));
      const taken = new Set<string>();
      for (const thing of [...map.booths, ...map.props]) {
        for (let y = thing.y; y < thing.y + thing.h; y++) {
          for (let x = thing.x; x < thing.x + thing.w; x++) {
            expect(taken.has(`${x},${y}`), `${count} games: ${x},${y}`).toBe(false);
            expect(x > 0 && y > 0 && x < map.width - 1 && y < map.height - 1).toBe(true);
            taken.add(`${x},${y}`);
          }
        }
      }
    }
  });

  it('keeps the avenue clear from the gate to the big top', () => {
    const map = layoutMidway(['water-cannon']);
    for (let y = 6; y < map.height - 1; y++) {
      expect(isBlocked(map, map.avenueX, y)).toBe(false);
      expect(isBlocked(map, map.avenueX + 1, y)).toBe(false);
    }
  });

  it('is the same on every visit', () => {
    expect(layoutMidway(['a'])).toEqual(layoutMidway(['a']));
  });
});

describe('isometric projection', () => {
  it('turns tiles into screen pixels and back', () => {
    expect(toScreen(1, 0)).toEqual({ x: 16, y: 8 });
    expect(toScreen(0, 1)).toEqual({ x: -16, y: 8 });
    const back = toTile(toScreen(3.25, 7.5).x, toScreen(3.25, 7.5).y);
    expect(back.x).toBeCloseTo(3.25);
    expect(back.y).toBeCloseTo(7.5);
  });

  it('walks up the screen when up is pressed', () => {
    const up = inputDirection(0, -1);
    const step = toScreen(up.x, up.y);
    expect(step.x).toBeCloseTo(0);
    expect(step.y).toBeLessThan(0);
    expect(Math.hypot(up.x, up.y)).toBeCloseTo(1);
    expect(inputDirection(0, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe('walking', () => {
  it('moves freely across open ground', () => {
    const map = layoutMidway([]);
    const walker = createWalker(map.spawn);
    walk(map, walker, { x: 0, y: -1 }, 0.25);
    expect(walker.y).toBeCloseTo(map.spawn.y - 0.25 * 4.2);
    expect(walker.walking).toBe(true);
    expect(walker.facing).toBe('back');
  });

  it("can't walk through a booth", () => {
    const map = layoutMidway(['water-cannon']);
    const booth = map.booths[0];
    const walker = createWalker({ x: booth.x + 1, y: booth.y + booth.h + 0.5 });
    for (let i = 0; i < 60; i++) walk(map, walker, { x: 0, y: -1 }, 1 / 60);
    expect(walker.y).toBeGreaterThanOrEqual(booth.y + booth.h + 0.3 - 1e-9);
  });

  it('follows a path to the end', () => {
    const map = layoutMidway([]);
    const walker = createWalker(map.spawn);
    walker.path = findPath(map, walker, { x: map.avenueX, y: 5 })!;
    let done = false;
    for (let i = 0; i < 600 && !done; i++) done = followPath(walker, 1 / 30);
    expect(done).toBe(true);
    expect(walker.x).toBe(map.avenueX + 0.5);
    expect(walker.y).toBe(5.5);
  });
});

describe('findPath', () => {
  it('goes round booths rather than through them', () => {
    const map = layoutMidway(['water-cannon']);
    const booth = map.booths[0];
    const path = findPath(
      map,
      { x: booth.x - 0.5, y: booth.y + 1 },
      { x: booth.x + booth.w, y: booth.y + 1 },
    )!;
    expect(path).toBeDefined();
    for (const step of path)
      expect(isBlocked(map, Math.floor(step.x), Math.floor(step.y))).toBe(false);
  });

  it('gives up on tiles nobody can stand on', () => {
    const map = layoutMidway(['water-cannon']);
    const booth = map.booths[0];
    expect(findPath(map, map.spawn, { x: booth.x, y: booth.y })).toBeUndefined();
  });
});

describe('boothInReach', () => {
  it('finds the booth the player is standing at, and nothing out in the open', () => {
    const map = layoutMidway(['water-cannon']);
    const booth = map.booths[0];
    expect(boothInReach(map, { x: booth.x + 1, y: booth.y + booth.h + 0.5 })).toBe(booth);
    expect(boothInReach(map, map.spawn)).toBeUndefined();
  });
});

describe('visitors', () => {
  it('stroll the midway without walking into anything', () => {
    const map = layoutMidway(['water-cannon']);
    const random = seededRandom(1);
    const visitors = createVisitors(map, 5, random);
    for (let i = 0; i < 900; i++) {
      for (const visitor of visitors) updateVisitor(map, visitor, 1 / 30, random);
    }
    for (const visitor of visitors) {
      expect(isBlocked(map, Math.floor(visitor.x), Math.floor(visitor.y))).toBe(false);
      expect(visitor.stride).toBeGreaterThan(0);
    }
  });
});

describe('the halfpipe skater', () => {
  const { length, deck, height } = HALFPIPE;
  const cycle = 2 * (SKATE_RIDE + SKATE_AIR);

  it('shapes the pipe with a deck at each end and a flat bottom', () => {
    expect(halfpipeHeight(0)).toBe(height);
    expect(halfpipeHeight(deck)).toBe(height);
    expect(halfpipeHeight(length - deck)).toBe(height);
    expect(halfpipeHeight(length / 2)).toBe(0);
    expect(halfpipeHeight(deck + 0.3)).toBeGreaterThan(halfpipeHeight(deck + 0.6));
  });

  it('rides the surface between the lips', () => {
    for (let t = 0; t < SKATE_RIDE; t += 0.1) {
      const pose = skaterAt(t);
      expect(pose.trick).toBeUndefined();
      expect(pose.u).toBeGreaterThan(deck);
      expect(pose.u).toBeLessThan(length - deck);
      expect(pose.z).toBeCloseTo(halfpipeHeight(pose.u));
    }
    expect(skaterAt(SKATE_RIDE / 2).z).toBeCloseTo(0);
  });

  it('does a Christ air above the right lip', () => {
    const pose = skaterAt(SKATE_RIDE + SKATE_AIR / 2);
    expect(pose.trick).toBe('christ-air');
    expect(pose.u).toBeGreaterThan(length / 2);
    expect(pose.z).toBeCloseTo(height + HALFPIPE.air);
  });

  it('does a 360 flip above the left lip', () => {
    const pose = skaterAt(2 * SKATE_RIDE + SKATE_AIR + SKATE_AIR / 2);
    expect(pose.trick).toBe('360-flip');
    expect(pose.u).toBeLessThan(length / 2);
    expect(pose.z).toBeCloseTo(height + HALFPIPE.air);
  });

  it('turns round in the air and heads back the other way', () => {
    expect(skaterAt(0.1).dir).toBe(1);
    expect(skaterAt(SKATE_RIDE + SKATE_AIR * 0.9).dir).toBe(-1);
    expect(skaterAt(SKATE_RIDE + SKATE_AIR + 0.1).dir).toBe(-1);
    expect(skaterAt(cycle - 0.05).dir).toBe(1);
  });

  it('moves smoothly round the whole run, over and over', () => {
    let last = skaterAt(0);
    for (let t = 0.01; t < cycle * 2; t += 0.01) {
      const pose = skaterAt(t);
      expect(Math.abs(pose.u - last.u)).toBeLessThan(0.1);
      expect(Math.abs(pose.z - last.z)).toBeLessThan(2);
      last = pose;
    }
  });
});

describe('the quarter pipe skater', () => {
  const { length, deck, height, air } = QUARTER_PIPE;
  const cycle = 2 * QUARTER_RIDE + QUARTER_AIR + QUARTER_TURN;

  it('shapes the pipe with a deck at the back, a ramp and a flat run out', () => {
    expect(quarterPipeHeight(0)).toBe(height);
    expect(quarterPipeHeight(deck)).toBe(height);
    expect(quarterPipeHeight(deck + 0.3)).toBeGreaterThan(quarterPipeHeight(deck + 0.6));
    expect(quarterPipeHeight(length)).toBe(0);
  });

  it('rides up the ramp to the lip on the surface', () => {
    for (let t = 0; t < QUARTER_RIDE; t += 0.1) {
      const pose = quarterSkaterAt(t);
      expect(pose.trick).toBeUndefined();
      expect(pose.dir).toBe(-1);
      expect(pose.u).toBeGreaterThan(deck);
      expect(pose.u).toBeLessThan(length);
      expect(pose.z).toBeCloseTo(quarterPipeHeight(pose.u));
    }
  });

  it('does a kickflip 180 above the lip, turning round to ride back down', () => {
    const pose = quarterSkaterAt(QUARTER_RIDE + QUARTER_AIR / 2);
    expect(pose.trick).toBe('kickflip-180');
    expect(pose.u).toBeLessThan(deck + 0.1);
    expect(pose.z).toBeCloseTo(height + air);
    expect(quarterSkaterAt(QUARTER_RIDE + 0.1).dir).toBe(-1);
    expect(quarterSkaterAt(QUARTER_RIDE + QUARTER_AIR - 0.1).dir).toBe(1);
    expect(quarterSkaterAt(QUARTER_RIDE + QUARTER_AIR + 0.1).dir).toBe(1);
  });

  it('kick turns at the end of the run out to face the ramp again', () => {
    expect(quarterSkaterAt(cycle - QUARTER_TURN + 0.1).dir).toBe(1);
    expect(quarterSkaterAt(cycle - 0.05).dir).toBe(-1);
    expect(quarterSkaterAt(cycle - 0.05).z).toBe(0);
  });

  it('moves smoothly round the whole run, over and over', () => {
    let last = quarterSkaterAt(0);
    for (let t = 0.01; t < cycle * 2; t += 0.01) {
      const pose = quarterSkaterAt(t);
      expect(Math.abs(pose.u - last.u)).toBeLessThan(0.1);
      expect(Math.abs(pose.z - last.z)).toBeLessThan(2);
      last = pose;
    }
  });
});

describe('the stair set skater', () => {
  const { deck, stairs, railY, bankY, height, rail } = STAIR_SET;
  const times = RAIL_TIMES;
  const cycle = Object.values(times).reduce((a, b) => a + b, 0);
  const sliding = times.approach + times.flip;

  it('slopes the stairs and the bank down from the deck to the ground', () => {
    expect(stairSlopeHeight(0)).toBe(height);
    expect(stairSlopeHeight(deck)).toBe(height);
    expect(stairSlopeHeight(deck + stairs / 2)).toBeCloseTo(height / 2);
    expect(stairSlopeHeight(deck + stairs)).toBe(0);
    expect(railHeight(deck + stairs)).toBe(rail);
  });

  it('360 flips off the deck onto the handrail', () => {
    const start = railSkaterAt(times.approach);
    expect(start.z).toBe(height);
    expect(start.u).toBeLessThan(deck);
    const pose = railSkaterAt(times.approach + times.flip / 2);
    expect(pose.trick).toBe('360-flip');
    expect(pose.z).toBeGreaterThan(railHeight(pose.u));
  });

  it('clears the handrail all the way onto it, from its front end', () => {
    for (let t = times.approach; t < sliding; t += 0.01) {
      const pose = railSkaterAt(t);
      // The handrail is drawn from just short of the deck's edge, at its top height there.
      if (pose.u < deck - 0.1) continue;
      expect(pose.z).toBeGreaterThanOrEqual(railHeight(Math.max(pose.u, deck)) - 0.5);
    }
  });

  it('has four stairs down from the deck', () => {
    expect(STAIR_SET.steps).toBe(4);
  });

  it('turns the board a quarter during the 360 flip, to land across the rail', () => {
    expect(railSkaterAt(times.approach / 2).boardTurn).toBe(0);
    expect(railSkaterAt(times.approach + times.flip / 2).boardTurn).toBeCloseTo(0.5);
    expect(railSkaterAt(sliding + 0.01).boardTurn).toBe(1);
  });

  it('boardslides down the handrail, with the board across it', () => {
    for (let t = sliding; t < sliding + times.slide; t += 0.1) {
      const pose = railSkaterAt(t);
      expect(pose.trick).toBe('boardslide');
      expect(pose.boardTurn).toBe(1);
      expect(pose.v).toBe(railY);
      expect(pose.u).toBeGreaterThan(deck);
      expect(pose.u).toBeLessThan(deck + stairs);
      expect(pose.z).toBeCloseTo(railHeight(pose.u));
      expect(pose.dir).toBe(1);
    }
    expect(railSkaterAt(sliding + times.slide * 0.9).z).toBeLessThan(railSkaterAt(sliding + 0.1).z);
  });

  it('turns the board back under them as they hop off the rail', () => {
    const hop = sliding + times.slide;
    expect(railSkaterAt(hop + times.hop / 2).boardTurn).toBeCloseTo(0.5);
    expect(railSkaterAt(hop + times.hop + 0.01).boardTurn).toBe(0);
  });

  it('rides back up the bank to the deck', () => {
    const start = sliding + times.slide + times.hop + times.bottomTurn;
    for (let t = start; t < start + times.bank; t += 0.1) {
      const pose = railSkaterAt(t);
      expect(pose.trick).toBeUndefined();
      expect(pose.v).toBe(bankY);
      expect(pose.dir).toBe(-1);
      expect(pose.z).toBeCloseTo(stairSlopeHeight(pose.u));
    }
  });

  it('moves smoothly round the whole run, over and over', () => {
    let last = railSkaterAt(0);
    for (let t = 0.01; t < cycle * 2; t += 0.01) {
      const pose = railSkaterAt(t);
      expect(Math.abs(pose.u - last.u)).toBeLessThan(0.1);
      expect(Math.abs(pose.v - last.v)).toBeLessThan(0.1);
      expect(Math.abs(pose.z - last.z)).toBeLessThan(2);
      expect(Math.abs(pose.boardTurn - last.boardTurn)).toBeLessThan(0.1);
      last = pose;
    }
  });
});

describe('the second quarter pipe skater', () => {
  it('does an indy grab above the lip instead of a kickflip 180', () => {
    const pose = quarterSkaterAt(QUARTER_RIDE + QUARTER_AIR / 2, 'indy-grab');
    expect(pose.trick).toBe('indy-grab');
    expect(pose.z).toBeCloseTo(QUARTER_PIPE.height + QUARTER_PIPE.air);
    expect(quarterSkaterAt(QUARTER_RIDE / 2, 'indy-grab')).toEqual(
      quarterSkaterAt(QUARTER_RIDE / 2),
    );
  });
});

describe('the grind box skaters', () => {
  const { length, start, end, height, turn } = GRIND_BOX;
  const pass = (length - 2 * turn) / BOX_SPEED;
  const cycle = 2 * (pass + BOX_TURN);
  const lines = ['grind', 'manual', 'flat'] as const;

  it('rides three separate lines: the far coping, the top of the box and the flat in front', () => {
    expect(BOX_LINES.grind).toBe(GRIND_BOX.far);
    expect(BOX_LINES.manual).toBeGreaterThan(GRIND_BOX.far);
    expect(BOX_LINES.manual).toBeLessThan(GRIND_BOX.near);
    expect(BOX_LINES.flat).toBeGreaterThan(GRIND_BOX.near);
    expect(BOX_LINES.flat).toBeLessThan(GRIND_BOX.width);
  });

  it('50-50 grinds the coping and manuals the top, both ways along the box', () => {
    for (const line of ['grind', 'manual'] as const) {
      const tricks = new Set<string>();
      const dirs = new Set<number>();
      for (let t = 0; t < cycle; t += 0.01) {
        const pose = boxSkaterAt(t, line);
        if (pose.u > start + 0.01 && pose.u < end - 0.01) {
          // Never through the box: on top of it or above it.
          expect(pose.z).toBeGreaterThanOrEqual(height);
        }
        if (pose.trick === '50-50' || pose.trick === 'manual') {
          tricks.add(pose.trick);
          dirs.add(pose.dir);
          expect(pose.z).toBe(height);
          expect(pose.u).toBeGreaterThanOrEqual(start);
          expect(pose.u).toBeLessThanOrEqual(end);
        }
        if (pose.u < start - 0.9 || pose.u > end + 0.9) expect(pose.z).toBe(0);
      }
      expect([...tricks]).toEqual([line === 'grind' ? '50-50' : 'manual']);
      expect([...dirs].sort()).toEqual([-1, 1]);
    }
  });

  it('ollies up onto the box, clearing its edge', () => {
    const tricks = new Set<string>();
    for (let t = 0; t < cycle; t += 0.01) {
      const pose = boxSkaterAt(t, 'grind');
      if (pose.trick !== 'ollie') continue;
      tricks.add(pose.trick);
      expect(pose.u < start || pose.u > end).toBe(true);
      if (Math.abs(pose.u - start) < 0.15 || Math.abs(pose.u - end) < 0.15) {
        expect(pose.z).toBeGreaterThan(height);
      }
    }
    expect(tricks.has('ollie')).toBe(true);
  });

  it('kickflips along the flat, and pop shove-its on the way back', () => {
    const seen = new Map<string, number>();
    for (let t = 0; t < cycle; t += 0.01) {
      const pose = boxSkaterAt(t, 'flat');
      if (pose.trick) seen.set(pose.trick, pose.dir);
      else expect(pose.z).toBe(0);
    }
    expect(seen.get('kickflip')).toBe(1);
    expect(seen.get('shove-it')).toBe(-1);
  });

  it('kick turns at either end of the flat', () => {
    for (const line of lines) {
      for (let t = 0; t < cycle; t += 0.01) {
        const pose = boxSkaterAt(t, line);
        expect(pose.u).toBeGreaterThanOrEqual(turn - 1e-9);
        expect(pose.u).toBeLessThanOrEqual(length - turn + 1e-9);
      }
    }
  });

  it('moves smoothly round the whole run, over and over', () => {
    for (const line of lines) {
      let last = boxSkaterAt(0, line);
      for (let t = 0.01; t < cycle * 2; t += 0.01) {
        const pose = boxSkaterAt(t, line);
        expect(Math.abs(pose.u - last.u)).toBeLessThan(0.1);
        expect(Math.abs(pose.z - last.z)).toBeLessThan(2);
        last = pose;
      }
    }
  });
});

describe('the skate pool skaters', () => {
  const { length, depth, air } = SKATE_POOL;
  const cycle = 2 * (POOL_RIDE + POOL_AIR);

  it('sinks the bowl below the deck, with a flat floor and a wall at either end', () => {
    expect(poolHeight(0)).toBe(0);
    expect(poolHeight(length)).toBe(0);
    expect(poolHeight(length / 2)).toBe(-depth);
    expect(poolHeight(0.3)).toBeGreaterThan(poolHeight(0.6));
  });

  it('ride the surface of the bowl between the walls', () => {
    for (let t = 0; t < POOL_RIDE; t += 0.1) {
      const pose = poolSkaterAt(t, 'mctwist');
      expect(pose.trick).toBeUndefined();
      expect(pose.u).toBeGreaterThan(0);
      expect(pose.u).toBeLessThan(length);
      expect(pose.z).toBeCloseTo(poolHeight(pose.u));
    }
    expect(poolSkaterAt(POOL_RIDE / 2, 'mctwist').z).toBeCloseTo(-depth);
  });

  it('do their trick in the air above the coping at both ends, and land back in the bowl', () => {
    for (const trick of ['mctwist', 'method'] as const) {
      const right = poolSkaterAt(POOL_RIDE + POOL_AIR / 2, trick);
      expect(right.trick).toBe(trick);
      expect(right.u).toBeGreaterThan(length / 2);
      expect(right.z).toBeCloseTo(air);
      const left = poolSkaterAt(cycle - POOL_AIR / 2, trick);
      expect(left.trick).toBe(trick);
      expect(left.u).toBeLessThan(length / 2);
      // Landed, and riding back down into the bowl the other way.
      const landed = poolSkaterAt(POOL_RIDE + POOL_AIR + 0.3, trick);
      expect(landed.trick).toBeUndefined();
      expect(landed.dir).toBe(-1);
      expect(landed.z).toBeLessThan(0);
    }
  });

  it('ride two separate lanes across the bowl', () => {
    expect(POOL_LANES).toHaveLength(2);
    expect(POOL_LANES[0]).not.toBe(POOL_LANES[1]);
    for (const lane of POOL_LANES) {
      expect(lane).toBeGreaterThan(0);
      expect(lane).toBeLessThan(SKATE_POOL.width);
    }
  });

  it('move smoothly round the whole run, over and over', () => {
    let last = poolSkaterAt(0, 'method');
    for (let t = 0.01; t < cycle * 2; t += 0.01) {
      const pose = poolSkaterAt(t, 'method');
      expect(Math.abs(pose.u - last.u)).toBeLessThan(0.1);
      expect(Math.abs(pose.z - last.z)).toBeLessThan(2);
      last = pose;
    }
  });
});
