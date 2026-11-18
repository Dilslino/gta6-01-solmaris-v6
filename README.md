# Solmaris — Open-World Crime Game

[![Stars](https://badgen.net/github/stars/Dilslino/gta6-01-solmaris-v6)](https://github.com/Dilslino/gta6-01-solmaris-v6)
[![License](https://badgen.net/github/license/Dilslino/gta6-01-solmaris-v6)](https://github.com/Dilslino/gta6-01-solmaris-v6/blob/main/LICENSE)
[![Last commit](https://badgen.net/github/last-commit/Dilslino/gta6-01-solmaris-v6)](https://github.com/Dilslino/gta6-01-solmaris-v6/commits/main)

**Solmaris** is a complete GTA-style open-world crime game that runs entirely
offline in a desktop browser from static files. Explore a sun-soaked coastal
city at sunset — beach, boardwalk, downtown towers, hills, a bridge and a
harbor — on foot or behind the wheel.

## What is in the game

- **Open world:** a coastal sunset city with drivable streets, a beach,
  boardwalk, downtown blocks, hills, a bridge and a harbor.
- **On foot & driving:** walk, run and jump; steal parked cars and traffic
  cars (E), drive with arcade handling, handbrake and clean full-speed
  U-turns.
- **Traffic & pedestrians:** AI cars drive the streets, pedestrians walk the
  sidewalks and cross at corners.
- **Wanted system & police:** stealing cars or hitting pedestrians raises your
  wanted level; police cars pursue and try to bust you, and a police
  helicopter with a sweeping searchlight joins the hunt at 3 stars.
- **Missions & story:** 6 story missions for fixer Mara Voss — car theft,
  courier runs, a beach brawl, a quiet on-foot pickup, a harbor heist and a
  sunset getaway — with objectives, markers, pass/fail and cash rewards.
- **Combat:** melee punches and a pistol with ammo; armed enemies fight back.
- **HUD & minimap:** health, wanted stars, cash, speed, mission objective
  and a live minimap showing the player, cars, police and mission markers.
- **Start & save:** title screen with New Game / Continue; progress saves to
  localStorage and Continue resumes it after a reload.
- **Sound:** synthesized WebAudio music and effects (engine, sirens,
  footsteps, mission jingle) with a mute toggle (M).

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Move / drive |
| Shift | Run (on foot) |
| Space | Jump (on foot) / handbrake (driving) |
| E | Enter / exit car, steal car |
| F | Melee punch |
| Mouse click | Shoot pistol |
| 1 / 2 | Fists / pistol |
| M | Mute / unmute |
| Mouse drag | Orbit camera |

## Play it

Serve `game/` with any static server and open `game/index.html`, for
example:

```sh
node serve.ts   # serves game/ on http://localhost:8080
```

No build step, no network request at runtime. Built with
[three.js](https://threejs.org/) (vendored under `game/vendor/`).

## Entry

This repository is an entry for the make.fun **gta6-01** bounty ("Make GTA
6"). `main.ts` (Node 22) copies `game/` and `screenshots/` to `/output` and
writes `/output/dossier.json`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

All names, characters, art, music and story are original — nothing from any
commercial game.
