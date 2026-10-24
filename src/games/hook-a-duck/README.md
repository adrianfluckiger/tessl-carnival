# Hook a Duck

Rubber ducks float round a stream. Lower the hook to catch one as it passes.

## How to play

- Move the mouse to aim the hook. The circle shows where it will land.
- Click to lower the hook. It takes 0.4 seconds to reach the water, and the
  ducks keep floating while it drops, so aim a little ahead of the duck you want.
- One hook goes down at a time. You have 6 casts, and the round ends when the
  last hook has reached the water.
- Click again on the game over screen to play another round.

## Scoring

A hook catches a duck when it reaches the water within 22 px of that duck. If
more than one duck is in reach, it catches the nearest. Each duck scores the
number on its base, and a caught duck leaves the stream. A hook that catches
nothing scores 0.

The stream holds 12 ducks:

| Number on the base | Ducks |
| ------------------ | ----- |
| 5                  | 5     |
| 10                 | 4     |
| 20                 | 2     |
| 50                 | 1     |

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `lowerHook`, `step`, `duckPosition`,
  `duckAt`) and the `hookADuck` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
