import assert from "node:assert/strict";
import test from "node:test";
import { Camera } from "../src/game/camera.ts";
import { getDifficulty } from "../src/game/config.ts";
import { Game } from "../src/game/game.ts";
import { normalizeSave } from "../src/game/storage.ts";
import { chunkKey, FLAGGED, HIDDEN, REVEALED, World } from "../src/game/world.ts";

test("World.setSafeZone guarantees 3x3 mine-free start and flood respects cap", () => {
  const w = new World(12345, 0.25);
  w.setSafeZone(10, -4);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      assert.equal(w.isMine(10 + dx, -4 + dy), false);
    }
  }

  const emptyWorld = new World(1, 0);
  const res = emptyWorld.flood(0, 0, 100, 10, 50);
  assert.ok(res.cells >= 50 && res.cells <= 57);
  assert.equal(res.capped, true);
  assert.equal(emptyWorld.revealedTotal, res.cells);
});

test("chunkKey avoids 16-bit collisions for large coordinates", () => {
  assert.notEqual(chunkKey(32768, 0), chunkKey(-32768, 0));
  assert.notEqual(chunkKey(0, 32768), chunkKey(0, -32768));
  assert.notEqual(chunkKey(100000, -100000), chunkKey(-100000, 100000));
});

test("Game.reveal, toggleFlag, and chord update state and score", () => {
  const g = new Game(getDifficulty("easy"), "TEST-SEED");
  assert.equal(g.status, "ready");
  g.reveal(0, 0);
  assert.equal(g.status, "playing");
  assert.ok(g.world.revealedTotal >= 1);
  assert.equal(g.world.getState(0, 0), REVEALED);

  // Find a hidden cell and toggle flag
  let fx = 0;
  let fy = 0;
  for (let x = 1; x < 30; x++) {
    if (g.world.getState(x, 0) === HIDDEN) {
      fx = x;
      break;
    }
  }
  g.toggleFlag(fx, fy);
  assert.equal(g.world.getState(fx, fy), FLAGGED);
  g.toggleFlag(fx, fy);
  assert.equal(g.world.getState(fx, fy), HIDDEN);
});

test("Camera.jumpTo updates coordinates and notifies subscribers", () => {
  const cam = new Camera();
  let notified = 0;
  const unsub = cam.subscribe(() => {
    notified++;
  });
  cam.jumpTo(42.5, -18.25);
  unsub();
  assert.equal(cam.cx, 42.5);
  assert.equal(cam.cy, -18.25);
  assert.equal(cam.dirty, true);
  assert.equal(notified, 1);
});

test("normalizeSave safely recovers from corrupted or partial localStorage payloads", () => {
  const corrupt = normalizeSave({
    best: null,
    bestCleared: "bad",
    games: "NaN",
    difficulty: "ultra",
    musicVolume: 99,
    sfxVolume: -5,
    longPressMs: 10,
  });
  assert.deepEqual(corrupt.best, {});
  assert.deepEqual(corrupt.bestCleared, {});
  assert.equal(corrupt.games, 0);
  assert.equal(corrupt.difficulty, "normal");
  assert.equal(corrupt.musicVolume, 1);
  assert.equal(corrupt.sfxVolume, 0);
  assert.equal(corrupt.longPressMs, 350);

  const valid = normalizeSave({
    best: { easy: 1200.9, insane: -10 },
    games: 7,
    difficulty: "hard",
  });
  assert.deepEqual(valid.best, { easy: 1200 });
  assert.equal(valid.games, 7);
  assert.equal(valid.difficulty, "hard");
});
