// Solmaris — vehicles: car meshes and traffic AI.
// Cars are built from boxes/cylinders; police cars get light bars.
const Vehicles = {
  makeCarMesh(color, isPolice) {
    const g = new THREE.Group();
    const paint = new THREE.MeshLambertMaterial({ color });
    const glass = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
    body.position.y = 0.62; body.castShadow = true; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glass);
    cabin.position.set(0, 1.18, -0.2); cabin.castShadow = true; g.add(cabin);
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
    g.userData.wheels = [];
    [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]].forEach((p) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(p[0], 0.36, p[1]);
      g.add(w); g.userData.wheels.push(w);
    });
    // Headlights (emissive) + taillights.
    const hl = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    [-0.6, 0.6].forEach((x) => {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), hl);
      h.position.set(x, 0.7, 2.21); g.add(h);
    });
    const tl = new THREE.MeshBasicMaterial({ color: 0xff2a22 });
    [-0.6, 0.6].forEach((x) => {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tl);
      t.position.set(x, 0.7, -2.21); g.add(t);
    });
    if (isPolice) {
      const barR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      barR.position.set(-0.4, 1.52, -0.2); g.add(barR);
      const barB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
      barB.position.set(0.4, 1.52, -0.2); g.add(barB);
      g.userData.lightBar = [barR, barB];
    }
    return g;
  },

  // A drivable car: { mesh, x, z, heading, speed, steer, color, isPolice, parked }
  makeCar(x, z, heading, color, isPolice) {
    const mesh = this.makeCarMesh(color, isPolice);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    return {
      mesh, x, z, heading, speed: 0, steer: 0, color,
      isPolice: !!isPolice, parked: false, ai: null, stuck: 0,
    };
  },

  // Traffic cars drive straight along a street, flip at the ends, and
  // brake when something is ahead in their lane.
  spawnTraffic(scene, count, rnd) {
    const cars = [];
    const colors = [0xd84a3c, 0x3c7ac9, 0xe8c83c, 0x4a9a5a, 0xe8e2d2, 0xc96a3c, 0x9a8fb0];
    for (let i = 0; i < count; i += 1) {
      const horiz = rnd() < 0.5;
      const street = WORLD.streets[Math.floor(rnd() * WORLD.streets.length)];
      const lane = (rnd() < 0.5 ? -1 : 1) * 2.6;
      const along = -130 + rnd() * 260;
      const dir = rnd() < 0.5 ? 1 : -1;
      const car = this.makeCar(
        horiz ? along : street + lane, horiz ? street + lane : along,
        horiz ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
        colors[i % colors.length], false);
      car.ai = { horiz, street, lane, dir, speed: 8 + rnd() * 4, wait: 0 };
      scene.add(car.mesh);
      cars.push(car);
    }
    return cars;
  },

  updateTraffic(cars, dt, allCars) {
    cars.forEach((c) => {
      if (!c.ai) return;
      const ai = c.ai;
      // Car ahead in same lane?
      let blocked = false;
      const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
      allCars.forEach((o) => {
        if (o === c || o.parked) return;
        const dx = o.x - c.x, dz = o.z - c.z;
        const ahead = dx * fx + dz * fz;
        const side = Math.abs(dx * fz - dz * fx);
        if (ahead > 0 && ahead < 9 && side < 2.4) blocked = true;
      });
      const target = blocked ? 0 : ai.speed;
      c.speed = lerp(c.speed, target, clamp(dt * 1.5, 0, 1));
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      // Flip at the end of the street.
      const along = ai.horiz ? c.x : c.z;
      if (along > 138 || along < -138) {
        ai.dir *= -1;
        c.heading += Math.PI;
        if (ai.horiz) c.x = clamp(c.x, -136, 136); else c.z = clamp(c.z, -136, 136);
      }
      // Beach cars never happen: clamp traffic to downtown.
      c.x = clamp(c.x, -140, 140); c.z = clamp(c.z, -140, 140);
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      c.mesh.userData.wheels.forEach((w) => { w.rotation.x += c.speed * dt * 2; });
    });
  },

  // Arcade driving: speed-sensitive steering, strong grip, no spin-out.
  // A full-speed U-turn stays planted: turn rate is capped and scales down
  // as speed rises, and the car never slides sideways except on handbrake.
  driveCar(car, input, dt) {
    const fwd = input.forward ? 1 : 0;
    const back = input.back ? 1 : 0;
    const maxF = 38, maxR = 12;
    if (fwd) car.speed += 16 * dt;
    if (back) car.speed -= (car.speed > 0.5 ? 34 : 14) * dt;
    if (!fwd && !back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
    if (input.handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
    car.speed = clamp(car.speed, -maxR, maxF);
    if (Math.abs(car.speed) < 0.05 && !fwd && !back) car.speed = 0;
    // Steering: less lock at speed, capped turn rate, sign flips in reverse.
    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    car.steer = lerp(car.steer, steerTarget, clamp(dt * 8, 0, 1));
    const spd = Math.abs(car.speed);
    const turnRate = car.steer * clamp(1.9 - spd * 0.032, 0.55, 1.9) * (input.handbrake ? 1.5 : 1);
    car.heading += turnRate * Math.sign(car.speed || 1) * dt * clamp(spd / 6, 0, 1);
    // Handbrake drift: slight slide, still controllable.
    const slide = input.handbrake ? 0.25 : 0;
    const hx = Math.sin(car.heading), hz = Math.cos(car.heading);
    car.x += hx * car.speed * dt;
    car.z += hz * car.speed * dt;
    if (slide) { car.x += Math.cos(car.heading) * car.steer * spd * slide * dt * 0.4; car.z -= Math.sin(car.heading) * car.steer * spd * slide * dt * 0.4; }
    car.x = clamp(car.x, -WORLD.bound, WORLD.bound);
    car.z = clamp(car.z, -WORLD.bound, WORLD.bound);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    car.mesh.userData.wheels.forEach((w) => { w.rotation.x += car.speed * dt * 2; });
    return car.speed;
  },

  collideCarWorld(car) {
    // Push the car out of building AABBs, sliding along the wall.
    G.colliders.forEach((b) => {
      const nx = clamp(car.x, b.x0, b.x1), nz = clamp(car.z, b.z0, b.z1);
      const dx = car.x - nx, dz = car.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < 2.4 * 2.4) {
        const d = Math.sqrt(d2) || 0.001;
        const push = (2.4 - d);
        if (d2 > 0.0001) { car.x += (dx / d) * push; car.z += (dz / d) * push; }
        else { car.x += 2.4; }
        car.speed *= 0.55;
      }
    });
  },
};
