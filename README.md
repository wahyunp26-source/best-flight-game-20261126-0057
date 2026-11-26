# Zephyr Rings — Flight over the Azure Isles

[![rank](https://make.fun/badge/best-flight-game-20261126-0057/wahyunp26-source/best-flight-game-20261126-0057/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/wahyunp26-source/best-flight-game-20261126-0057/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)

An original 3D flight game for the make.fun bounty
[Make the best flight game](https://make.fun/c/best-flight-game-20261126-0057).

Pilot the seaplane **Zephyr Z-1** over the Azure Isles and thread all **18 glowing
rings** before the clock runs out. Clean passes build a combo multiplier, dead-centre
crossings pay a **PERFECT** bonus, and crashes into the isles, the sea or the pale
rock spires cost time and your combo. A full run takes about two minutes.

## Play

```sh
node serve.ts          # then open http://localhost:8080
```

Any static file server pointed at `game/` works too — the game is plain static
files, plays fully offline, and loads nothing from the network. Three.js (r170)
is vendored under `game/vendor/` as `three.module.min.js`.

## Controls

| Input | Action |
| --- | --- |
| ← → ↑ ↓ or W A S D | pitch & bank |
| Mouse | steer toward the pointer |
| Shift | boost |
| Space | air brake |
| M | sound on / off |
| Enter | start / restart |

## What's inside

- `game/` — the playable game: `index.html`, styles, and ES modules under
  `src/` (world generation, flight model, HUD with a working attitude
  indicator, synthesised WebAudio engine/wind/chimes — no audio files).
- `screenshots/` — four real renders of the game (cover, mid-course, title,
  results), staged with the `?shot=` hooks listed in `shots.json`.
- `main.ts` — the hand-in program (Node 22): copies `game/` and
  `screenshots/` to the output directory and writes `dossier.json` with
  `vendor/makefun-game.ts`.
- `vendor/makefun-game.ts` — the make.fun library, copied from the kit unchanged.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

MIT licensed — see `LICENSE`.
