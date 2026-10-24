# Ring Toss

Land rings on the necks of the bottles at the back of the booth.

## How to play

- Move the mouse to aim, and click to throw a ring at the cross-hair.
- The cross-hair sways around the mouse, so time your throw as well as your aim.
- You have 8 rings. The round ends when the last ring has landed.
- Click again on the game over screen to play another round.

## Scoring

A ring scores when it lands on a bottle neck. Each bottle holds one ring, so a
second ring on a ringed bottle misses. Bottles further back have thinner necks
and score more. A ring has to land within this distance of the neck:

| Row    | Within | Points |
| ------ | ------ | ------ |
| Back   | 12 px  | 30     |
| Middle | 15 px  | 20     |
| Front  | 18 px  | 10     |

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `toss`, `step`, `aimPoint`, `bottleAt`)
  and the `ringToss` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
