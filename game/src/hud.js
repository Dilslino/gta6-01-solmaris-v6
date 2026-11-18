// Solmaris — HUD: health/cash/wanted/speed/objective, live minimap, banners.
const HUD = {
  mm: null, mmCtx: null,

  init() {
    this.mm = $('minimap');
    if (this.mm) this.mmCtx = this.mm.getContext('2d');
  },

  stars(n) {
    let s = '';
    for (let i = 0; i < 5; i += 1) s += i < n ? '★' : '☆';
    return s;
  },

  update() {
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    set('cash', '$' + G.cash);
    set('wanted', this.stars(G.wanted));
    set('speed', G.car ? Math.round(Math.abs(G.car.speed) * 3.6) + ' km/h' : '—');
    set('ammo', G.weapon === 'pistol' ? 'AMMO ' + G.ammo + '/' + G.maxAmmo : 'FISTS');
    const hp = $('healthfill');
    if (hp) hp.style.width = clamp(G.health, 0, 100) + '%';
    const step = Missions.currentStep();
    const obj = $('objective');
    if (obj) {
      if (G.state === 'failed') obj.textContent = 'MISSION FAILED — press Enter to retry';
      else if (G.mission && step) obj.textContent = 'M' + G.mission.id + ' · ' + step.label + (G.missionMsg ? ' — ' + G.missionMsg : '');
      else if (G.missionsDone >= MISSIONS.length) obj.textContent = 'Story complete — free roam Solmaris!';
      else obj.textContent = 'Reach the yellow marker to start the next job';
    }
    const timer = $('timer');
    if (timer) timer.textContent = (G.mission && G.missionTimer > 0) ? '⏱ ' + Math.ceil(G.missionTimer) + 's' : '';
    const hint = $('hint');
    if (hint && !hint.dataset.sticky) hint.textContent = this.contextHint();
    const ch = $('crosshair');
    if (ch) ch.style.display = (G.weapon === 'pistol' && !G.car && G.state === 'play') ? 'block' : 'none';
  },

  contextHint() {
    if (G.state !== 'play') return '';
    if (G.car) return 'W/S drive · Space handbrake · E exit car · M mute';
    if (G.nearCar) return 'E — Steal car';
    return 'WASD move · Shift run · Space jump · F punch · Click shoot · 1/2 weapons · M mute';
  },

  setHint(t) {
    const hint = $('hint');
    if (hint) { hint.textContent = t; hint.dataset.sticky = '1'; setTimeout(() => { delete hint.dataset.sticky; }, 6000); }
  },

  showBanner(title, sub) {
    const b = $('banner');
    if (!b) return;
    $('bannertitle').textContent = title;
    $('bannersub').textContent = sub || '';
    b.classList.add('show');
    clearTimeout(this._bt);
    this._bt = setTimeout(() => this.hideBanner(), 3400);
  },

  hideBanner() { const b = $('banner'); if (b) b.classList.remove('show'); },

  flashDamage() {
    const v = $('damage');
    if (!v) return;
    v.classList.add('show');
    setTimeout(() => v.classList.remove('show'), 220);
  },

  showEnd(kind, text) {
    const o = $('endoverlay');
    if (!o) return;
    $('endtitle').textContent = kind;
    $('endsub').textContent = text;
    o.classList.add('show');
  },

  hideEnd() { const o = $('endoverlay'); if (o) o.classList.remove('show'); },

  // Live minimap: roads, sea, beach, player, cars, police, peds, marker.
  drawMinimap() {
    const c = this.mmCtx;
    if (!c) return;
    const S = 180, scale = S / 520, ox = S / 2, oz = S / 2;
    const X = (x) => ox + x * scale, Z = (z) => oz + z * scale;
    c.fillStyle = '#20242c'; c.fillRect(0, 0, S, S);
    c.fillStyle = '#2e6f8e'; c.fillRect(0, 0, X(-218), S); // sea
    c.fillStyle = '#e8cf9a'; c.fillRect(X(-218), 0, X(-150) - X(-218), S); // sand
    c.fillStyle = '#3c3f46';
    WORLD.streets.forEach((s) => {
      c.fillRect(0, Z(s) - 2, S, 4);
      c.fillRect(X(s) - 2, 0, 4, S);
    });
    c.fillStyle = '#7a6a55'; c.fillRect(0, Z(158), S, S - Z(158)); // harbor
    // Mission marker (pulsing yellow).
    const t = Missions.stepTarget();
    if (t) {
      const p = 3 + Math.sin(G.time * 5) * 1.5;
      c.fillStyle = '#ffd76a';
      c.beginPath(); c.arc(X(t.x), Z(t.z), 4 + p, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ffd76a'; c.beginPath(); c.arc(X(t.x), Z(t.z), 8 + p, 0, Math.PI * 2); c.stroke();
    }
    const dot = (x, z, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(X(x), Z(z), r, 0, Math.PI * 2); c.fill(); };
    G.peds.forEach((p) => { if (p.alive) dot(p.x, p.z, 1.4, '#9aa0aa'); });
    G.traffic.forEach((t2) => dot(t2.x, t2.z, 2.2, '#e8c83c'));
    G.police.forEach((p) => dot(p.x, p.z, 3, G.time % 1 < 0.5 ? '#ff4444' : '#4488ff'));
    G.enemies.forEach((e) => { if (e.alive) dot(e.x, e.z, 2.6, '#ff2222'); });
    // Player arrow.
    const pp = G.playerPos();
    c.save();
    c.translate(X(pp.x), Z(pp.z)); c.rotate(-(G.playerHeading || 0) + Math.PI);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, -6); c.lineTo(4.5, 5); c.lineTo(-4.5, 5); c.closePath(); c.fill();
    c.restore();
  },
};
