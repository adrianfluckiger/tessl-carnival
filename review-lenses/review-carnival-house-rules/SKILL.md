---
name: review-carnival-house-rules
description: Review a change to a carnival game for house rules 1 to 3 in AGENTS.md, that every game registers on the midway, reports scores through recordScore from src/carnival, and draws with theme and canvasFont. Use as one lens in a code review run.
---

# Review lens: Carnival House Rules

Review changes under `src/games/` for whether each game fits the shared carnival: the midway finds it, the shared scores module records its rounds, and the theme decides how it looks.

## Scope

- **Registration** Whether a game can reach the midway: it lives in `src/games/<game-id>/`, its `game.ts` has its `CarnivalGame` as the default export, and its `id` matches its folder name.
- **Scores** Whether a round's score reaches the shared scores module: the game calls `recordScore(game.id, score)` from `src/carnival` once when a round ends, and never reads or writes local storage itself or keeps its own high score table.
- **Theme** Whether the game draws with the carnival's look: colours, fonts and sizes come from `theme` and `canvasFont` in `src/carnival/theme.ts`, not from hex colours, `rgb()` strings, named colours or font strings written inside the game.

## Method

Read house rules 1 to 3 in `AGENTS.md`, then `src/carnival/index.ts` for what the shared base exports, and `src/games/water-cannon/` as the finished game the others copy.

For each game folder the change touches, start at its `game.ts`. Follow where a round ends and check that exactly one `recordScore` call happens there, with the game's own id. Follow each value handed to the canvas, such as `fillStyle`, `strokeStyle`, `font` or a size, back to where it comes from.

`src/games/index.ts` loads every `game.ts` and throws when one has no default export or exports an `id` that differs from its folder, and `src/games/index.test.ts` fails the same way. The midway then fails to load for every player, not only for that game. A game folder without a `game.ts` gets no booth, and `src/games/index.test.ts` fails on it.

## Threshold

Report a game that skips the shared scores module, records a score more than once per round or under another game's id, touches local storage, keeps its own high score table, or writes a colour, font or size the theme should supply.

Do not report:

- Code outside `src/games/`. `src/carnival/` defines the theme and scores, and `src/midway/palette.ts` has its own scenery colours.
- Values derived from the theme, such as a size scaled from a theme size or a colour picked from `theme`.
- Test data in `game.test.ts`.
- Anything lint, the type-checker or the tests already enforce, such as a missing `game.ts`, a missing default export or an `id` that differs from its folder, which `src/games/index.test.ts` fails on.
- Other house rules, such as tests, cleanup in `start` or the README. They belong to the other lenses or to review by a person.

## Reporting

- Name the house rule the code breaks, the file and line, and the value or call that breaks it.
- State the consequence the code has, not a worse one. A score that skips `recordScore` never shows on the midway's booth card. A hex colour in a game still draws, but drifts from the theme when the theme changes.
- State the fix: the `recordScore` call and where it goes, or the `theme` entry or `canvasFont` call that replaces the literal.
