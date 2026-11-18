// Solmaris — shots: deterministic staged scenes behind ?shot=...&seed=1.
// Each mode plays the real game from a fixed setup, so the screenshots are
// reproducible renders of the game's own code, never composites.
const Shots = {
  stage(mode) {
    const hide = () => { $('title').classList.remove('show'); $('hud').classList.remove('hidden'); };
    const inCar = (car, x, z, heading, speed) => {
      car.x = x; car.z = z; car.heading = heading; car.speed = speed;
      car.mesh.position.set(x, 0, z); car.mesh.rotation.y = heading;
      G.car = car; car.parked = false;
      playerMesh.visible = false;
      G.px = x; G.pz = z; G.playerHeading = heading;
    };
    if (mode === 'title') {
      showTitle();
      return;
    }
    hide();
    AudioSys.init();
    G.state = 'play';
    if (mode === 'drive') {
      // Cover: driving the coupe down the sunset boulevard, traffic around.
      const coupe = G.parked[0];
      inCar(coupe, -30, 0, Math.PI / 2, 30);
      G.camYaw = 0; G.camPitch = 0.3;
      Missions.start(0);
      // Traffic cruising the same boulevard, ahead and behind the player.
      G.traffic.forEach((t, i) => {
        t.ai = { horiz: true, street: 0, lane: (i % 2 ? 2.6 : -2.6), dir: 1, speed: 10 + (i % 3) * 2, wait: 0 };
        t.x = -50 + i * 16; t.z = t.ai.lane; t.heading = Math.PI / 2; t.speed = 10;
        t.mesh.position.set(t.x, 0, t.z);
      });
    } else if (mode === 'mission') {
      // On-foot beach brawl: Rico vs the Shore Rats, pistol out.
      G.car = null; playerMesh.visible = true;
      G.px = -178; G.pz = 8; G.playerHeading = 0; // facing +z: the Rats ahead
      playerMesh.position.set(G.px, 0, G.pz);
      G.weapon = 'pistol'; G.ammo = 12;
      G.camYaw = 0.25; G.camPitch = 0.15;
      Missions.start(2);
      G.missionStep = 1; Missions.setupStep();
      G.enemies.forEach((e, i) => { e.x = -182 + i * 3; e.z = 16 + i * 3; e.mesh.position.set(e.x, 0, e.z); });
    } else if (mode === 'wanted') {
      // Police pursuit at 3 stars: cruisers flanking, helicopter overhead.
      const coupe = G.parked[2];
      inCar(coupe, 20, 40, Math.PI / 2, 26);
      G.camYaw = 0; G.camPitch = 0.3; G.camLift = 2.5; // lift the view so the heli reads in the sky
      heliAngle = Math.PI / 2; // heli ahead of the chase, in frame
      G.setWanted(3);
      const spots = [[8, 6], [-4, -7], [-10, 5], [-16, -4]];
      G.police.forEach((p, i) => {
        p.active = true; p.mesh.visible = true;
        p.x = 20 - spots[i][0]; p.z = 40 + spots[i][1];
        p.heading = Math.PI / 2; p.speed = 26;
        p.mesh.position.set(p.x, 0, p.z);
      });
      Missions.start(5);
      G.missionStep = 0; Missions.setupStep();
    } else {
      // Unknown ?shot= falls back to the title screen.
      showTitle();
    }
    // Let the world settle a few frames, then flag ready for the capturer.
    window.__solmarisReady = false;
    setTimeout(() => { window.__solmarisReady = true; }, 2200);
  },
};
