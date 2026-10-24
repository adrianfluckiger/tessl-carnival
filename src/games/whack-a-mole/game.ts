import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

/** Seconds in a round. */
export const ROUND_TIME = 30;
export const POINTS_PER_WHACK = 10;
export const COLUMNS = 3;
export const ROWS = 3;
export const HOLE_RADIUS = 46;
/** How close to a hole's centre, in pixels, a click has to land to whack its mole. */
export const HIT_RADIUS = 50;
// At the start of the round a mole pops up every second and stays up for 1.2 s.
// By the end it is every 0.4 s and 0.6 s.
const POP_EVERY = { start: 1, end: 0.4 };
const UP_FOR = { start: 1.2, end: 0.6 };
const BONK_TIME = 0.3;

export interface Hole {
  x: number;
  y: number;
  /** Seconds the mole in this hole has left above ground; 0 means it is down. */
  upFor: number;
}

export interface Bonk {
  x: number;
  y: number;
  age: number;
}

export interface WhackAMoleState {
  holes: Hole[];
  bonks: Bonk[];
  score: number;
  /** Seconds since the round started. */
  time: number;
  /** Seconds until the next mole pops up. */
  nextPop: number;
  phase: 'playing' | 'over';
}

export function createState(): WhackAMoleState {
  const spacingX = 200;
  const spacingY = 120;
  const left = WIDTH / 2 - spacingX;
  const top = 130;
  const holes = Array.from({ length: ROWS * COLUMNS }, (_, i) => ({
    x: left + spacingX * (i % COLUMNS),
    y: top + spacingY * Math.floor(i / COLUMNS),
    upFor: 0,
  }));
  return { holes, bonks: [], score: 0, time: 0, nextPop: POP_EVERY.start, phase: 'playing' };
}

/** How far through the round we are, from 0 to 1. */
function progress(state: WhackAMoleState): number {
  return Math.min(state.time / ROUND_TIME, 1);
}

/** Seconds between pops at this point in the round. Shrinks as the round goes on. */
export function popInterval(state: WhackAMoleState): number {
  return POP_EVERY.start + (POP_EVERY.end - POP_EVERY.start) * progress(state);
}

/** Seconds a mole stays up at this point in the round. Shrinks as the round goes on. */
export function upTime(state: WhackAMoleState): number {
  return UP_FOR.start + (UP_FOR.end - UP_FOR.start) * progress(state);
}

export function timeLeft(state: WhackAMoleState): number {
  return Math.max(ROUND_TIME - state.time, 0);
}

/**
 * Pops a mole up from an empty hole, picked with `random` (0 to 1).
 * Returns the hole, or undefined if every hole already has a mole up.
 */
export function popMole(
  state: WhackAMoleState,
  random: () => number = Math.random,
): Hole | undefined {
  const empty = state.holes.filter((h) => h.upFor === 0);
  if (empty.length === 0) return undefined;
  const hole = empty[Math.min(Math.floor(random() * empty.length), empty.length - 1)];
  hole.upFor = upTime(state);
  return hole;
}

/** Whacks at (x, y). Returns true and scores if a mole was up there. */
export function whack(state: WhackAMoleState, x: number, y: number): boolean {
  if (state.phase !== 'playing') return false;
  const hole = state.holes.find(
    (h) => h.upFor > 0 && Math.hypot(x - h.x, y - (h.y - HOLE_RADIUS * 0.6)) <= HIT_RADIUS,
  );
  if (!hole) return false;
  hole.upFor = 0;
  state.score += POINTS_PER_WHACK;
  state.bonks.push({ x: hole.x, y: hole.y - HOLE_RADIUS * 0.6, age: 0 });
  return true;
}

/** Advances the game by `dt` seconds. */
export function step(state: WhackAMoleState, dt: number, random: () => number = Math.random): void {
  for (const bonk of state.bonks) bonk.age += dt;
  state.bonks = state.bonks.filter((b) => b.age < BONK_TIME);

  if (state.phase !== 'playing') return;

  state.time = Math.min(state.time + dt, ROUND_TIME);
  for (const hole of state.holes) hole.upFor = Math.max(hole.upFor - dt, 0);

  if (state.time >= ROUND_TIME) {
    for (const hole of state.holes) hole.upFor = 0;
    state.phase = 'over';
    return;
  }

  state.nextPop -= dt;
  if (state.nextPop <= 0) {
    popMole(state, random);
    state.nextPop = popInterval(state);
  }
}

function draw(ctx: CanvasRenderingContext2D, state: WhackAMoleState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // The board the holes are cut into.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(120, 60, WIDTH - 240, 380);

  for (const hole of state.holes) {
    if (hole.upFor > 0) {
      // The mole's head, poking up out of the hole.
      const headY = hole.y - HOLE_RADIUS * 0.6;
      ctx.fillStyle = colors.muted;
      ctx.beginPath();
      ctx.arc(hole.x, headY, HOLE_RADIUS * 0.7, Math.PI, 0);
      ctx.lineTo(hole.x + HOLE_RADIUS * 0.7, hole.y);
      ctx.lineTo(hole.x - HOLE_RADIUS * 0.7, hole.y);
      ctx.fill();
      ctx.fillStyle = colors.background;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(hole.x + side * 10, headY - 6, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = colors.stripeA;
      ctx.beginPath();
      ctx.arc(hole.x, headY + 6, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // The front lip of the hole, drawn over the mole's body.
    ctx.fillStyle = colors.surface;
    ctx.beginPath();
    ctx.ellipse(hole.x, hole.y, HOLE_RADIUS, HOLE_RADIUS * 0.35, 0, 0, Math.PI);
    ctx.fill();
  }

  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 4;
  for (const bonk of state.bonks) {
    ctx.globalAlpha = 1 - bonk.age / BONK_TIME;
    ctx.beginPath();
    ctx.arc(bonk.x, bonk.y, 20 + bonk.age * 100, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Time ${Math.ceil(timeLeft(state))}s`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Time's up! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const whackAMole: CarnivalGame = {
  id: 'whack-a-mole',
  name: 'Whack-a-Mole',
  description: 'Whack the moles before they duck back down. They pop up faster as time runs out.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const onDown = (event: PointerEvent) => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      whack(
        state,
        ((event.clientX - rect.left) / rect.width) * WIDTH,
        ((event.clientY - rect.top) / rect.height) * HEIGHT,
      );
    };
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(whackAMole.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};

export default whackAMole;
