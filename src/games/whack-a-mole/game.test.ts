import { describe, expect, it } from 'vitest';
import {
  COLUMNS,
  HOLE_RADIUS,
  POINTS_PER_WHACK,
  ROUND_TIME,
  ROWS,
  createState,
  popInterval,
  popMole,
  step,
  timeLeft,
  upTime,
  whack,
  type Hole,
} from './game';

/** Where to click to hit the mole in this hole. */
function headOf(hole: Hole) {
  return { x: hole.x, y: hole.y - HOLE_RADIUS * 0.6 };
}

describe('whack-a-mole', () => {
  it('starts with a grid of empty holes, no score and the full round ahead', () => {
    const state = createState();
    expect(state.holes).toHaveLength(ROWS * COLUMNS);
    expect(state.holes.every((h) => h.upFor === 0)).toBe(true);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
    expect(timeLeft(state)).toBe(ROUND_TIME);
  });

  it('pops a mole up from an empty hole', () => {
    const state = createState();
    const hole = popMole(state, () => 0);
    expect(hole).toBe(state.holes[0]);
    expect(hole?.upFor).toBe(upTime(state));
    // The next pop with the same pick skips the hole that is already up.
    expect(popMole(state, () => 0)).toBe(state.holes[1]);
  });

  it('pops nothing when every hole already has a mole up', () => {
    const state = createState();
    for (const hole of state.holes) hole.upFor = 1;
    expect(popMole(state, () => 0.5)).toBeUndefined();
  });

  it('pops moles up as time passes', () => {
    const state = createState();
    step(state, popInterval(state), () => 0);
    expect(state.holes.filter((h) => h.upFor > 0)).toHaveLength(1);
  });

  it('drops a mole back down once its time is up', () => {
    const state = createState();
    const hole = popMole(state, () => 0)!;
    state.nextPop = 100;
    step(state, hole.upFor);
    expect(hole.upFor).toBe(0);
  });

  it('scores for whacking a mole that is up, and sends it back down', () => {
    const state = createState();
    const hole = popMole(state, () => 0)!;
    const { x, y } = headOf(hole);
    expect(whack(state, x, y)).toBe(true);
    expect(state.score).toBe(POINTS_PER_WHACK);
    expect(hole.upFor).toBe(0);
    // The same mole cannot be whacked twice.
    expect(whack(state, x, y)).toBe(false);
    expect(state.score).toBe(POINTS_PER_WHACK);
  });

  it('scores nothing for whacking an empty hole or the board', () => {
    const state = createState();
    const { x, y } = headOf(state.holes[4]);
    expect(whack(state, x, y)).toBe(false);
    popMole(state, () => 0);
    expect(whack(state, x, y)).toBe(false);
    expect(state.score).toBe(0);
  });

  it('only scores for a click on the mole itself, not the board below it', () => {
    const state = createState();
    const hole = popMole(state, () => 0)!;
    // Below the hole's front lip: close to the head, but not on the mole.
    expect(whack(state, hole.x, hole.y + 20)).toBe(false);
    // On the lip just below the hole line, still inside the head's circle.
    expect(whack(state, hole.x, hole.y + 3)).toBe(false);
    // Beside the mole's body.
    expect(whack(state, hole.x + HOLE_RADIUS * 0.8, hole.y - 5)).toBe(false);
    expect(state.score).toBe(0);
    // The mole's body, just above the hole.
    expect(whack(state, hole.x, hole.y - 5)).toBe(true);
    expect(state.score).toBe(POINTS_PER_WHACK);
  });

  it('pops moles faster and for less time as the round goes on', () => {
    const state = createState();
    const early = { every: popInterval(state), up: upTime(state) };
    state.time = ROUND_TIME * 0.9;
    expect(popInterval(state)).toBeLessThan(early.every);
    expect(upTime(state)).toBeLessThan(early.up);
  });

  it('ends the round after a fixed time, with every mole down', () => {
    const state = createState();
    for (let t = 0; t < ROUND_TIME + 1; t += 0.05) step(state, 0.05, () => 0.5);
    expect(state.phase).toBe('over');
    expect(timeLeft(state)).toBe(0);
    expect(state.holes.every((h) => h.upFor === 0)).toBe(true);
  });

  it('cannot whack once the round is over', () => {
    const state = createState();
    const hole = popMole(state, () => 0)!;
    state.phase = 'over';
    const { x, y } = headOf(hole);
    expect(whack(state, x, y)).toBe(false);
    expect(state.score).toBe(0);
  });
});
