import { describe, expect, it } from 'vitest';
import {
  FLIGHT_TIME,
  RINGS_PER_ROUND,
  SWAY,
  THROWER,
  aimPoint,
  bottleAt,
  createState,
  ringPosition,
  step,
  swayOffset,
  toss,
  type RingTossState,
} from './game';

/** Throws a ring that lands exactly on (x, y), ignoring the sway. */
function landAt(state: RingTossState, x: number, y: number) {
  state.rings.push({ fromX: THROWER.x, fromY: THROWER.y, toX: x, toY: y, age: 0 });
  step(state, FLIGHT_TIME);
}

describe('ring toss', () => {
  it('starts with a full set of rings, a grid of bottles and no score', () => {
    const state = createState();
    expect(state.ringsLeft).toBe(RINGS_PER_ROUND);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
    expect(state.bottles).toHaveLength(15);
    expect(state.bottles.every((b) => !b.ringed)).toBe(true);
  });

  it('uses one ring per toss', () => {
    const state = createState();
    expect(toss(state, 400, 190)).toBe(true);
    expect(state.ringsLeft).toBe(RINGS_PER_ROUND - 1);
    expect(state.rings).toHaveLength(1);
  });

  it('cannot toss once the rings run out', () => {
    const state = createState();
    state.ringsLeft = 0;
    expect(toss(state, 400, 190)).toBe(false);
    expect(state.rings).toHaveLength(0);
  });

  it('lands the ring where the swaying aim pointed when it was thrown', () => {
    const state = createState();
    state.time = 1.2;
    const aim = aimPoint(state, 400, 190);
    toss(state, 400, 190);
    expect(state.rings[0].toX).toBeCloseTo(aim.x);
    expect(state.rings[0].toY).toBeCloseTo(aim.y);
  });

  it('keeps the sway within its limit', () => {
    for (let t = 0; t < 10; t += 0.1) {
      const sway = swayOffset(t);
      expect(Math.abs(sway.x)).toBeLessThanOrEqual(SWAY);
      expect(Math.abs(sway.y)).toBeLessThanOrEqual(SWAY);
    }
  });

  it('scores a ring that lands on a bottle neck', () => {
    const state = createState();
    const bottle = state.bottles[0];
    landAt(state, bottle.x + bottle.neck - 1, bottle.y);
    expect(state.score).toBe(bottle.points);
    expect(bottle.ringed).toBe(true);
    expect(state.rings).toHaveLength(0);
  });

  it('scores nothing for a ring that misses', () => {
    const state = createState();
    landAt(state, 10, 450);
    expect(state.score).toBe(0);
    expect(state.misses).toHaveLength(1);
  });

  it('scores nothing while the ring is still in the air', () => {
    const state = createState();
    const bottle = state.bottles[0];
    state.rings.push({ fromX: THROWER.x, fromY: THROWER.y, toX: bottle.x, toY: bottle.y, age: 0 });
    step(state, FLIGHT_TIME / 2);
    expect(state.score).toBe(0);
    expect(state.rings).toHaveLength(1);
  });

  it('lets each bottle hold only one ring', () => {
    const state = createState();
    const bottle = state.bottles[0];
    landAt(state, bottle.x, bottle.y);
    landAt(state, bottle.x, bottle.y);
    expect(state.score).toBe(bottle.points);
    expect(bottleAt(state, bottle.x, bottle.y)).toBeUndefined();
  });

  it('scores bottles further back higher', () => {
    const state = createState();
    const back = state.bottles.reduce((a, b) => (b.y < a.y ? b : a));
    const front = state.bottles.reduce((a, b) => (b.y > a.y ? b : a));
    expect(back.points).toBeGreaterThan(front.points);
  });

  it('ends the round when the rings run out and the last ring has landed', () => {
    const state = createState();
    state.ringsLeft = 0;
    landAt(state, 10, 450);
    expect(state.phase).toBe('over');
  });

  it('keeps playing while a ring is still in the air', () => {
    const state = createState();
    toss(state, 400, 190);
    state.ringsLeft = 0;
    step(state, FLIGHT_TIME / 2);
    expect(state.phase).toBe('playing');
  });

  it('flies from the thrower to where the ring lands', () => {
    const ring = { fromX: 400, fromY: 470, toX: 300, toY: 120, age: 0 };
    expect(ringPosition(ring)).toEqual({ x: 400, y: 470 });
    const landed = ringPosition({ ...ring, age: FLIGHT_TIME });
    expect(landed.x).toBeCloseTo(300);
    expect(landed.y).toBeCloseTo(120);
  });
});
