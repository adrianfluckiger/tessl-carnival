import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const CASTS_PER_ROUND = 6;
/** Seconds the hook takes to drop to the water. */
export const DROP_TIME = 0.4;
/** How close to a duck, in pixels, the hook has to land to catch it. */
export const REACH = 22;
/** How fast the ducks float round the stream, in radians per second. */
export const DRIFT_SPEED = 0.5;
/** The stream is an oval loop the ducks float round. */
export const STREAM = { x: WIDTH / 2, y: 270, radiusX: 300, radiusY: 130 } as const;
/** Where the rod hangs from. */
export const ROD_TIP_Y = 50;
// The number on each duck's base. Most ducks are worth a little, a few a lot.
const DUCK_POINTS = [5, 10, 5, 20, 5, 10, 50, 5, 10, 20, 5, 10];

export interface Duck {
  /** Where the duck is round the loop, in radians. */
  angle: number;
  points: number;
  caught: boolean;
}

export interface Cast {
  x: number;
  y: number;
  /** Seconds since the hook was lowered. */
  age: number;
}

export interface Catch {
  x: number;
  y: number;
  /** The points on the duck, or 0 for a miss. */
  points: number;
  age: number;
}

export interface HookADuckState {
  ducks: Duck[];
  cast: Cast | null;
  catches: Catch[];
  castsLeft: number;
  score: number;
  phase: 'playing' | 'over';
}

export function createState(): HookADuckState {
  const ducks = DUCK_POINTS.map((points, i) => ({
    angle: (i / DUCK_POINTS.length) * Math.PI * 2,
    points,
    caught: false,
  }));
  return { ducks, cast: null, catches: [], castsLeft: CASTS_PER_ROUND, score: 0, phase: 'playing' };
}

/** Where a duck is on the stream. */
export function duckPosition(duck: Duck): { x: number; y: number } {
  return {
    x: STREAM.x + Math.cos(duck.angle) * STREAM.radiusX,
    y: STREAM.y + Math.sin(duck.angle) * STREAM.radiusY,
  };
}

/** The nearest uncaught duck within reach of (x, y), if any. */
export function duckAt(state: HookADuckState, x: number, y: number): Duck | undefined {
  let nearest: Duck | undefined;
  let nearestDistance = REACH;
  for (const duck of state.ducks) {
    if (duck.caught) continue;
    const pos = duckPosition(duck);
    const distance = Math.hypot(x - pos.x, y - pos.y);
    if (distance <= nearestDistance) {
      nearest = duck;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/** Lowers the hook at (x, y). Returns false if nothing was cast. */
export function lowerHook(state: HookADuckState, x: number, y: number): boolean {
  if (state.phase !== 'playing' || state.castsLeft === 0 || state.cast) return false;
  state.cast = { x, y, age: 0 };
  state.castsLeft -= 1;
  return true;
}

/** How far down the hook is, from 0 at the rod tip to 1 at the water. */
export function hookDepth(cast: Cast): number {
  return Math.min(cast.age / DROP_TIME, 1);
}

/** Advances the game by `dt` seconds. */
export function step(state: HookADuckState, dt: number): void {
  for (const duck of state.ducks) {
    duck.angle = (duck.angle + DRIFT_SPEED * dt) % (Math.PI * 2);
  }

  if (state.cast) {
    state.cast.age += dt;
    if (state.cast.age >= DROP_TIME) {
      const { x, y } = state.cast;
      const duck = duckAt(state, x, y);
      if (duck) {
        duck.caught = true;
        state.score += duck.points;
      }
      state.catches.push({ x, y, points: duck ? duck.points : 0, age: 0 });
      state.cast = null;
    }
  }

  for (const c of state.catches) c.age += dt;
  state.catches = state.catches.filter((c) => c.age < 1);

  if (state.castsLeft === 0 && !state.cast) state.phase = 'over';
}

function drawDuck(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const { colors } = theme;
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.ellipse(x, y, 18, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 12, y - 12, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.danger;
  ctx.beginPath();
  ctx.moveTo(x + 19, y - 14);
  ctx.lineTo(x + 27, y - 11);
  ctx.lineTo(x + 19, y - 9);
  ctx.fill();
  ctx.fillStyle = colors.background;
  ctx.beginPath();
  ctx.arc(x + 14, y - 14, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

function draw(
  ctx: CanvasRenderingContext2D,
  state: HookADuckState,
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

  // The stream: a ring of water round a wooden island.
  ctx.fillStyle = colors.water;
  ctx.beginPath();
  ctx.ellipse(STREAM.x, STREAM.y, STREAM.radiusX + 40, STREAM.radiusY + 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.wood;
  ctx.beginPath();
  ctx.ellipse(STREAM.x, STREAM.y, STREAM.radiusX - 40, STREAM.radiusY - 40, 0, 0, Math.PI * 2);
  ctx.fill();

  // Back of the loop first, so nearer ducks draw on top.
  const floating = state.ducks
    .filter((d) => !d.caught)
    .map(duckPosition)
    .sort((a, b) => a.y - b.y);
  for (const pos of floating) drawDuck(ctx, pos.x, pos.y);

  // The rod, its line and the hook.
  const hook = state.cast
    ? {
        x: state.cast.x,
        y: ROD_TIP_Y + (state.cast.y - ROD_TIP_Y) * hookDepth(state.cast),
        target: state.cast,
      }
    : state.phase === 'playing'
      ? { x: pointer.x, y: ROD_TIP_Y + 30, target: pointer }
      : null;
  if (hook) {
    ctx.strokeStyle = colors.wood;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2, HEIGHT);
    ctx.lineTo(hook.x, ROD_TIP_Y);
    ctx.stroke();

    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hook.x, ROD_TIP_Y);
    ctx.lineTo(hook.x, hook.y);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hook.x, hook.y + 6, 6, Math.PI * 0.1, Math.PI);
    ctx.stroke();

    // Where the hook will land.
    ctx.strokeStyle = colors.text;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hook.target.x, hook.target.y, REACH, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = 'center';
  ctx.font = canvasFont('body', 'bold');
  for (const c of state.catches) {
    ctx.globalAlpha = 1 - c.age;
    ctx.fillStyle = c.points > 0 ? colors.accent : colors.danger;
    ctx.fillText(c.points > 0 ? `+${c.points}` : 'Missed', c.x, c.y - 30 - c.age * 30);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Casts ${state.castsLeft}/${CASTS_PER_ROUND}`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Out of casts! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const hookADuck: CarnivalGame = {
  id: 'hook-a-duck',
  name: 'Hook a Duck',
  description:
    'Lower the hook to catch a rubber duck as it floats past. Each duck scores the number on its base.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const pointer = { x: WIDTH / 2, y: STREAM.y + STREAM.radiusY };

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
        lowerHook(state, pointer.x, pointer.y);
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
        recordScore(hookADuck.id, state.score);
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

export default hookADuck;
