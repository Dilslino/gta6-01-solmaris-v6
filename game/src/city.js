// Solmaris — city: builds the coastal sunset city from primitives.
// Beach + boardwalk (west), downtown grid (centre), hills (north),
// harbor (south), bridge + canal (east), marina (south-east).
const City = {
  parkedSpots: [], garagePos: { x: -60, z: 84 },

  windowTexture(base, lit) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 64, 128);
    const rnd = mulberry32(base.length * 977 + lit);
    for (let y = 8; y < 120; y += 14) {
      for (let x = 6; x < 58; x += 12) {
        g.fillStyle = rnd() < 0.45 ? '#ffd98a' : '#2c3550';
        g.fillRect(x, y, 8, 9);
      }
    }
    const t = new THREE.CanvasTexture(c);
    return t;
  },

  build(scene, seed) {
    const rnd = mulberry32(seed || 7);
    const colliders = G.colliders;
    const addBox = (x, y, z, w, h, d, color, opts) => {
      const mat = opts && opts.map ? new THREE.MeshLambertMaterial({ map: opts.map })
        : new THREE.MeshLambertMaterial({ color });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = !!(opts && opts.shadow);
      m.receiveShadow = true;
      scene.add(m);
      return m;
    };
    const addCollider = (x, z, hw, hd) => colliders.push({ x0: x - hw, z0: z - hd, x1: x + hw, z1: z + hd });

    // --- Sky, sun, fog (sunset) ---
    scene.background = new THREE.Color(0xff9a5c);
    scene.fog = new THREE.Fog(0xff9a5c, 180, 520);
    const hemi = new THREE.HemisphereLight(0xffd9a0, 0x3a2b4a, 0.85);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffb36b, 1.9);
    sun.position.set(-160, 90, -120);
    sun.castShadow = !G.noShadow;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -220; sun.shadow.camera.right = 220;
    sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
    sun.shadow.camera.far = 600;
    scene.add(sun);
    // Low sun disc on the horizon over the sea.
    const disc = new THREE.Mesh(new THREE.CircleGeometry(26, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
    disc.position.set(-330, 42, -40); disc.lookAt(0, 42, -40); scene.add(disc);

    // --- Ground, sea, sand ---
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560),
      new THREE.MeshLambertMaterial({ color: 0x8a7f6a }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(160, 560),
      new THREE.MeshLambertMaterial({ color: 0x2e6f8e }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(-300, 0.15, 0); scene.add(sea);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(70, 560),
      new THREE.MeshLambertMaterial({ color: 0xe8cf9a }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(-184, 0.12, 0); sand.receiveShadow = true; scene.add(sand);
    // Canal (east) under the bridge.
    const canal = new THREE.Mesh(new THREE.PlaneGeometry(36, 130),
      new THREE.MeshLambertMaterial({ color: 0x2e6f8e }));
    canal.rotation.x = -Math.PI / 2; canal.position.set(168, 0.14, 0); scene.add(canal);

    // --- Roads + sidewalks (downtown grid) ---
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x3c3f46 });
    const walkMat = new THREE.MeshLambertMaterial({ color: 0xb9ac93 });
    WORLD.streets.forEach((s) => {
      const h = new THREE.Mesh(new THREE.PlaneGeometry(290, 10), roadMat);
      h.rotation.x = -Math.PI / 2; h.position.set(0, 0.2, s); h.receiveShadow = true; scene.add(h);
      const v = new THREE.Mesh(new THREE.PlaneGeometry(10, 290), roadMat);
      v.rotation.x = -Math.PI / 2; v.position.set(s, 0.2, 0); v.receiveShadow = true; scene.add(v);
      const hs = new THREE.Mesh(new THREE.PlaneGeometry(290, 13), walkMat);
      hs.rotation.x = -Math.PI / 2; hs.position.set(0, 0.16, s); scene.add(hs);
      const vs = new THREE.Mesh(new THREE.PlaneGeometry(13, 290), walkMat);
      vs.rotation.x = -Math.PI / 2; vs.position.set(s, 0.16, 0); scene.add(vs);
    });
    // Boardwalk (wooden strip along the beach).
    const bw = new THREE.Mesh(new THREE.PlaneGeometry(12, 260),
      new THREE.MeshLambertMaterial({ color: 0xa97c50 }));
    bw.rotation.x = -Math.PI / 2; bw.position.set(-146, 0.22, 0); bw.receiveShadow = true; scene.add(bw);
    // Bridge deck over the canal.
    const deck = new THREE.Mesh(new THREE.BoxGeometry(52, 1.2, 16),
      new THREE.MeshLambertMaterial({ color: 0x6b6f78 }));
    deck.position.set(168, 2.2, 0); deck.castShadow = true; deck.receiveShadow = true; scene.add(deck);
    const deckRoad = new THREE.Mesh(new THREE.PlaneGeometry(52, 10), roadMat);
    deckRoad.rotation.x = -Math.PI / 2; deckRoad.position.set(168, 2.85, 0); scene.add(deckRoad);
    addBox(168, 3.6, -8.6, 52, 1.2, 0.8, 0xd8d3c8);
    addBox(168, 3.6, 8.6, 52, 1.2, 0.8, 0xd8d3c8);
    // Ramps onto the bridge.
    const rampW = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 12), roadMat);
    rampW.rotation.z = 0.16; rampW.position.set(136, 1.2, 0); scene.add(rampW);
    const rampE = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 12), roadMat);
    rampE.rotation.z = -0.16; rampE.position.set(200, 1.2, 0); scene.add(rampE);

    // --- Downtown buildings ---
    const palette = ['#e8dcc8', '#d9a06b', '#7fa8c9', '#c97b6b', '#9a8fb0', '#e0b56a', '#8fb0a0'];
    const texA = this.windowTexture('#e8dcc8', 1);
    const texB = this.windowTexture('#7fa8c9', 2);
    const texC = this.windowTexture('#c97b6b', 3);
    const texs = [texA, texB, texC];
    const blockCentres = [];
    for (let i = 0; i < WORLD.streets.length - 1; i += 1) {
      for (let j = 0; j < WORLD.streets.length - 1; j += 1) {
        blockCentres.push({ x: (WORLD.streets[i] + WORLD.streets[i + 1]) / 2, z: (WORLD.streets[j] + WORLD.streets[j + 1]) / 2 });
      }
    }
    blockCentres.forEach((b, idx) => {
      if (b.x < -130 || Math.abs(b.x) < 14 && Math.abs(b.z) < 14) return; // keep plaza open
      const n = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k += 1) {
        const w = 10 + rnd() * 12, d = 10 + rnd() * 12;
        const h = 8 + rnd() * rnd() * 46;
        const ox = (k % 2 === 0 ? -1 : 1) * (rnd() * 6);
        const oz = (k < 2 ? -1 : 1) * (rnd() * 6);
        const x = b.x + ox, z = b.z + oz;
        if (Math.abs(x) > 142 || Math.abs(z) > 142) return;
        const mat = new THREE.MeshLambertMaterial({ map: texs[idx % 3], color: palette[idx % palette.length] });
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true;
        scene.add(m);
        // Rooftop box.
        if (rnd() < 0.5) addBox(x, h + 1, z, 4, 2, 4, 0x555a63);
        addCollider(x, z, w / 2 + 0.4, d / 2 + 0.4);
      }
    });
    // Plaza fountain (centre).
    const fountain = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.5, 1.2, 20),
      new THREE.MeshLambertMaterial({ color: 0x9fc4d8 }));
    fountain.position.set(0, 0.6, 0); scene.add(fountain);
    addCollider(0, 0, 5.5, 5.5);

    // --- Mara's garage (mission 1 destination) ---
    addBox(-60, 3, 84, 22, 6, 14, 0x8a5a3c, { shadow: true });
    addBox(-60, 6.6, 84, 24, 1, 16, 0x5a3a28);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 0.6),
      new THREE.MeshBasicMaterial({ color: 0xffd76a }));
    sign.position.set(-60, 5.2, 76.6); scene.add(sign);
    addCollider(-60, 84, 11, 7);

    // --- Palms along beach + boardwalk ---
    const palm = (x, z) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6),
        new THREE.MeshLambertMaterial({ color: 0x7a5230 }));
      trunk.position.set(x, 3.5, z); trunk.castShadow = true; scene.add(trunk);
      for (let i = 0; i < 5; i += 1) {
        const fr = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.6, 4),
          new THREE.MeshLambertMaterial({ color: 0x3f7a44 }));
        const a = (i / 5) * Math.PI * 2;
        fr.position.set(x + Math.cos(a) * 1.4, 7.1, z + Math.sin(a) * 1.4);
        fr.rotation.z = Math.cos(a) * 1.25; fr.rotation.x = -Math.sin(a) * 1.25;
        scene.add(fr);
      }
    };
    for (let z = -130; z <= 130; z += 26) { palm(-156, z + 4); if (z % 52 === 0) palm(-172, z - 8); }

    // Beach umbrellas + lifeguard tower (the mission-3 fight happens here).
    const umbrella = (x, z, color) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6),
        new THREE.MeshLambertMaterial({ color: 0xe8e2d2 }));
      pole.position.set(x, 1.3, z); scene.add(pole);
      const top = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.1, 8),
        new THREE.MeshLambertMaterial({ color }));
      top.position.set(x, 2.9, z); top.castShadow = true; scene.add(top);
    };
    umbrella(-186, 44, 0xd84a3c); umbrella(-172, -32, 0x3c7ac9); umbrella(-192, 64, 0xe8c83c);
    addBox(-190, 2.5, 8, 4, 5, 4, 0xe8e2d2, { shadow: true }); // lifeguard tower
    addBox(-190, 5.4, 8, 4.5, 0.6, 4.5, 0xd84a3c);
    addCollider(-190, 8, 2, 2);

    // --- Streetlights ---
    const lamp = (x, z) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6, 6),
        new THREE.MeshLambertMaterial({ color: 0x33363d }));
      pole.position.set(x, 3, z); scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      bulb.position.set(x, 6.2, z); scene.add(bulb);
    };
    WORLD.streets.forEach((s) => { lamp(s + 7, -128); lamp(s - 7, 128); lamp(-128, s + 7); lamp(128, s - 7); });

    // --- Hills (north) ---
    for (let i = 0; i < 7; i += 1) {
      const hx = -180 + i * 60 + rnd() * 20;
      const hill = new THREE.Mesh(new THREE.ConeGeometry(34 + rnd() * 22, 26 + rnd() * 22, 8),
        new THREE.MeshLambertMaterial({ color: 0x6a7a52 }));
      hill.position.set(hx, 8, -185 - rnd() * 25); scene.add(hill);
    }
    // Hilltop lookout (mission 2 drop 3).
    addBox(-100, 1, -140, 10, 2, 10, 0x9a8a72);
    addCollider(-100, -140, 5, 5);

    // --- Harbor (south): docks, containers, warehouse, boats ---
    const dock = new THREE.Mesh(new THREE.BoxGeometry(220, 1.5, 26),
      new THREE.MeshLambertMaterial({ color: 0x7a6a55 }));
    dock.position.set(0, 0.75, 172); dock.receiveShadow = true; scene.add(dock);
    const contColors = [0xc96a3c, 0x3c7ac9, 0x4a9a5a, 0xc9a83c];
    for (let i = 0; i < 10; i += 1) {
      const cx = -90 + (i % 5) * 22, cz = 166 + Math.floor(i / 5) * 9;
      addBox(cx, 2.5, cz, 12, 5, 6, contColors[i % 4], { shadow: true });
      addCollider(cx, cz, 6, 3);
    }
    addBox(100, 4, 178, 26, 8, 16, 0x8a8f96, { shadow: true });
    addCollider(100, 178, 13, 8);
    // Boats bobbing in the harbor water.
    for (let i = 0; i < 4; i += 1) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 4),
        new THREE.MeshLambertMaterial({ color: 0xe8e2d2 }));
      hull.position.y = 0.4; boat.add(hull);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 3),
        new THREE.MeshLambertMaterial({ color: 0x3c6a8a }));
      cab.position.set(-1, 2, 0); boat.add(cab);
      boat.position.set(-60 + i * 40, 0.2, 196);
      scene.add(boat);
    }
    // Marina yacht (mission 6 finale).
    const yacht = new THREE.Group();
    const yHull = new THREE.Mesh(new THREE.BoxGeometry(18, 3, 6),
      new THREE.MeshLambertMaterial({ color: 0xf2ead8 }));
    yHull.position.y = 1; yacht.add(yHull);
    const yTop = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 5),
      new THREE.MeshLambertMaterial({ color: 0xd8cfb8 }));
    yTop.position.set(-2, 3.6, 0); yacht.add(yTop);
    yacht.position.set(150, 0.2, 150); scene.add(yacht);

    // --- Parked cars spots (stealable) ---
    this.parkedSpots = [
      { x: 24, z: -8, heading: 0, color: 0xd84a3c },   // mission 1 coupe
      { x: -132, z: -44, heading: Math.PI / 2, color: 0x3c7ac9 }, // mission 4 nearby car
      { x: 44, z: 40, heading: Math.PI, color: 0xe8c83c },
      { x: -44, z: -40, heading: -Math.PI / 2, color: 0x4a9a5a },
      { x: 84, z: -84, heading: 0, color: 0x9a8fb0 },
      { x: -84, z: 120, heading: Math.PI / 2, color: 0xe8e2d2 },
      { x: 120, z: 84, heading: Math.PI, color: 0x3c3f46 },
      { x: -40, z: -120, heading: 0, color: 0xc96a3c },
    ];
    return { colliders };
  },
};
