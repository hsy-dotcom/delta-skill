/* ───────── 게임: 상태 · 이동 · 문 · 적 AI · 전투 ───────── */
const EYE = .45, STEP = .27, HEAD = .5, PR = .22;
const P = {};
const G = { state: 'loading', time: 0, gameTime: 0, kills: 0, totalKills: 0, itemsTaken: 0, totalItems: 0, deathT: 0, winT: 0,
  switchOn: false, automap: false, flowT: 0, shake: 0, dmgA: 0, pickA: 0, flash: 0, mapDirty: false, map1Dirty: false, nukT: 0, ready: false };
let enemies = [], barrels = [], items = [], decor = [], shots = [], parts = [], fxs = [], doorCells = [], MAPD = null, LMAP = null;
const flow = new Int16Array(MW * MH);
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function resetGame() {
  buildLevel();
  MAPD = mapData(); G.mapDirty = G.map1Dirty = true;
  doorCells = CELLS.filter(c => c.door);
  enemies = []; barrels = []; items = []; decor = []; shots = []; parts = []; fxs = [];
  Object.assign(P, { x: 4.5, y: 21.5, a: -Math.PI / 2, fz: 0, z: EYE, hp: 100, armor: 0, bullets: 50, shells: 0, hasShotgun: false, weapon: 0, key: false,
    cool: 0, fireT: 0, bob: 0, move: 0, dead: false, swap: 0, r: PR, lastHurt: 0 });
  setSeed(777);
  for (const s of SPAWNS) {
    const fz = floorAt(s.x, s.y);
    if (s.ch === 'P') { P.x = s.x; P.y = s.y; P.fz = fz; }
    else if (s.ch === 'i' || s.ch === 'z') {
      const imp = s.ch === 'i';
      enemies.push({ type: imp ? 'imp' : 'demon', x: s.x, y: s.y, fz, a: rnd() * TAU, hp: imp ? 60 : 130, speed: imp ? 1.5 : 2.7, r: imp ? .3 : .36,
        awake: false, cool: 0, pain: 0, atk: 0, atkHit: 0, hit: false, melee: false, walk: 0, dead: false, deadT: 0, flash: 0 });
    }
    else if (s.ch === 'b') barrels.push({ x: s.x, y: s.y, fz, hp: 20, alive: true, fuse: 0, r: .26 });
    else items.push({ k: s.ch, x: s.x, y: s.y, fz, taken: false, ph: rnd() * TAU });
  }
  for (const d of DECOR) decor.push({ k: d.k, x: d.x, y: d.y, fz: floorAt(d.x, d.y), r: d.k === 'marine' ? 0 : .16 });
  G.totalKills = enemies.length; G.totalItems = items.length;
  Object.assign(G, { kills: 0, itemsTaken: 0, gameTime: 0, deathT: 0, winT: 0, switchOn: false, automap: false, shake: 0, dmgA: 0, pickA: 0, flash: 0, nukT: 0, flowT: 0 });
  resetDecals();
  addDecal(9.6, 13.45, 0, 0, 0, 1, .55, 2);
  buildFlow();
}

/* 이동 · 충돌 (높이 고려) */
function canEnter(fz, x, y, r) {
  for (let k = 0; k < 4; k++) {
    const c = cellAt(x + (k & 1 ? r : -r), y + (k & 2 ? r : -r));
    if (!isOpen(c) || c.window || c.h0 - fz > STEP || c.h1 - Math.max(c.h0, fz) < HEAD) return false;
  }
  return true;
}
function footFloor(x, y, r) { let m = -9; for (let k = 0; k < 4; k++) { const c = cellAt(x + (k & 1 ? r : -r), y + (k & 2 ? r : -r)); if (isOpen(c)) m = Math.max(m, c.h0); } return m < -8 ? 0 : m; }
function bodyBlocked(o, nx, ny) {
  const test = (b, br) => { const d0 = Math.hypot(o.x - b.x, o.y - b.y), d1 = Math.hypot(nx - b.x, ny - b.y); return d1 < o.r + br && d1 < d0; };
  for (const b of barrels) if (b.alive && test(b, b.r)) return true;
  for (const d of decor) if (d.r && test(d, d.r)) return true;
  for (const e of enemies) if (e !== o && !e.dead && test(e, e.r)) return true;
  if (o !== P && !P.dead && test(P, PR)) return true;
  return false;
}
function moveBody(o, mx, my, r) {
  let moved = false;
  if (mx && canEnter(o.fz, o.x + mx, o.y, r) && !bodyBlocked(o, o.x + mx, o.y)) { o.x += mx; moved = true; }
  if (my && canEnter(o.fz, o.x, o.y + my, r) && !bodyBlocked(o, o.x, o.y + my)) { o.y += my; moved = true; }
  return moved;
}

/* 경로: 플레이어 칸에서 퍼져 나가는 거리장 (잠기지 않은 닫힌 문은 통과 가능으로 본다) */
function walkable(c) { return c && !c.window && (isOpen(c) || (c.door && !c.door.locked)); }
function buildFlow() {
  flow.fill(-1);
  const s = Math.floor(P.y) * MW + Math.floor(P.x); if (!walkable(CELLS[s])) return;
  const q = [s]; flow[s] = 0;
  for (let i = 0; i < q.length; i++) {
    const ci = q[i], cx = ci % MW, cy = (ci / MW) | 0, c = CELLS[ci];
    for (const [ox, oy] of DIRS4) {
      const nx = cx + ox, ny = cy + oy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      const n = ny * MW + nx, nc = CELLS[n];
      if (flow[n] >= 0 || !walkable(nc) || c.h0 - nc.h0 > STEP) continue;
      flow[n] = flow[ci] + 1; q.push(n);
    }
  }
}
function nextStep(e) {
  const cx = Math.floor(e.x), cy = Math.floor(e.y), c = flow[cy * MW + cx]; if (c < 0) return null;
  let best = c, bx = -1, by = -1;
  for (const [ox, oy] of DIRS4) { const nx = cx + ox, ny = cy + oy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue; const n = flow[ny * MW + nx]; if (n >= 0 && n < best) { best = n; bx = nx; by = ny; } }
  if (bx < 0) return [P.x, P.y, null];
  return [bx + .5, by + .5, CELLS[by * MW + bx]];
}

/* 문 */
function openDoor(c, silent) {
  if (c.door.moving || c.door.open >= 1) return;
  c.door.moving = true;
  if (!silent) sfx('door', vol(c.x + .5, c.y + .5));
}
function updateDoors(dt) {
  for (const c of doorCells) if (c.door.moving) {
    c.door.open = Math.min(1, c.door.open + dt / .9);
    c.h1 = c.door.h0 + (c.door.hOpen - c.door.h0) * (1 - (1 - c.door.open) ** 2);
    MAPD.m0[(c.y * MW + c.x) * 4 + 1] = c.h1; G.mapDirty = true;
    if (c.door.open >= 1) { c.door.moving = false; buildFlow(); }
    if (!RM) G.shake = Math.max(G.shake, .05);
  }
}
function use() {
  if (P.dead) return;
  const cx = Math.cos(P.a), cy = Math.sin(P.a);
  for (let t = .3; t <= 1.5; t += .1) {
    const c = cellAt(P.x + cx * t, P.y + cy * t);
    if (!c) return;
    if (c.door) {
      if (c.door.open >= 1 || c.door.moving) { if (isOpen(c) && c.h1 - c.h0 > HEAD) continue; return; }
      if (c.door.locked && !P.key) { sfx('locked'); say('봉쇄문이다. 빨간 키카드가 필요하다.'); return; }
      openDoor(c); say(c.door.locked ? '키카드 인증. 봉쇄문이 열린다.' : '문이 열린다.'); return;
    }
    if (c.solid) {
      if (c.ch === 'X' && !G.switchOn) {
        G.switchOn = true; sfx('switch'); G.winT = 1.3; say('출구 스위치 작동. 탈출한다!');
        for (const x of CELLS) if (x.ch === 'X') { x.side = x.lower = TX.SWON; MAPD.m1[(x.y * MW + x.x) * 4] = MAPD.m1[(x.y * MW + x.x) * 4 + 1] = TX.SWON; }
        G.map1Dirty = true;
      } else sfx('oof');
      return;
    }
  }
}

/* 전투 */
function wake(e, silent) { if (e.awake) return; e.awake = true; e.cool = .6 + Math.random() * .6; if (!silent) sfx('sight', vol(e.x, e.y)); }
function alertByNoise() {
  for (const e of enemies) { if (e.dead || e.awake) continue; const f = flow[Math.floor(e.y) * MW + Math.floor(e.x)]; if (f >= 0 && f <= 14) wake(e); }
}
function hurtEnemy(e, d, fromX, fromY) {
  if (e.dead) return;
  e.hp -= d; e.flash = .1; wake(e, true);
  bloodBurst(e.x, e.y, e.fz + .55, 6 + d / 3, fromX, fromY);
  if (Math.random() < .35) addDecal(e.x + rr(-.25, .25), e.y + rr(-.25, .25), e.fz, 0, 0, 1, rr(.12, .22), 2);
  if (e.hp <= 0) {
    e.dead = true; e.deadT = 0; e.atk = 0; G.kills++;
    sfx(e.type === 'imp' ? 'impdie' : 'demondie', vol(e.x, e.y));
    setTimeout(() => addDecal(e.x + .05, e.y, e.fz, 0, 0, 1, e.type === 'imp' ? .5 : .6, 2), 450);
  } else if (Math.random() < (e.type === 'imp' ? .6 : .5)) { e.pain = .24; e.atk = 0; sfx('pain', vol(e.x, e.y)); }
}
function hurtBarrel(b, d) { if (!b.alive || b.fuse > 0) return; b.hp -= d; sparkBurst(b.x, b.y, b.fz + .3, 4); if (b.hp <= 0) b.fuse = .12; }
function explode(b) {
  b.alive = false;
  const z = b.fz + .3;
  explosionFx(b.x, b.y, z, 1.6);
  sfx('boom', vol(b.x, b.y)); if (!RM) G.shake = Math.max(G.shake, .45);
  addDecal(b.x, b.y, b.fz, 0, 0, 1, .95, 3);
  const Rr = 3;
  for (const e of enemies) { const d = Math.hypot(e.x - b.x, e.y - b.y); if (!e.dead && d < Rr && segClear(b.x, b.y, z, e.x, e.y, e.fz + .5)) hurtEnemy(e, Math.round(110 * (1 - d / Rr)), b.x, b.y); }
  for (const o of barrels) { const d = Math.hypot(o.x - b.x, o.y - b.y); if (o.alive && d < Rr) hurtBarrel(o, 100); }
  const d = Math.hypot(P.x - b.x, P.y - b.y); if (d < Rr && segClear(b.x, b.y, z, P.x, P.y, P.z)) hurt(90 * (1 - d / Rr), b.x, b.y);
}
function hitscan(ang, dmg) {
  const cx = Math.cos(ang), cy = Math.sin(ang), ez = P.z - .04;
  const wh = rayHit(P.x, P.y, ez, cx, cy, 40);
  let best = null, bt = wh.d;
  const consider = t => {
    const ox = t.x - P.x, oy = t.y - P.y, along = ox * cx + oy * cy;
    if (along <= 0 || along >= bt || Math.abs(ox * cy - oy * cx) >= t.r) return;
    if (!segClear(P.x, P.y, ez, t.x, t.y, t.fz + .45)) return;
    best = t; bt = along;
  };
  enemies.forEach(e => { if (!e.dead) consider(e); });
  barrels.forEach(b => { if (b.alive) consider(b); });
  const hx = P.x + cx * bt, hy = P.y + cy * bt;
  if (best && best.type) {
    hurtEnemy(best, dmg, P.x, P.y);
    if (wh.cell && wh.d - bt < 1.3 && Math.random() < .6) addDecal(P.x + cx * (wh.d - .002), P.y + cy * (wh.d - .002), ez + rr(-.1, .15), wh.nx, wh.ny, 0, rr(.08, .16), 2, wh.open);
  } else if (best) { hurtBarrel(best, dmg); }
  else if (wh.cell) {
    const px = P.x + cx * (wh.d - .002), py = P.y + cy * (wh.d - .002), pz = ez + rr(-.04, .04);
    addDecal(px, py, pz, wh.nx, wh.ny, 0, rr(.05, .07), 1, wh.open);
    impactFx(px, py, pz, wh.nx, wh.ny);
  }
  return [hx, hy];
}
function tryFire() {
  if (P.cool > 0 || P.dead || P.swap > 0) return;
  if (P.weapon === 1 && P.shells <= 0) { switchWeapon(0); say('샷건 탄이 떨어졌다.'); return; }
  if (P.weapon === 0 && P.bullets <= 0) { if (P.hasShotgun && P.shells > 0) switchWeapon(1); else { sfx('click'); P.cool = .35; } return; }
  if (P.weapon === 0) { P.bullets--; P.cool = .34; P.fireT = .2; sfx('pistol'); hitscan(P.a + (Math.random() - .5) * .035, 6 + Math.random() * 9 | 0); ejectShell(false); }
  else { P.shells--; P.cool = .95; P.fireT = .95; sfx('shotgun'); for (let i = 0; i < 7; i++) hitscan(P.a + (Math.random() - .5) * .19, 6 + Math.random() * 9 | 0); setTimeout(() => ejectShell(true), 450); }
  G.flash = 1; alertByNoise();
}
function switchWeapon(w) { if (w === P.weapon || (w === 1 && !P.hasShotgun)) return; P.weapon = w; P.swap = .3; P.cool = Math.max(P.cool, .3); sfx('weapon'); }
function hurt(d, fx0, fy0) {
  if (P.dead || G.state !== 'play') return;
  d = Math.round(d); if (d <= 0) return;
  if (P.armor > 0) { const save = Math.min(P.armor, Math.floor(d / 3)); P.armor -= save; d -= save; }
  P.hp = Math.max(0, P.hp - d); P.lastHurt = G.time;
  G.dmgA = Math.min(1, G.dmgA + .25 + d / 30); faceOuch = .6;
  if (fx0 !== undefined) { const lat = (fx0 - P.x) * -Math.sin(P.a) + (fy0 - P.y) * Math.cos(P.a); faceLook = lat > .2 ? 1 : lat < -.2 ? -1 : 0; faceLookT = 1; }
  if (!RM) G.shake = Math.max(G.shake, .15);
  if (P.hp <= 0) { P.dead = true; G.deathT = 0; sfx('die'); } else sfx('hurt');
}
function take(it) {
  let m = '';
  switch (it.k) {
    case 'h': if (P.hp >= 100) return; P.hp = Math.min(100, P.hp + 25); m = '의료 키트를 획득했다.'; break;
    case 'a': if (P.bullets >= 200 && P.shells >= 50) return; P.bullets = Math.min(200, P.bullets + 20); P.shells = Math.min(50, P.shells + 4); m = '탄약 상자를 획득했다.'; break;
    case 'r': if (P.armor >= 100) return; P.armor = 100; m = '전투 방호복을 획득했다.'; break;
    case 'k': P.key = true; m = '빨간 키카드를 획득했다.'; break;
    case 'g': P.hasShotgun = true; P.shells = Math.min(50, P.shells + 8); switchWeapon(1); m = '샷건을 획득했다!'; faceGrin = 1.6; break;
  }
  it.taken = true; G.itemsTaken++; sfx(it.k === 'g' ? 'weapon' : 'pickup'); G.pickA = 1; say(m);
}

/* 적 AI */
function updateEnemy(e, dt) {
  e.flash = Math.max(0, e.flash - dt);
  if (e.dead) { e.deadT += dt; return; }
  const dx = P.x - e.x, dy = P.y - e.y, dist = Math.hypot(dx, dy);
  const see = !P.dead && dist < 18 && segClear(e.x, e.y, e.fz + .72, P.x, P.y, P.z);
  if (!e.awake) { if (see && dist < 14) wake(e); return; }
  e.cool -= dt;
  if (e.pain > 0) { e.pain -= dt; return; }
  if (e.atk > 0) {
    e.atk -= dt; e.a = Math.atan2(dy, dx);
    if (!e.hit && e.atk <= e.atkHit) {
      e.hit = true;
      if (e.type === 'imp' && !e.melee) {
        const sz = e.fz + .82, tz = P.z - .12, d3 = Math.hypot(dx, dy, tz - sz) || 1, sp = 7;
        shots.push({ x: e.x + dx / dist * .4, y: e.y + dy / dist * .4, z: sz, vx: dx / d3 * sp, vy: dy / d3 * sp, vz: (tz - sz) / d3 * sp, life: 4 });
        sfx('impfire', vol(e.x, e.y));
      } else if (dist < 1.45 && Math.abs(P.fz - e.fz) < .5) { sfx('bite', vol(e.x, e.y)); hurt(e.type === 'imp' ? 6 + Math.random() * 8 : 8 + Math.random() * 12, e.x, e.y); }
    }
    return;
  }
  if (P.dead) return;
  const imp = e.type === 'imp';
  if (imp) {
    if (dist < 1.1 && e.cool <= 0) { e.atk = .5; e.atkHit = .25; e.hit = false; e.melee = true; e.cool = 1; }
    else if (see && dist < 16 && e.cool <= 0 && Math.random() < dt * 1.4) { e.atk = .75; e.atkHit = .35; e.hit = false; e.melee = false; e.cool = 1.4 + Math.random() * 1.2; }
  } else if (dist < 1.3 && e.cool <= 0) { e.atk = .5; e.atkHit = .22; e.hit = false; e.cool = .9; }
  if (e.atk > 0) return;
  if (dist > (imp ? .9 : .8)) {
    let tx, ty;
    if (see) { tx = P.x; ty = P.y; }
    else { const n = nextStep(e); if (!n) return; [tx, ty] = n; if (n[2] && n[2].door && !isOpen(n[2]) && !n[2].door.locked) openDoor(n[2]); }
    const mx = tx - e.x, my = ty - e.y, ml = Math.hypot(mx, my) || 1, sp = e.speed * dt, ox = e.x, oy = e.y;
    moveBody(e, mx / ml * sp, my / ml * sp, .26);
    const mv = Math.hypot(e.x - ox, e.y - oy);
    e.walk += mv;
    if (mv > 1e-4) { const want = Math.atan2(e.y - oy, e.x - ox); let d = ((want - e.a + Math.PI) % TAU + TAU) % TAU - Math.PI; e.a += d * Math.min(1, dt * 8); }
    e.fz = footFloor(e.x, e.y, .2);
  }
}

function update(dt) {
  G.time += dt;
  G.shake = Math.max(0, G.shake - dt); G.dmgA = Math.max(0, G.dmgA - dt * 1.6); G.pickA = Math.max(0, G.pickA - dt * 3); G.flash = Math.max(0, G.flash - dt * 12);
  faceOuch -= dt; faceGrin -= dt; faceLookT -= dt;
  if (faceLookT <= 0) { faceLook = Math.random() < .5 ? 0 : (Math.random() < .5 ? -1 : 1); faceLookT = .7 + Math.random() * 1.4; }
  if (G.state === 'play' && !P.dead && G.winT <= 0) updatePlayer(dt);
  else turnAcc = 0;
  if (G.state === 'play' && P.dead) { G.deathT += dt; P.fz = Math.max(P.fz - dt * .5, footFloor(P.x, P.y, PR) - .3); P.z = P.fz + EYE; if (G.deathT > 1.7) endRun(false); }
  if (G.state === 'play' && G.winT > 0) { G.winT -= dt; if (G.winT <= 0) endRun(true); }
  if (G.state === 'title') { if (G.ready) { updateParts(dt); ambientParts(dt); } return; }
  if (G.state !== 'play' && G.state !== 'dead' && G.state !== 'win') return;
  G.flowT -= dt; if (G.flowT <= 0) { buildFlow(); G.flowT = .3; }
  for (const e of enemies) updateEnemy(e, dt);
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    const a = enemies[i], b = enemies[j]; if (a.dead || b.dead) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
    if (d > 0 && d < m) { const push = (m - d) / 2 * .5, ux = dx / d * push, uy = dy / d * push; if (canEnter(a.fz, a.x - ux, a.y - uy, .26)) { a.x -= ux; a.y -= uy; } if (canEnter(b.fz, b.x + ux, b.y + uy, .26)) { b.x += ux; b.y += uy; } }
  }
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.life -= dt;
    const c = cellAt(s.x, s.y);
    let hit = s.life <= 0 || !isOpen(c) || s.z < c.h0 || s.z > c.h1;
    if (!hit && !P.dead && Math.hypot(s.x - P.x, s.y - P.y, s.z - (P.z - .2)) < .42) { hit = true; hurt(6 + Math.random() * 10, s.x - s.vx, s.y - s.vy); }
    if (!hit) for (const b of barrels) if (b.alive && Math.hypot(s.x - b.x, s.y - b.y) < .36 && s.z < b.fz + .5) { hit = true; hurtBarrel(b, 20); }
    if (Math.random() < .7) spawnPart({ x: s.x, y: s.y, z: s.z, vx: rr(-.3, .3), vy: rr(-.3, .3), vz: rr(0, .5), life: rr(.2, .45), size: rr(.03, .06), col: [1, .55, .15], add: true, grav: -1 });
    if (hit) {
      shots.splice(i, 1);
      const bx = s.x - s.vx * .03, by = s.y - s.vy * .03, bz = s.z - s.vz * .03;
      fxs.push({ fr: 'boom', x: bx, y: by, z: bz, age: 0, dur: .45, size: .8, add: true });
      for (let k = 0; k < 10; k++) spawnPart({ x: bx, y: by, z: bz, vx: rr(-2, 2), vy: rr(-2, 2), vz: rr(-1, 2.5), life: rr(.2, .5), size: rr(.015, .03), col: [1, .6, .2], add: true, grav: 6 });
      sfx('splash', vol(s.x, s.y));
      const px = s.x - s.vx * dt, py = s.y - s.vy * dt, pc = cellAt(px, py);
      if (c && pc && isOpen(pc) && (!isOpen(c) || s.z > c.h1)) {
        if (Math.floor(s.x) !== Math.floor(px)) { const wx = s.vx > 0 ? Math.floor(s.x) : Math.floor(px); addDecal(wx, py + (s.y - py) * .5, s.z, -Math.sign(s.vx), 0, 0, rr(.14, .2), 3, pc); }
        else if (Math.floor(s.y) !== Math.floor(py)) { const wy = s.vy > 0 ? Math.floor(s.y) : Math.floor(py); addDecal(px + (s.x - px) * .5, wy, s.z, 0, -Math.sign(s.vy), 0, rr(.14, .2), 3, pc); }
      } else if (c && isOpen(c) && s.z < c.h0) addDecal(s.x, s.y, c.h0, 0, 0, 1, rr(.18, .26), 3);
    }
  }
  for (const b of barrels) if (b.alive && b.fuse > 0) { b.fuse -= dt; if (b.fuse <= 0) explode(b); }
  for (let i = fxs.length - 1; i >= 0; i--) { fxs[i].age += dt; if (fxs[i].age >= fxs[i].dur) fxs.splice(i, 1); }
  updateDoors(dt);
  updateParts(dt);
  ambientParts(dt);
}
function updatePlayer(dt) {
  G.gameTime += dt;
  const turnK = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
  P.a += turnK * 2.5 * dt + turnAcc; turnAcc = 0;
  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + stick.y;
  let s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + stick.x;
  const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
  const sp = (keys.ShiftLeft || keys.ShiftRight ? 5.4 : 3.5) * dt, cx = Math.cos(P.a), cy = Math.sin(P.a);
  moveBody(P, (cx * f - cy * s) * sp, (cy * f + cx * s) * sp, PR);
  const fz = footFloor(P.x, P.y, PR);
  P.fz = fz > P.fz ? P.fz + (fz - P.fz) * Math.min(1, dt * 16) : Math.max(fz, P.fz - dt * 3.2);
  const m = Math.min(1, len); P.move += (m - P.move) * Math.min(1, dt * 10); P.bob += dt * 9.5 * P.move * (keys.ShiftLeft || keys.ShiftRight ? 1.25 : 1);
  P.z = P.fz + EYE + (RM ? 0 : Math.sin(P.bob * 2) * .012 * P.move);
  P.cool -= dt; P.fireT = Math.max(0, P.fireT - dt); P.swap = Math.max(0, P.swap - dt);
  if (firing || touchFire || keys.ControlLeft || keys.ControlRight) tryFire();
  for (const it of items) if (!it.taken && Math.hypot(it.x - P.x, it.y - P.y) < .6 && Math.abs(it.fz - P.fz) < .4) take(it);
  const pc = cellAt(P.x, P.y);
  if (pc && (pc.fl & F_NUK) && P.fz < pc.h0 + .05) { G.nukT += dt; if (G.nukT > 1) { G.nukT = 0; hurt(5); say('방사성 폐기물! 몸이 타들어간다.'); } } else G.nukT = Math.min(G.nukT, .6);
  markSeen();
}
