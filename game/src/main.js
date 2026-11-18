// Solmaris — main: renderer, player, driving, police, helicopter, combat,
// particles, save/load, camera and the game loop.
let renderer, scene, camera, clock;
let playerMesh, playerVelY = 0, playerOnGround = true, walkPhase = 0;
let heli, heliLight, heliCone, heliAngle = 0;
let beacon, beaconRing, muzzle, tracer;
let dustPool = [];
let camTarget = new THREE.Vector3();

G.playerPos = function () {
  if (G.car) return { x: G.car.x, z: G.car.z };
  return { x: G.px, z: G.pz };
};
G.px = G.spawn.x; G.pz = G.spawn.z; G.playerHeading = G.spawn.heading;

G.setWanted = function (n) {
  n = clamp(n, 0, 5);
  if (n > G.wanted) G.crimeTimer = 0;
  G.wanted = n;
  AudioSys.siren(n >= 1 && G.police.some((p) => p.active));
  if (heli) heli.visible = n >= 3;
  if (typeof heliCone !== 'undefined' && heliCone) heliCone.visible = n >= 3;
};

let _inited = false;
function init() {
  if (_inited) return;
  _inited = true;
  const canvas = $('game');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  const _qp = new URLSearchParams(window.location.search);
  G.noShadow = _qp.get('noshadow') === '1';
  renderer.shadowMap.enabled = !G.noShadow;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  G.scene = scene;
  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(20, 12, 46);

  City.build(scene, G.seed);
  HUD.init();

  // Parked stealable cars.
  G.parked = City.parkedSpots.map((s) => {
    const c = Vehicles.makeCar(s.x, s.z, s.heading, s.color, false);
    c.parked = true;
    scene.add(c.mesh);
    return c;
  });
  // Traffic + pedestrians (seeded in shot mode).
  const rnd = mulberry32(G.seed * 101 + 13);
  G.traffic = Vehicles.spawnTraffic(scene, 10, rnd);
  G.peds = People.spawnPedestrians(scene, 16, rnd);
  G.police = [];
  for (let i = 0; i < 4; i += 1) {
    const c = Vehicles.makeCar(0, 0, 0, 0x222831, true);
    c.active = false;
    c.mesh.visible = false;
    scene.add(c.mesh);
    G.police.push(c);
  }

  // Player (Rico Vale).
  playerMesh = People.makePersonMesh(0x2a6a8a, 0x2a2f3a, 0xd9a077);
  playerMesh.position.set(G.px, 0, G.pz);
  scene.add(playerMesh);

  // Mission beacon: glowing column + ring at the current target.
  beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 26, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
  beacon.visible = false; scene.add(beacon);
  beaconRing = new THREE.Mesh(new THREE.RingGeometry(2.2, 3, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  beaconRing.rotation.x = -Math.PI / 2; beaconRing.visible = false; scene.add(beaconRing);

  // Police helicopter with a sweeping searchlight.
  heli = new THREE.Group();
  const hBody = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 6),
    new THREE.MeshLambertMaterial({ color: 0x222831 }));
  hBody.castShadow = true; heli.add(hBody);
  const hTail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 5),
    new THREE.MeshLambertMaterial({ color: 0x222831 }));
  hTail.position.set(0, 0.2, -5); heli.add(hTail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.8),
    new THREE.MeshLambertMaterial({ color: 0x14161a }));
  rotor.position.y = 1; heli.add(rotor);
  heli.userData.rotor = rotor;
  heliLight = new THREE.SpotLight(0xfff2b0, 2.2, 90, 0.32, 0.45, 1.2);
  heliLight.position.set(0, -0.5, 0);
  heli.add(heliLight);
  heliLight.target.position.set(0, -40, 0);
  scene.add(heliLight.target);
  const coneGeo = new THREE.ConeGeometry(7, 42, 20, 1, true);
  heliCone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false,
  }));
  scene.add(heliCone); // world-space: oriented each frame from heli to its target
  heliCone.visible = false;
  heli.position.set(30, 46, 30);
  heli.visible = false;
  scene.add(heli);
  G.heli = heli;

  // Muzzle flash light + tracer line.
  muzzle = new THREE.PointLight(0xffc860, 0, 18);
  scene.add(muzzle);
  const tGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  tracer = new THREE.Line(tGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
  scene.add(tracer);

  // Dust / skid particle pool.
  for (let i = 0; i < 42; i += 1) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xd8c9a8, transparent: true, opacity: 0 }));
    p.visible = false; scene.add(p);
    dustPool.push({ mesh: p, life: 0 });
  }

  bindInput();
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Title screen wiring.
  const save = Missions.load();
  const cont = $('btncontinue');
  if (cont) {
    cont.disabled = !save;
    cont.classList.toggle('disabled', !save);
    cont.addEventListener('click', () => { if (save) continueGame(save); });
  }
  const ng = $('btnnew');
  if (ng) ng.addEventListener('click', () => newGame());
  $('btnmute').addEventListener('click', () => toggleMute());

  // ?shot= hooks (see shots.js): deterministic staged scenes for screenshots.
  const params = new URLSearchParams(window.location.search);
  G.shotMode = params.get('shot');
  const seedParam = parseInt(params.get('seed') || '1', 10);
  if (!isNaN(seedParam)) G.seed = seedParam;
  if (G.shotMode) Shots.stage(G.shotMode);
  else showTitle();

  clock = new THREE.Clock();
  renderer.setAnimationLoop(loop);
  window.SOLMARIS = { G, Missions, AudioSys };
  window.__solmarisReady = false;
  setTimeout(() => { window.__solmarisReady = true; }, 2500);
}

function showTitle() {
  G.state = 'title';
  $('title').classList.add('show');
  $('hud').classList.add('hidden');
}

function hideTitle() {
  $('title').classList.remove('show');
  $('hud').classList.remove('hidden');
}

function newGame() {
  try { localStorage.removeItem('solmaris-save-v1'); } catch (e) { /* ignore */ }
  G.cash = 250; G.health = 100; G.ammo = 12; G.missionsDone = 0;
  G.wanted = 0; G.weapon = 'fists';
  G.px = G.spawn.x; G.pz = G.spawn.z; G.playerHeading = G.spawn.heading;
  G.car = null;
  AudioSys.init(); AudioSys.resume();
  hideTitle();
  G.state = 'play';
  Missions.start(0);
}

function continueGame(save) {
  G.cash = save.cash ?? 250; G.health = save.health ?? 100;
  G.ammo = save.ammo ?? 12; G.missionsDone = save.missionsDone ?? 0;
  G.wanted = 0; G.weapon = 'fists';
  G.px = save.x ?? G.spawn.x; G.pz = save.z ?? G.spawn.z;
  G.playerHeading = save.heading ?? 0;
  G.car = null;
  AudioSys.init(); AudioSys.resume();
  hideTitle();
  G.state = 'play';
  Missions.start(Math.min(save.missionIndex || 0, MISSIONS.length - 1));
  HUD.showBanner('WELCOME BACK, RICO', 'Progress restored — $' + G.cash + ', ' + G.missionsDone + ' jobs done.');
}

function toggleMute() {
  AudioSys.init();
  AudioSys.setMuted(!G.muted);
  const b = $('btnmute');
  if (b) b.textContent = G.muted ? '🔇 MUTED' : '🔊 SOUND ON';
  const m = $('mutebtn');
  if (m) m.textContent = G.muted ? '🔇' : '🔊';
}

// ---------- Input ----------
function bindInput() {
  const keymap = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run', Space: 'jump',
  };
  window.addEventListener('keydown', (e) => {
    AudioSys.init(); AudioSys.resume();
    if (keymap[e.code]) { G.keys[keymap[e.code]] = true; if (e.code === 'Space') e.preventDefault(); }
    if (e.code === 'KeyE') tryEnterExitCar();
    if (e.code === 'KeyF') meleeAttack();
    if (e.code === 'KeyR') reload();
    if (e.code === 'Digit1') G.weapon = 'fists';
    if (e.code === 'Digit2') G.weapon = 'pistol';
    if (e.code === 'KeyM') toggleMute();
    if (e.code === 'Enter' && G.state === 'failed') Missions.retry();
    if (e.code === 'Enter' && (G.state === 'busted' || G.state === 'wasted')) respawn();
  });
  window.addEventListener('keyup', (e) => { if (keymap[e.code]) G.keys[keymap[e.code]] = false; });
  const canvas = $('game');
  let dragging = false, lx = 0, ly = 0;
  canvas.addEventListener('mousedown', (e) => {
    AudioSys.init(); AudioSys.resume();
    if (G.state !== 'play') return;
    if (e.button === 0) {
      if (G.weapon === 'pistol' && !G.car) shoot();
      dragging = true; lx = e.clientX; ly = e.clientY;
    }
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    G.camYaw -= (e.clientX - lx) * 0.005;
    G.camPitch = clamp(G.camPitch + (e.clientY - ly) * 0.003, 0.08, 1.1);
    lx = e.clientX; ly = e.clientY;
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

function nearestCar(maxD) {
  const pp = G.playerPos();
  let best = null, bestD = maxD;
  [...G.parked, ...G.traffic].forEach((c) => {
    if (c === G.car) return;
    const d = dist2d(pp.x, pp.z, c.x, c.z);
    if (d < bestD) { bestD = d; best = c; }
  });
  return best;
}

function tryEnterExitCar() {
  if (G.state !== 'play') return;
  if (G.car) {
    // Exit: step out to the side.
    const c = G.car;
    G.car = null;
    c.parked = true; c.speed = 0; c.owned = true;
    G.px = c.x + Math.cos(c.heading) * 2.4;
    G.pz = c.z - Math.sin(c.heading) * 2.4;
    playerMesh.position.set(G.px, 0, G.pz);
    playerMesh.visible = true;
    return;
  }
  const c = nearestCar(4.2);
  if (!c) return;
  const wasParked = c.parked || !c.ai;
  G.car = c;
  c.parked = false;
  if (c.ai) { c.ai = null; G.traffic = G.traffic.filter((t) => t !== c); }
  playerMesh.visible = false;
  if (!c.owned) {
    // Stealing a car that is not already yours draws the law.
    if (G.wanted < 1) G.setWanted(1);
    HUD.setHint('Stolen! The law is on you — lose them or lay low.');
  }
  AudioSys.blip(220, 0.12, 'square', 0.25);
}

function meleeAttack() {
  if (G.state !== 'play' || G.car) return;
  AudioSys.punch();
  const pp = G.playerPos();
  G.enemies.forEach((e) => {
    if (!e.alive) return;
    const d = dist2d(pp.x, pp.z, e.x, e.z);
    if (d < 2.6) {
      e.health -= 34;
      e.x += Math.sin(e.heading) * 0; // knockback away from player
      const a = Math.atan2(e.x - pp.x, e.z - pp.z);
      e.x += Math.sin(a) * 1.2; e.z += Math.cos(a) * 1.2;
      if (e.health <= 0) killEnemy(e);
    }
  });
  // Whiff animation: quick arm swing.
  if (playerMesh.userData.limbs) playerMesh.userData.limbs.armR.rotation.x = -1.6;
}

function reload() {
  if (G.weapon !== 'pistol' || G.ammo === G.maxAmmo) return;
  G.ammo = G.maxAmmo;
  AudioSys.blip(520, 0.08, 'square', 0.2);
}

function shoot() {
  if (G.ammo <= 0) { AudioSys.blip(140, 0.08, 'square', 0.2); reload(); return; }
  G.ammo -= 1;
  AudioSys.shoot();
  muzzle.position.copy(playerMesh.position).add(new THREE.Vector3(0, 1.5, 0));
  muzzle.intensity = 8;
  setTimeout(() => { muzzle.intensity = 0; }, 60);
  // Third-person aim: the shot travels from the player's gun along the
  // camera's forward direction flattened to chest height (the screen-centre
  // ray from a high chase camera would dig into the ground a few metres out).
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  camDir.y = 0; camDir.normalize();
  const origin = playerMesh.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  const alive = G.enemies.filter((e) => e.alive);
  let best = null, bestD = 70;
  alive.forEach((e) => {
    const to = new THREE.Vector3(e.x - origin.x, 0, e.z - origin.z);
    const d = to.length();
    if (d > 70 || d < 0.5) return;
    if (to.dot(camDir) <= 0) return; // behind the player
    // Lateral distance from the aim line: forgiving of chase-camera lag.
    const lateral = Math.abs(to.x * camDir.z - to.z * camDir.x);
    if (lateral < 1.3 && d < bestD) { bestD = d; best = e; }
  });
  let end = origin.clone().add(camDir.clone().multiplyScalar(60));
  end.y = 1.4;
  if (best) {
    end = new THREE.Vector3(best.x, 1.3, best.z);
    best.health -= 34;
    spawnDust(end.x, end.z, 1.6);
    if (best.health <= 0) killEnemy(best);
  }
  const pos = tracer.geometry.attributes.position;
  const start = playerMesh.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  pos.setXYZ(0, start.x, start.y, start.z);
  pos.setXYZ(1, end.x, end.y, end.z);
  pos.needsUpdate = true;
  tracer.material.opacity = 0.9;
  setTimeout(() => { tracer.material.opacity = 0; }, 90);
  // Gunfire in the street draws attention.
  if (G.wanted < 1) G.setWanted(1);
}

function killEnemy(e) {
  e.alive = false;
  e.mesh.rotation.x = -Math.PI / 2;
  e.mesh.position.y = 0.3;
  AudioSys.noise(0.2, 0.3, 500);
}

// ---------- Particles ----------
function spawnDust(x, z, y) {
  const p = dustPool.find((d) => d.life <= 0);
  if (!p) return;
  p.life = 0.7;
  p.mesh.visible = true;
  p.mesh.position.set(x, y || 0.4, z);
  p.mesh.material.opacity = 0.55;
  p.mesh.scale.setScalar(1);
}

function updateDust(dt) {
  dustPool.forEach((p) => {
    if (p.life <= 0) return;
    p.life -= dt;
    p.mesh.material.opacity = Math.max(0, p.life * 0.7);
    p.mesh.scale.addScalar(dt * 2);
    if (p.life <= 0) p.mesh.visible = false;
  });
}

// ---------- Police + helicopter ----------
function updatePolice(dt) {
  const want = G.wanted;
  const pp = G.playerPos();
  // Spawn / despawn to match the wanted level.
  const need = want === 0 ? 0 : Math.min(4, want + (want >= 3 ? 1 : 0));
  G.police.forEach((p, i) => {
    const shouldBe = i < need;
    if (shouldBe && !p.active) {
      p.active = true; p.mesh.visible = true;
      const a = Math.random() * Math.PI * 2;
      p.x = clamp(pp.x + Math.sin(a) * 45, -140, 140);
      p.z = clamp(pp.z + Math.cos(a) * 45, -140, 140);
      p.heading = Math.atan2(pp.x - p.x, pp.z - p.z);
      p.speed = 10;
    }
    if (!shouldBe && p.active) { p.active = false; p.mesh.visible = false; p.speed = 0; }
  });
  AudioSys.siren(want >= 1 && G.police.some((p) => p.active));
  let busting = false;
  G.police.forEach((p) => {
    if (!p.active) return;
    const d = dist2d(p.x, p.z, pp.x, pp.z);
    const wantHeading = Math.atan2(pp.x - p.x, pp.z - p.z);
    p.heading = angleLerp(p.heading, wantHeading, clamp(dt * 1.6, 0, 1));
    const top = 26 + want * 3.5;
    p.speed = lerp(p.speed, Math.min(top, d > 30 ? top : top * 0.8), clamp(dt, 0, 1));
    p.x += Math.sin(p.heading) * p.speed * dt;
    p.z += Math.cos(p.heading) * p.speed * dt;
    p.x = clamp(p.x, -WORLD.bound, WORLD.bound);
    p.z = clamp(p.z, -WORLD.bound, WORLD.bound);
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    // Light bar flash.
    if (p.mesh.userData.lightBar) {
      const on = Math.floor(G.time * 6) % 2 === 0;
      p.mesh.userData.lightBar[0].material.color.setHex(on ? 0xff2222 : 0x550000);
      p.mesh.userData.lightBar[1].material.color.setHex(on ? 0x000055 : 0x2244ff);
    }
    // Ram the player.
    if (d < 3.4) {
      if (G.car) {
        G.car.speed *= 0.86;
        const a = Math.atan2(G.car.x - p.x, G.car.z - p.z);
        G.car.x += Math.sin(a) * 1.2; G.car.z += Math.cos(a) * 1.2;
        if (Math.random() < dt * 2) AudioSys.crash();
      } else if (d < 3.0) {
        busting = true;
      }
    }
    // Bust when the player is stopped and surrounded.
    const playerSlow = G.car ? Math.abs(G.car.speed) < 1.5 : true;
    if (d < 5.5 && playerSlow) {
      G.bustTimer += dt;
      if (G.bustTimer > 2.6) { busted(); return; }
    }
  });
  if (!busting && G.bustTimer > 0) G.bustTimer = Math.max(0, G.bustTimer - dt * 2);
  // Wanted decay when clean for a while.
  if (want > 0) {
    G.crimeTimer += dt;
    if (G.crimeTimer > 34) { G.setWanted(want - 1); G.crimeTimer = 0; }
  }
}

function updateHeli(dt) {
  if (!heli.visible) { if (heliCone) heliCone.visible = false; return; }
  if (heliCone) heliCone.visible = true;
  heliAngle += dt * 0.35;
  const pp = G.playerPos();
  // Wide, low-ish circle so the helicopter reads in the sky ahead of the chase.
  const hx = pp.x + Math.sin(heliAngle) * 48;
  const hz = pp.z + Math.cos(heliAngle) * 48;
  const hy = 34 + Math.sin(G.time * 0.7) * 1.5;
  heli.position.set(hx, hy, hz);
  heli.rotation.y = Math.atan2(pp.x - hx, pp.z - hz);
  heli.userData.rotor.rotation.y += dt * 22;
  // The searchlight sweeps a circle around the player and locks on when close.
  const sweep = G.time * 0.9;
  const tx = pp.x + Math.sin(sweep) * 9;
  const tz = pp.z + Math.cos(sweep) * 9;
  heliLight.target.position.set(tx, 0, tz);
  heliLight.target.updateMatrixWorld();
  // Visible beam: apex at the heli, base on the ground at the light pool.
  const hp = heli.position;
  const tp = new THREE.Vector3(tx, 0, tz);
  const dir = tp.clone().sub(hp);
  const len = dir.length();
  heliCone.position.copy(hp).add(tp).multiplyScalar(0.5);
  heliCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().multiplyScalar(-1).normalize());
  heliCone.scale.set(1, len / 42, 1);
}

// ---------- Busted / wasted / respawn ----------
function busted() {
  if (G.state !== 'play') return;
  G.state = 'busted';
  G.cash = Math.max(0, G.cash - 200);
  G.setWanted(0);
  if (G.car) { G.car.speed = 0; G.car = null; playerMesh.visible = true; }
  HUD.showEnd('BUSTED', 'The Solmaris PD took you in. −$200. Press Enter to walk free.');
  AudioSys.fail();
  if (G.mission) { Missions.clearPickup(); G.enemies.forEach((e) => { if (e.mesh) G.scene.remove(e.mesh); }); G.enemies = []; }
  HUD.hideBanner();
}

function wasted() {
  if (G.state !== 'play') return;
  G.state = 'wasted';
  G.cash = Math.max(0, G.cash - 100);
  G.setWanted(0);
  if (G.car) { G.car.speed = 0; G.car = null; playerMesh.visible = true; }
  HUD.showEnd('WASTED', 'You flatlined on the streets of Solmaris. −$100. Press Enter to get up.');
  AudioSys.fail();
  if (G.mission) { Missions.clearPickup(); G.enemies.forEach((e) => { if (e.mesh) G.scene.remove(e.mesh); }); G.enemies = []; }
  HUD.hideBanner();
}

function respawn() {
  const hospital = G.state === 'wasted';
  G.px = hospital ? -40 : 40;
  G.pz = hospital ? 120 : -120;
  G.playerHeading = 0;
  G.health = 100;
  G.setWanted(0);
  G.bustTimer = 0;
  playerMesh.position.set(G.px, 0, G.pz);
  playerMesh.rotation.x = 0;
  HUD.hideEnd();
  G.state = 'play';
  if (G.mission) Missions.retry();
  else Missions.start(G.missionIndex);
}

// ---------- Player on foot ----------
function updatePlayer(dt) {
  const k = G.keys;
  const camFwd = G.playerHeading + G.camYaw;
  let mx = 0, mz = 0;
  if (k.up) { mx += Math.sin(camFwd); mz += Math.cos(camFwd); }
  if (k.down) { mx -= Math.sin(camFwd); mz -= Math.cos(camFwd); }
  if (k.left) { mx += Math.sin(camFwd - Math.PI / 2); mz += Math.cos(camFwd - Math.PI / 2); }
  if (k.right) { mx += Math.sin(camFwd + Math.PI / 2); mz += Math.cos(camFwd + Math.PI / 2); }
  const len = Math.hypot(mx, mz);
  const run = k.run ? 1.8 : 1;
  if (len > 0.01) {
    mx /= len; mz /= len;
    const speed = 5 * run;
    G.px += mx * speed * dt;
    G.pz += mz * speed * dt;
    G.playerHeading = angleLerp(G.playerHeading, Math.atan2(mx, mz), clamp(dt * 10, 0, 1));
    walkPhase += dt * (run > 1 ? 11 : 7);
    if (Math.floor(walkPhase) % 2 === 0 && Math.random() < dt * 6) AudioSys.step();
  }
  // Jump / gravity.
  if (k.jump && playerOnGround) { playerVelY = 7.5; playerOnGround = false; }
  playerVelY -= 22 * dt;
  let py = playerMesh.position.y + playerVelY * dt;
  if (py <= 0) { py = 0; playerVelY = 0; playerOnGround = true; }
  // Collisions with buildings.
  G.colliders.forEach((b) => {
    const nx = clamp(G.px, b.x0, b.x1), nz = clamp(G.pz, b.z0, b.z1);
    const dx = G.px - nx, dz = G.pz - nz;
    if (dx * dx + dz * dz < 0.6 * 0.6) {
      const d = Math.sqrt(dx * dx + dz * dz) || 0.001;
      G.px = nx + (dx / d) * 0.6;
      G.pz = nz + (dz / d) * 0.6;
    }
  });
  G.px = clamp(G.px, -WORLD.bound, WORLD.bound);
  G.pz = clamp(G.pz, -WORLD.bound, WORLD.bound);
  playerMesh.position.set(G.px, py, G.pz);
  playerMesh.rotation.y = G.playerHeading;
  People.animateWalk(playerMesh, walkPhase, len > 0.01 ? 5 * run : 0);
  // Car vs pedestrian collisions (player driving).
  // On-foot: walking into a ped is harmless.
  G.nearCar = nearestCar(4.2);
}

// ---------- Car collisions with peds / traffic ----------
function updateCarImpacts() {
  if (!G.car) return;
  const c = G.car;
  G.peds.forEach((p) => {
    if (!p.alive) return;
    if (dist2d(c.x, c.z, p.x, p.z) < 2.2 && Math.abs(c.speed) > 3) {
      p.alive = false;
      p.mesh.rotation.x = -Math.PI / 2;
      p.mesh.position.y = 0.3;
      c.speed *= 0.6;
      AudioSys.crash();
      G.setWanted(Math.min(5, G.wanted + 1));
      HUD.setHint('You hit a pedestrian! Wanted level up.');
    }
  });
  [...G.traffic, ...G.police].forEach((o) => {
    if (o === c || (o.active === false && o.isPolice)) return;
    const d = dist2d(c.x, c.z, o.x, o.z);
    if (d < 3.6 && d > 0.01) {
      const a = Math.atan2(c.x - o.x, c.z - o.z);
      c.x += Math.sin(a) * (3.6 - d) * 0.5;
      c.z += Math.cos(a) * (3.6 - d) * 0.5;
      o.x -= Math.sin(a) * (3.6 - d) * 0.3;
      o.z -= Math.cos(a) * (3.6 - d) * 0.3;
      if (Math.abs(c.speed) > 8) { c.speed *= 0.7; AudioSys.crash(); }
    }
  });
}

// ---------- Camera ----------
function updateCamera(dt) {
  const pp = G.playerPos();
  let heading = G.playerHeading;
  if (G.car) heading = G.car.heading;
  const yaw = heading + Math.PI + G.camYaw;
  const dist = G.car ? 10.5 : 7;
  const height = 2.8 + G.camPitch * 4;
  const tx = pp.x + Math.sin(yaw) * dist;
  const tz = pp.z + Math.cos(yaw) * dist;
  const ty = (G.car ? 0 : playerMesh.position.y) + height;
  camTarget.set(pp.x, (G.car ? 1.2 : 1.6) + playerMesh.position.y + (G.camLift || 0), pp.z);
  camera.position.x = lerp(camera.position.x, tx, clamp(dt * 5, 0, 1));
  camera.position.y = lerp(camera.position.y, ty, clamp(dt * 5, 0, 1));
  camera.position.z = lerp(camera.position.z, tz, clamp(dt * 5, 0, 1));
  camera.lookAt(camTarget);
}

// ---------- Beacon ----------
function updateBeacon(dt) {
  const t = Missions.stepTarget();
  if (!t || G.state !== 'play') { beacon.visible = false; beaconRing.visible = false; return; }
  beacon.visible = true; beaconRing.visible = true;
  beacon.position.set(t.x, 13, t.z);
  beacon.rotation.y += dt;
  beaconRing.position.set(t.x, 0.3, t.z);
  beaconRing.scale.setScalar(1 + Math.sin(G.time * 4) * 0.15);
}

// ---------- Main loop ----------
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  G.time += dt;
  if (G.state === 'title') {
    // Slow cinematic orbit over the city behind the title screen.
    const a = G.time * 0.05;
    camera.position.set(Math.sin(a) * 120, 42, Math.cos(a) * 120);
    camera.lookAt(0, 6, 0);
    Vehicles.updateTraffic(G.traffic, dt, [...G.traffic, ...G.parked]);
    renderer.render(scene, camera);
    return;
  }
  if (G.state !== 'play') { renderer.render(scene, camera); return; }

  // Input -> drive or walk.
  if (G.car) {
    const input = {
      forward: !!(G.keys.up), back: !!(G.keys.down),
      left: !!(G.keys.left), right: !!(G.keys.right),
      handbrake: !!(G.keys.jump),
    };
    const prevSpeed = G.car.speed;
    G.speedKmh = Vehicles.driveCar(G.car, input, dt);
    Vehicles.collideCarWorld(G.car);
    updateCarImpacts();
    if (Math.abs(G.car.speed) > 20 && Math.random() < dt * 8) {
      spawnDust(G.car.x - Math.sin(G.car.heading) * 2, G.car.z - Math.cos(G.car.heading) * 2, 0.4);
    }
    if (input.handbrake && Math.abs(prevSpeed) > 10 && Math.random() < dt * 10) {
      spawnDust(G.car.x, G.car.z, 0.4);
    }
    AudioSys.engine(G.car.speed, true);
  } else {
    updatePlayer(dt);
    AudioSys.engine(0, false);
  }

  Vehicles.updateTraffic(G.traffic, dt, [...G.traffic, ...G.parked, ...G.police, ...(G.car ? [G.car] : [])]);
  People.updatePedestrians(G.peds, dt, G.playerPos());
  G.enemies.forEach((e) => People.updateEnemy(e, dt, G.playerPos(), (enemy) => {
    // Enemy shot: hit chance falls with distance.
    const d = dist2d(enemy.x, enemy.z, G.playerPos().x, G.playerPos().z);
    if (Math.random() < clamp(0.6 - d * 0.015, 0.15, 0.6)) {
      G.health = Math.max(0, G.health - 6);
      HUD.flashDamage();
    }
    AudioSys.noise(0.1, 0.25, 2000);
  }));
  updatePolice(dt);
  updateHeli(dt);
  Missions.update(dt);
  updateBeacon(dt);
  updateDust(dt);
  updateCamera(dt);

  // Health / death.
  if (G.health <= 0) { wasted(); }
  // Autosave.
  G.saveTimer += dt;
  if (G.saveTimer > 10) { G.saveTimer = 0; if (G.mission) Missions.save(); }

  HUD.update();
  HUD.drawMinimap();
  renderer.render(scene, camera);
}

window.addEventListener('DOMContentLoaded', init);
if (document.readyState !== 'loading') init();
