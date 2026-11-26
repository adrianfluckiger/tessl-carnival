import './style.css';
import { applyTheme, bestScore, type CarnivalGame } from './carnival';
import { registry } from './games';
import { startMidway } from './midway/midway';
import type { BoothSlot, SkateFeature } from './midway/world';

applyTheme();

const app = document.querySelector<HTMLElement>('#app')!;
let stop: (() => void) | undefined;

/**
 * Games taken off the midway for now, to clear the avenue across from the
 * street skating course. They have no booth and no entry in the booth list,
 * but #/play/<game-id> still opens them.
 */
const OFF_THE_MAP = new Set(['hook-a-duck', 'ring-toss', 'water-cannon', 'whack-a-mole']);
const boothGames = () => registry.all().filter((game) => !OFF_THE_MAP.has(game.id));

function bestText(game: CarnivalGame): string {
  const best = bestScore(game.id);
  return best === undefined ? 'No scores yet' : `Best: ${best}`;
}

function renderMidway() {
  document.body.dataset.view = 'midway';
  app.innerHTML = `
    <section class="midway">
      <canvas class="midway-map" aria-label="The carnival midway. Walk up to a booth to play its game."></canvas>
      <p class="midway-help">
        <kbd>WASD</kbd> or <kbd>arrows</kbd> to walk, or click where you want to go.
        <kbd>E</kbd> to play.
      </p>
      <p class="midway-credit">
        Built with
        <a href="https://tessl.io/?utm_source=carnival&amp;utm_medium=midway-credit&amp;utm_campaign=tessl-carnival" target="_blank" rel="noopener">Tessl</a>
        at
        <a href="https://tessl.io/devcon?utm_source=carnival&amp;utm_medium=midway-credit&amp;utm_campaign=tessl-carnival" target="_blank" rel="noopener">AI DevCon NYC</a>
      </p>
      <nav class="midway-guide" aria-label="Booths">
        <h2>Booths</h2>
        <ul></ul>
      </nav>
      <div class="booth-card" aria-live="polite" hidden>
        <h2></h2>
        <p class="description"></p>
        <p class="best"></p>
        <a class="play">Play</a>
      </div>
      <div class="skate-hint" aria-live="polite" hidden>
        <h2></h2>
        <ul></ul>
      </div>
    </section>`;

  const games = boothGames();
  app.querySelector<HTMLElement>('.midway-guide')!.hidden = games.length === 0;
  const guide = app.querySelector('.midway-guide ul')!;
  for (const game of games) {
    const item = document.createElement('li');
    item.innerHTML = `<a href="#/play/${game.id}"><span class="name"></span> <span class="best"></span></a>`;
    item.querySelector('.name')!.textContent = game.name;
    item.querySelector('.best')!.textContent = bestText(game);
    guide.append(item);
  }

  const card = app.querySelector<HTMLElement>('.booth-card')!;
  const showBooth = (booth: BoothSlot | undefined) => {
    const game = booth?.gameId ? registry.get(booth.gameId) : undefined;
    card.hidden = booth === undefined;
    card.classList.toggle('closed', booth !== undefined && !game);
    card.querySelector('h2')!.textContent = game?.name ?? 'Coming soon';
    card.querySelector('.description')!.textContent =
      game?.description ?? 'This booth is waiting for a game. Build one and it opens here.';
    card.querySelector('.best')!.textContent = game ? bestText(game) : '';
    const link = card.querySelector<HTMLAnchorElement>('.play')!;
    link.hidden = !game;
    if (game) link.href = `#/play/${game.id}`;
  };

  const hint = app.querySelector<HTMLElement>('.skate-hint')!;
  const showSkate = (feature: SkateFeature | undefined) => {
    hint.hidden = feature === undefined;
    if (!feature) return;
    hint.querySelector('h2')!.textContent = feature.name;
    const list = hint.querySelector('ul')!;
    list.replaceChildren(
      ...feature.tricks.map((move, i) => {
        const item = document.createElement('li');
        item.innerHTML = `<kbd>${i + 1}</kbd> <span></span>`;
        item.querySelector('span')!.textContent = move.name;
        return item;
      }),
    );
  };

  const midway = startMidway(app.querySelector('canvas')!, {
    games,
    onPlay: (gameId) => (location.hash = `#/play/${gameId}`),
    onReach: showBooth,
    onSkateReach: showSkate,
  });
  stop = midway.stop;
}

function renderGame(game: CarnivalGame) {
  document.body.dataset.view = 'game';
  app.innerHTML = `
    <section class="game">
      <div class="game-header">
        <a href="#/">← Back to the midway</a>
        <h1></h1>
      </div>
      <canvas></canvas>
    </section>`;
  app.querySelector('h1')!.textContent = game.name;
  stop = game.start(app.querySelector('canvas')!);
}

function route() {
  stop?.();
  stop = undefined;

  const match = location.hash.match(/^#\/play\/([\w-]+)$/);
  const game = match ? registry.get(match[1]) : undefined;
  if (game) renderGame(game);
  else renderMidway();
}

window.addEventListener('hashchange', route);
route();
