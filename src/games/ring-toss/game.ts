import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const RINGS_PER_ROUND = 8;
/** Seconds a ring spends in the air. */
export const FLIGHT_TIME = 0.5;
export const THROWER = { x: WIDTH / 2, y: HEIGHT - 30 } as const;
/** How far the aim sways from the pointer, in pixels. */
export const SWAY = 18;
const COLUMNS = 5;
// Back row first: further back is smaller, harder to ring and worth more.
const ROWS = [
  { y: 120, neck: 12, points: 30 },
  { y: 190, neck: 15, points: 20 },
  { y: 260, neck: 18, points: 10 },
];

export interface Bottle {
  x: number;
  y: number;
  /** How close to the neck, in pixels, a ring has to land to score. */
  neck: number;
  points: number;
  ringed: boolean;
}

export interface Ring {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Seconds since the throw. */
  age: number;
}

export interface Miss {
  x: number;
  y: number;
  age: number;
}

export interface RingTossState {
  bottles: Bottle[];
  rings: Ring[];
  misses: Miss[];
  ringsLeft: number;
  score: number;
  /** Seconds since the round started; drives the sway. */
  time: number;
  phase: 'playing' | 'over';
}

export function createState(): RingTossState {
  const spacing = 90;
  const left = WIDTH / 2 - (spacing * (COLUMNS - 1)) / 2;
  const bottles = ROWS.flatMap((row) =>
    Array.from({ length: COLUMNS }, (_, i) => ({
      x: left + spacing * i,
      y: row.y,
      neck: row.neck,
      points: row.points,
      ringed: false,
    })),
  );
  return {
    bottles,
    rings: [],
    misses: [],
    ringsLeft: RINGS_PER_ROUND,
    score: 0,
    time: 0,
    phase: 'playing',
  };
}

/** The aim wobbles around the pointer, so a throw takes timing as well as aim. */
export function swayOffset(time: number): { x: number; y: number } {
  return { x: Math.sin(time * 2.3) * SWAY, y: Math.sin(time * 3.1) * SWAY * 0.5 };
}

/** Where a ring thrown now at the pointer would land. */
export function aimPoint(state: RingTossState, pointerX: number, pointerY: number) {
  const sway = swayOffset(state.time);
  return { x: pointerX + sway.x, y: pointerY + sway.y };
}

/** The bottle a ring landing at (x, y) rings, if any. A bottle holds one ring. */
export function bottleAt(state: RingTossState, x: number, y: number): Bottle | undefined {
  return state.bottles.find((b) => !b.ringed && Math.hypot(x - b.x, y - b.y) <= b.neck);
}

/** Throws one ring at the pointer. Returns false if nothing was thrown. */
export function toss(state: RingTossState, pointerX: number, pointerY: number): boolean {
  if (state.phase !== 'playing' || state.ringsLeft === 0) return false;
  const target = aimPoint(state, pointerX, pointerY);
  state.rings.push({ fromX: THROWER.x, fromY: THROWER.y, toX: target.x, toY: target.y, age: 0 });
  state.ringsLeft -= 1;
  return true;
}

/** Where a ring is in its flight, with a little arc. */
export function ringPosition(ring: Ring): { x: number; y: number } {
  const t = Math.min(ring.age / FLIGHT_TIME, 1);
  return {
    x: ring.fromX + (ring.toX - ring.fromX) * t,
    y: ring.fromY + (ring.toY - ring.fromY) * t - Math.sin(t * Math.PI) * 60,
  };
}

/** Advances the game by `dt` seconds. */
export function step(state: RingTossState, dt: number): void {
  state.time += dt;

  const flying: Ring[] = [];
  for (const ring of state.rings) {
    ring.age += dt;
    if (ring.age < FLIGHT_TIME) {
      flying.push(ring);
      continue;
    }
    const bottle = bottleAt(state, ring.toX, ring.toY);
    if (bottle) {
      bottle.ringed = true;
      state.score += bottle.points;
    } else {
      state.misses.push({ x: ring.toX, y: ring.toY, age: 0 });
    }
  }
  state.rings = flying;

  for (const miss of state.misses) miss.age += dt;
  state.misses = state.misses.filter((m) => m.age < 0.6);

  if (state.ringsLeft === 0 && state.rings.length === 0) state.phase = 'over';
}

function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, radius, radius * 0.45, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function draw(
  ctx: CanvasRenderingContext2D,
  state: RingTossState,
  pointer: { x: number; y: number },
) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // The table the bottles stand on.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(140, 90, WIDTH - 280, 200);

  for (const bottle of state.bottles) {
    const bodyWidth = bottle.neck * 1.6;
    const neckWidth = bottle.neck * 0.6;
    ctx.fillStyle = colors.water;
    ctx.fillRect(bottle.x - bodyWidth / 2, bottle.y, bodyWidth, bottle.neck * 2.6);
    ctx.fillRect(
      bottle.x - neckWidth / 2,
      bottle.y - bottle.neck * 1.3,
      neckWidth,
      bottle.neck * 1.3,
    );
    if (bottle.ringed) {
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 4;
      drawRing(ctx, bottle.x, bottle.y, bottle.neck);
    }
  }

  ctx.strokeStyle = colors.danger;
  ctx.lineWidth = 3;
  for (const miss of state.misses) {
    ctx.globalAlpha = 1 - miss.age / 0.6;
    drawRing(ctx, miss.x, miss.y, 18);
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 4;
  for (const ring of state.rings) {
    const { x, y } = ringPosition(ring);
    drawRing(ctx, x, y, 18);
  }

  // The swaying aim.
  if (state.phase === 'playing' && state.ringsLeft > 0) {
    const aim = aimPoint(state, pointer.x, pointer.y);
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(aim.x - 8, aim.y);
    ctx.lineTo(aim.x + 8, aim.y);
    ctx.moveTo(aim.x, aim.y - 8);
    ctx.lineTo(aim.x, aim.y + 8);
    ctx.stroke();
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Rings ${state.ringsLeft}/${RINGS_PER_ROUND}`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Out of rings! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const ringToss: CarnivalGame = {
  id: 'ring-toss',
  name: 'Ring Toss',
  description:
    'Land rings on the bottle necks before you run out. Bottles further back score more.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const pointer = { x: WIDTH / 2, y: 190 };

    const toCanvas = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
      };
    };
    const onMove = (event: PointerEvent) => Object.assign(pointer, toCanvas(event));
    const onDown = (event: PointerEvent) => {
      Object.assign(pointer, toCanvas(event));
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        toss(state, pointer.x, pointer.y);
      }
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(ringToss.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state, pointer);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};

export default ringToss;
