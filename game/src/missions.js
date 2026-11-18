// Solmaris — missions: story state machine, markers, pass/fail, rewards.
const Missions = {
  beacon: null, ring: null, pickupMesh: null,

  start(index) {
    G.missionIndex = index;
    G.mission = MISSIONS[index];
    G.missionStep = 0;
    G.missionTimer = G.mission ? (G.mission.timer || 0) : 0;
    G.missionMsg = '';
    if (!G.mission) { HUD.showBanner('SOLMARIS', 'You did it, Rico. The city is yours. Free roam!'); return; }
    HUD.showBanner('MISSION ' + G.mission.id + ' — ' + G.mission.title, G.mission.brief);
    AudioSys.jingle();
    this.setupStep();
    this.save();
  },

  currentStep() {
    return G.mission ? G.mission.steps[G.missionStep] : null;
  },

  setupStep() {
    const step = this.currentStep();
    this.clearPickup();
    if (!step) { this.complete(); return; }
    if (step.type === 'kill') {
      G.enemies = step.at.map((p) => People.makeEnemy(G.scene, p[0], p[1], G.missionIndex >= 4));
      G.enemiesLeft = step.count;
    }
    if (step.type === 'pickup') {
      const prev = G.mission.steps[G.missionStep - 1] || step;
      const px = step.x !== undefined ? step.x : prev.x;
      const pz = step.z !== undefined ? step.z : prev.z;
      this.spawnPickup(px, pz);
    }
    if (G.missionIndex === 3 && G.missionStep === 0) {
      // Mission 4: a drivable car waits nearby at the start, on purpose.
      HUD.setHint('ON FOOT — leave the car. A coupe is parked by the boardwalk if you need wheels after.');
    }
    if (G.missionIndex === 4 && G.missionStep === 3) G.setWanted(2);
    if (G.missionIndex === 5 && G.missionStep === 0) G.setWanted(3);
  },

  spawnPickup(x, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9),
      new THREE.MeshLambertMaterial({ color: 0xffd76a, emissive: 0x664400 }));
    m.position.set(x, 0.5, z);
    G.scene.add(m);
    this.pickupMesh = m;
    G.pickups = [{ x, z, mesh: m }];
  },

  clearPickup() {
    if (this.pickupMesh) { G.scene.remove(this.pickupMesh); this.pickupMesh = null; }
    G.pickups = [];
  },

  stepTarget() {
    const step = this.currentStep();
    if (!step) return null;
    if (step.type === 'kill') {
      const alive = G.enemies.filter((e) => e.alive);
      if (alive.length) return { x: alive[0].x, z: alive[0].z };
      return null;
    }
    if (step.type === 'pickup' && G.pickups.length) return { x: G.pickups[0].x, z: G.pickups[0].z };
    if (step.type === 'enterCar') {
      const near = G.parked && G.parked.length ? G.parked[0] : null;
      return near ? { x: near.x, z: near.z } : null;
    }
    if (step.x !== undefined) return { x: step.x, z: step.z };
    return null;
  },

  update(dt) {
    if (!G.mission || G.state !== 'play') return;
    const step = this.currentStep();
    if (!step) return;
    if (G.missionTimer > 0) {
      G.missionTimer -= dt;
      if (G.missionTimer <= 0) { this.fail('Time ran out.'); return; }
    }
    const pp = G.playerPos();
    if (step.type === 'goto') {
      if (dist2d(pp.x, pp.z, step.x, step.z) < step.r) {
        if (step.onFoot && G.car) { G.missionMsg = 'Get out of the car — this part is on foot (E).'; return; }
        if (step.needCar && !G.car) { G.missionMsg = 'You need a car for this.'; return; }
        AudioSys.pickup();
        this.advance();
      }
    } else if (step.type === 'enterCar') {
      if (G.car) this.advance();
    } else if (step.type === 'kill') {
      const left = G.enemies.filter((e) => e.alive).length;
      G.missionMsg = left + ' left';
      if (left === 0) this.advance();
    } else if (step.type === 'pickup') {
      if (G.pickups.length && dist2d(pp.x, pp.z, G.pickups[0].x, G.pickups[0].z) < 3) {
        AudioSys.pickup();
        this.clearPickup();
        this.advance();
      }
    }
  },

  advance() {
    G.missionStep += 1;
    G.missionMsg = '';
    if (G.missionStep >= G.mission.steps.length) this.complete();
    else this.setupStep();
  },

  complete() {
    const m = G.mission;
    G.cash += m.reward;
    G.missionsDone += 1;
    HUD.showBanner('MISSION PASSED', m.title + ' — +$' + m.reward);
    AudioSys.jingle();
    this.clearPickup();
    G.enemies.forEach((e) => { if (e.mesh) G.scene.remove(e.mesh); });
    G.enemies = [];
    G.mission = null;
    this.save();
    const next = G.missionIndex + 1;
    setTimeout(() => { if (G.state === 'play') this.start(next); }, 2600);
  },

  fail(reason) {
    if (!G.mission) return;
    G.state = 'failed';
    HUD.showBanner('MISSION FAILED', reason + ' — press Enter to retry.');
    AudioSys.fail();
    this.clearPickup();
    G.enemies.forEach((e) => { if (e.mesh) G.scene.remove(e.mesh); });
    G.enemies = [];
    G.setWanted(0);
  },

  retry() {
    G.state = 'play';
    HUD.hideBanner();
    this.start(G.missionIndex);
  },

  save() {
    try {
      const p = G.playerPos();
      localStorage.setItem('solmaris-save-v1', JSON.stringify({
        cash: G.cash, health: G.health, missionIndex: G.missionIndex,
        missionsDone: G.missionsDone, ammo: G.ammo,
        x: p.x, z: p.z, heading: G.playerHeading || 0, wanted: G.wanted,
      }));
    } catch (e) { /* storage unavailable */ }
  },

  load() {
    try {
      const raw = localStorage.getItem('solmaris-save-v1');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },
};
