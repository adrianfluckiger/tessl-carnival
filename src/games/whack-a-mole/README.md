# Whack-a-Mole

Whack the moles as they pop up out of the board, before they duck back down.

## How to play

- Moles pop up from a grid of 9 holes, stay up for a moment, then drop back down.
- Click a mole while it's up to whack it.
- At the start a mole pops up every second and stays up for 1.2 seconds. By the
  end of the round one pops up every 0.4 seconds and stays up for 0.6 seconds.
- A round lasts 30 seconds.
- Click again on the game over screen to play another round.

## Scoring

Every mole you whack scores 10 points. Clicking an empty hole or the board
scores nothing and costs nothing.

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `step`, `popMole`, `whack`,
  `popInterval`, `upTime`, `timeLeft`) and the `whackAMole` entry, the default
  export the midway finds.
- `game.test.ts`: tests for the game logic.
