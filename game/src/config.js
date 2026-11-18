// Solmaris — config: world constants, story mission data, seeded RNG, helpers.
// Every name, character and place here is original.
const G = {
  time: 0, state: 'title', // title | play | busted | wasted | failed | done
  cash: 250, health: 100, maxHealth: 100, ammo: 12, maxAmmo: 12,
  weapon: 'fists', wanted: 0, missionIndex: 0, missionsDone: 0,
  muted: false, paused: false, seed: 1, shotMode: null,
  player: null, car: null, heli: null, police: [], traffic: [], peds: [],
  enemies: [], particles: [], colliders: [], pickups: [],
  mission: null, missionStep: 0, missionTimer: 0, missionMsg: '',
  bustTimer: 0, crimeTimer: 0, saveTimer: 0, speedKmh: 0,
  camYaw: 0, camPitch: 0.32, camDist: 9,
  keys: {}, mouseDown: false, dragDX: 0, dragDY: 0,
  spawn: { x: 8, z: 30, heading: Math.PI },
};

const WORLD = {
  bound: 235,            // playable half-extent
  beachX: -150,          // sand starts west of here
  waterX: -218,          // sea starts west of here
  boardwalkX: -146,
  harborZ: 158,          // docks start south of here
  hillsZ: -158,          // hills start north of here
  streets: [-120, -80, -40, 0, 40, 80, 120],
  roadHalf: 5,
};

// Story: Rico Vale, new in town, runs jobs for fixer Mara Voss.
const MISSIONS = [
  {
    id: 1, title: 'First Wheels', reward: 300,
    brief: 'Mara needs wheels. Steal the coupe parked by the plaza, then bring it to her garage.',
    steps: [
      { type: 'goto', label: 'Steal the parked coupe', x: 24, z: -8, r: 6 },
      { type: 'enterCar', label: 'Get in the coupe (E)' },
      { type: 'goto', label: 'Drive to Mara\u2019s garage', x: -60, z: 84, r: 8, needCar: true },
    ],
  },
  {
    id: 2, title: 'Courier Run', reward: 450, timer: 150,
    brief: 'Three drops, one sunset. Hit every drop-off before the clock runs out.',
    steps: [
      { type: 'goto', label: 'Drop 1 — Pier kiosk', x: -140, z: -60, r: 7 },
      { type: 'goto', label: 'Drop 2 — Harbor gate', x: 60, z: 150, r: 7 },
      { type: 'goto', label: 'Drop 3 — Hilltop lookout', x: -100, z: -140, r: 7 },
    ],
  },
  {
    id: 3, title: 'Beach Brawl', reward: 500,
    brief: 'The Shore Rats jumped Mara\u2019s runner on the sand. Settle it — fists or pistol.',
    steps: [
      { type: 'goto', label: 'Reach the beach fight', x: -178, z: 20, r: 10 },
      { type: 'kill', label: 'Defeat the Shore Rats', count: 3, at: [[-182, 16], [-176, 26], [-184, 30]] },
    ],
  },
  {
    id: 4, title: 'The Quiet Pickup', reward: 600,
    brief: 'No engine noise, no attention. Walk the pier on foot, grab the package, walk it back.',
    onFootHint: true,
    steps: [
      { type: 'goto', label: 'ON FOOT — walk to the pier package', x: -196, z: -40, r: 5, onFoot: true },
      { type: 'pickup', label: 'Grab the package (walk over it)', x: -196, z: -40 },
      { type: 'goto', label: 'ON FOOT — walk it back to the boardwalk contact', x: -138, z: -40, r: 6, onFoot: true },
    ],
  },
  {
    id: 5, title: 'Harbor Heat', reward: 800,
    brief: 'A crate at the docks, four guards, and the law already sniffing. Get the crate, then lose the heat at the safehouse.',
    steps: [
      { type: 'goto', label: 'Reach the harbor warehouse', x: 100, z: 170, r: 10 },
      { type: 'kill', label: 'Clear the dock guards', count: 4, at: [[104, 168], [96, 176], [110, 172], [92, 164]] },
      { type: 'pickup', label: 'Grab the crate (walk over it)', x: 100, z: 160 },
      { type: 'goto', label: 'Escape to the safehouse — wanted level 2', x: -110, z: -110, r: 8 },
    ],
  },
  {
    id: 6, title: 'Sunset Getaway', reward: 1500,
    brief: 'Last job. Cross the east bridge with the whole city on your tail and reach Mara\u2019s yacht at the marina.',
    steps: [
      { type: 'goto', label: 'Cross the east bridge', x: 185, z: 0, r: 10 },
      { type: 'goto', label: 'Reach the marina yacht', x: 150, z: 130, r: 9 },
    ],
  },
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist2d(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
function $(id) { return document.getElementById(id); }
