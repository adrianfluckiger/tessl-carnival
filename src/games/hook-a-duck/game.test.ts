import { describe, expect, it } from 'vitest';
import {
  CASTS_PER_ROUND,
  DRIFT_SPEED,
  DROP_TIME,
  REACH,
  createState,
  duckAt,
  duckPosition,
  hookDepth,
  lowerHook,
  step,
  type Duck,
  type HookADuckState,
} from './game';

/** Where a duck will be once a hook lowered now reaches the water. */
function whereAfterDrop(duck: Duck) {
  return duckPosition({ ...duck, angle: duck.angle + DRIFT_SPEED * DROP_TIME });
}

/** Lowers the hook at (x, y) and lets it reach the water. */
function castAt(state: HookADuckState, x: number, y: number) {
  lowerHook(state, x, y);
  step(state, DROP_TIME);
}

describe('hook a duck', () => {
  it('starts with a full set of casts, a stream of ducks and no score', () => {
    const state = createState();
    expect(state.castsLeft).toBe(CASTS_PER_ROUND);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
    expect(state.ducks.length).toBeGreaterThan(0);
    expect(state.ducks.every((d) => !d.caught && d.points > 0)).toBe(true);
  });

  it('floats the ducks round the stream', () => {
    const state = createState();
    const before = duckPosition(state.ducks[0]);
    step(state, 1);
    expect(duckPosition(state.ducks[0])).not.toEqual(before);
  });

  it('brings a duck back round to where it started', () => {
    const state = createState();
    const before = duckPosition(state.ducks[0]);
    step(state, (Math.PI * 2) / DRIFT_SPEED);
    const after = duckPosition(state.ducks[0]);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('uses one cast per lowered hook', () => {
    const state = createState();
    expect(lowerHook(state, 400, 400)).toBe(true);
    expect(state.castsLeft).toBe(CASTS_PER_ROUND - 1);
    expect(state.cast).not.toBeNull();
  });

  it('cannot lower a second hook while one is on its way down', () => {
    const state = createState();
    lowerHook(state, 400, 400);
    expect(lowerHook(state, 300, 300)).toBe(false);
    expect(state.castsLeft).toBe(CASTS_PER_ROUND - 1);
  });

  it('cannot cast once the casts run out', () => {
    const state = createState();
    state.castsLeft = 0;
    expect(lowerHook(state, 400, 400)).toBe(false);
    expect(state.cast).toBeNull();
  });

  it('catches the duck under the hook when it reaches the water, scoring its number', () => {
    const state = createState();
    const duck = state.ducks[3];
    const target = whereAfterDrop(duck);
    castAt(state, target.x + REACH - 1, target.y);
    expect(duck.caught).toBe(true);
    expect(state.score).toBe(duck.points);
    expect(state.cast).toBeNull();
  });

  it('misses a duck that has floated on by the time the hook lands', () => {
    const state = createState();
    const duck = state.ducks[3];
    const now = duckPosition(duck);
    const later = whereAfterDrop(duck);
    expect(Math.hypot(now.x - later.x, now.y - later.y)).toBeGreaterThan(REACH);
    castAt(state, now.x, now.y);
    expect(duck.caught).toBe(false);
  });

  it('scores nothing for a hook that lands in empty water', () => {
    const state = createState();
    castAt(state, 400, 270);
    expect(state.score).toBe(0);
    expect(state.catches).toEqual([expect.objectContaining({ points: 0 })]);
  });

  it('scores nothing while the hook is still on its way down', () => {
    const state = createState();
    const target = whereAfterDrop(state.ducks[0]);
    lowerHook(state, target.x, target.y);
    step(state, DROP_TIME / 2);
    expect(state.score).toBe(0);
    expect(hookDepth(state.cast!)).toBeCloseTo(0.5);
  });

  it('takes a caught duck out of the stream', () => {
    const state = createState();
    const duck = state.ducks[0];
    const target = whereAfterDrop(duck);
    castAt(state, target.x, target.y);
    const pos = duckPosition(duck);
    expect(duckAt(state, pos.x, pos.y)).not.toBe(duck);
  });

  it('ends the round when the casts run out and the last hook has landed', () => {
    const state = createState();
    for (let i = 0; i < CASTS_PER_ROUND; i++) {
      expect(state.phase).toBe('playing');
      castAt(state, 400, 270);
    }
    expect(state.phase).toBe('over');
    expect(lowerHook(state, 400, 270)).toBe(false);
  });

  it('keeps playing while the last hook is on its way down', () => {
    const state = createState();
    state.castsLeft = 1;
    lowerHook(state, 400, 270);
    step(state, DROP_TIME / 2);
    expect(state.phase).toBe('playing');
  });
});
