// Solmaris — people: player mesh, pedestrians, enemies.
// Everyone is built from boxes; walk cycles swing the limbs.
const People = {
  makePersonMesh(shirt, pants, skin) {
    const g = new THREE.Group();
    const shirtM = new THREE.MeshLambertMaterial({ color: shirt });
    const pantsM = new THREE.MeshLambertMaterial({ color: pants });
    const skinM = new THREE.MeshLambertMaterial({ color: skin || 0xd9a077 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirtM);
    torso.position.y = 1.18; torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.36), skinM);
    head.position.y = 1.76; head.castShadow = true; g.add(head);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.38),
      new THREE.MeshLambertMaterial({ color: 0x2a2018 }));
    hair.position.y = 1.98; g.add(hair);
    g.userData.limbs = {};
    const mkLimb = (x, y, w, h, mat) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
      m.position.y = -h / 2; m.castShadow = true;
      pivot.add(m); g.add(pivot);
      return pivot;
    };
    g.userData.limbs.armL = mkLimb(-0.38, 1.5, 0.18, 0.62, skinM);
    g.userData.limbs.armR = mkLimb(0.38, 1.5, 0.18, 0.62, skinM);
    g.userData.limbs.legL = mkLimb(-0.17, 0.82, 0.22, 0.82, pantsM);
    g.userData.limbs.legR = mkLimb(0.17, 0.82, 0.22, 0.82, pantsM);
    return g;
  },

  animateWalk(mesh, phase, speed) {
    const L = mesh.userData.limbs;
    if (!L) return;
    const s = Math.sin(phase) * clamp(speed / 5, 0, 1) * 0.7;
    L.legL.rotation.x = s; L.legR.rotation.x = -s;
    L.armL.rotation.x = -s * 0.8; L.armR.rotation.x = s * 0.8;
  },

  spawnPedestrians(scene, count, rnd) {
    const peds = [];
    const shirts = [0xe8e2d2, 0x3c7ac9, 0xd84a3c, 0x4a9a5a, 0xe8c83c, 0x9a8fb0];
    for (let i = 0; i < count; i += 1) {
      const mesh = this.makePersonMesh(shirts[i % shirts.length], 0x2a2f3a, 0xc98d64 + (i % 3) * 0x111111);
      const street = WORLD.streets[Math.floor(rnd() * WORLD.streets.length)];
      const horiz = rnd() < 0.5;
      const along = -130 + rnd() * 260;
      const side = (rnd() < 0.5 ? -1 : 1) * 7.5;
      const x = horiz ? along : street + side;
      const z = horiz ? street + side : along;
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      peds.push({
        mesh, x, z, heading: rnd() * Math.PI * 2, speed: 1.2 + rnd() * 1.2,
        tx: x, tz: z, wait: 0, phase: rnd() * 6, alive: true, scared: 0,
      });
    }
    return peds;
  },

  updatePedestrians(peds, dt, playerPos) {
    peds.forEach((p) => {
      if (!p.alive) return;
      // Flee from a nearby speeding car or gunfire.
      const pd = playerPos ? dist2d(p.x, p.z, playerPos.x, playerPos.z) : 99;
      if (pd < 6 && G.car && Math.abs(G.car.speed) > 5) p.scared = 2.5;
      if (p.scared > 0) {
        p.scared -= dt;
        const away = Math.atan2(p.x - playerPos.x, p.z - playerPos.z);
        p.heading = angleLerp(p.heading, away, clamp(dt * 4, 0, 1));
        p.x += Math.sin(p.heading) * 4.5 * dt;
        p.z += Math.cos(p.heading) * 4.5 * dt;
        p.phase += dt * 11;
      } else if (p.wait > 0) {
        p.wait -= dt;
      } else {
        const d = dist2d(p.x, p.z, p.tx, p.tz);
        if (d < 1.5) {
          // New sidewalk waypoint.
          const street = WORLD.streets[Math.floor(Math.random() * WORLD.streets.length)];
          const horiz = Math.random() < 0.5;
          const along = -130 + Math.random() * 260;
          const side = (Math.random() < 0.5 ? -1 : 1) * 7.5;
          p.tx = horiz ? along : street + side;
          p.tz = horiz ? street + side : along;
          if (Math.random() < 0.25) p.wait = 1 + Math.random() * 3;
        } else {
          const want = Math.atan2(p.tx - p.x, p.tz - p.z);
          p.heading = angleLerp(p.heading, want, clamp(dt * 3, 0, 1));
          p.x += Math.sin(p.heading) * p.speed * dt;
          p.z += Math.cos(p.heading) * p.speed * dt;
          p.phase += dt * 6;
        }
      }
      p.x = clamp(p.x, -WORLD.bound, WORLD.bound);
      p.z = clamp(p.z, -WORLD.bound, WORLD.bound);
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      this.animateWalk(p.mesh, p.phase, p.scared > 0 ? 5 : p.speed);
    });
  },

  // An enemy NPC: fights back at range with a pistol, or charges to melee.
  makeEnemy(scene, x, z, armed) {
    const mesh = this.makePersonMesh(armed ? 0x3a3f46 : 0x8a2a2a, 0x1c1f26, 0xd9a077);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    // A visible weapon in the hand when armed.
    if (armed) {
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.4),
        new THREE.MeshLambertMaterial({ color: 0x14161a }));
      gun.position.set(0.38, 1.05, 0.3);
      mesh.add(gun);
    }
    return {
      mesh, x, z, heading: 0, health: 100, armed: !!armed,
      shootCd: 1 + Math.random(), phase: 0, alive: true, speed: 3.2,
    };
  },

  updateEnemy(e, dt, playerPos, onShoot) {
    if (!e.alive) return;
    const d = dist2d(e.x, e.z, playerPos.x, playerPos.z);
    const want = Math.atan2(playerPos.x - e.x, playerPos.z - e.z);
    e.heading = angleLerp(e.heading, want, clamp(dt * 5, 0, 1));
    if (e.armed && d > 6 && d < 30) {
      // Strafe at range and shoot.
      e.x += Math.sin(e.heading) * e.speed * 0.5 * dt;
      e.z += Math.cos(e.heading) * e.speed * 0.5 * dt;
      e.shootCd -= dt;
      if (e.shootCd <= 0) {
        e.shootCd = 1.1 + Math.random() * 0.9;
        onShoot(e);
      }
    } else if (d > 2) {
      e.x += Math.sin(e.heading) * e.speed * dt;
      e.z += Math.cos(e.heading) * e.speed * dt;
      e.phase += dt * 8;
    } else {
      // Melee range: shove the player.
      e.phase += dt * 8;
      if (Math.random() < dt * 0.8 && G.state === 'play') {
        G.health = Math.max(0, G.health - 5);
        HUD.flashDamage();
        AudioSys.punch();
      }
    }
    e.mesh.position.set(e.x, 0, e.z);
    e.mesh.rotation.y = e.heading;
    this.animateWalk(e.mesh, e.phase, 3);
  },
};
