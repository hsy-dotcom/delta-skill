/* ───────── 데칼 · 입자 · 프레임 조립 ───────── */
const MAX_DECALS = 128;
const DEC = { list: [], next: 0, cells: [], grid: new Uint8Array(MW * MH * 4), data: new Float32Array(MAX_DECALS * 8), dirty: false };
function resetDecals() {
  DEC.list = new Array(MAX_DECALS).fill(null); DEC.next = 0; DEC.cells = Array.from({ length: MW * MH }, () => []);
  DEC.data.fill(0); DEC.dirty = true;
}
// 벽 데칼은 앞쪽 열린 셀(open)에, 바닥 데칼은 반경이 걸치는 같은 높이의 셀들에 등록한다
function addDecal(x, y, z, nx, ny, nz, r, type, open) {
  if (!(r > 0)) return;
  const id = DEC.next; DEC.next = (DEC.next + 1) % MAX_DECALS;
  const old = DEC.list[id];
  if (old) for (const ci of old.cells) { const a = DEC.cells[ci], k = a.indexOf(id); if (k >= 0) a.splice(k, 1); }
  const cells = [];
  if (open) cells.push(open.y * MW + open.x);
  else for (let cy = Math.floor(y - r); cy <= Math.floor(y + r); cy++) for (let cx = Math.floor(x - r); cx <= Math.floor(x + r); cx++) {
    if (cx < 0 || cy < 0 || cx >= MW || cy >= MH) continue;
    const c = CELLS[cy * MW + cx]; if (isOpen(c) && Math.abs(c.h0 - z) < .02) cells.push(cy * MW + cx);
  }
  for (const ci of cells) {
    const a = DEC.cells[ci]; a.push(id);
    if (a.length > 4) { const drop = a.shift(), dl = DEC.list[drop]; if (dl) dl.cells = dl.cells.filter(q => q !== ci); }
  }
  DEC.list[id] = { cells };
  DEC.data.set([x, y, z, r], id * 4);
  DEC.data.set([nx, ny, nz, type + (id * 37 % 97) / 98], (MAX_DECALS + id) * 4);
  DEC.dirty = true;
}
function flushDecals() {
  if (!DEC.dirty) return;
  DEC.grid.fill(0);
  DEC.cells.forEach((a, i) => { for (let k = 0; k < a.length && k < 4; k++) DEC.grid[i * 4 + k] = a[k] + 1; });
  updateDecalTex(DEC.grid, DEC.data); DEC.dirty = false;
}

/* 입자 */
function spawnPart(o) {
  if (parts.length >= 900) parts.splice(0, 100);
  const p = Object.assign({ vx: 0, vy: 0, vz: 0, life: 1, size: .03, col: [1, 1, 1], a: 1, add: true, grav: 0, drag: 0, tex: null, lit: false, grow: 0, bounce: .3, blood: false }, o);
  p.max = p.life; parts.push(p);
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vz -= p.grav * dt;
    if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k; }
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, c = cellAt(nx, ny);
    if (!isOpen(c)) { parts.splice(i, 1); continue; }
    p.x = nx; p.y = ny; p.z += p.vz * dt;
    if (p.z > c.h1) { p.z = c.h1; p.vz = -Math.abs(p.vz) * .3; }
    if (p.z < c.h0) {
      if (p.blood) { if (Math.random() < .12) addDecal(p.x, p.y, c.h0, 0, 0, 1, rr(.03, .07), 2); parts.splice(i, 1); continue; }
      p.z = c.h0; p.vz = -p.vz * p.bounce; p.vx *= .55; p.vy *= .55;
    }
    p.size += p.grow * dt;
  }
}
function bloodBurst(x, y, z, n, fx, fy) {
  const d = Math.atan2(y - fy, x - fx);
  for (let k = 0; k < n; k++) { const a = d + rr(-.9, .9), s = rr(.4, 2.4); spawnPart({ x, y, z: z + rr(-.12, .15), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rr(.3, 2.4), life: rr(.4, .9), size: rr(.016, .04), col: [.42, .02, .02], add: false, lit: true, grav: 9, blood: true }); }
  spawnPart({ x, y, z, vz: .2, life: .35, size: .18, grow: .5, col: [.5, .04, .03], a: .7, add: false, lit: true, tex: 'smoke' });
}
function sparkBurst(x, y, z, n, nx = 0, ny = 0) {
  for (let k = 0; k < n; k++) { const a = Math.random() * TAU, s = rr(.5, 3); spawnPart({ x, y, z, vx: Math.cos(a) * s + nx * 2, vy: Math.sin(a) * s + ny * 2, vz: rr(0, 2.5), life: rr(.15, .45), size: rr(.008, .016), col: [1, .75, .35], add: true, grav: 9, bounce: .4 }); }
}
function impactFx(x, y, z, nx, ny) {
  sparkBurst(x + nx * .02, y + ny * .02, z, 7, nx, ny);
  spawnPart({ x: x + nx * .05, y: y + ny * .05, z, vx: nx * .3, vy: ny * .3, vz: .15, life: rr(.5, .9), size: .08, grow: .35, col: [.75, .72, .68], a: .55, add: false, lit: true, tex: 'smoke', drag: 1.5 });
}
function explosionFx(x, y, z, s) {
  fxs.push({ fr: 'boom', x, y, z: z + .15, age: 0, dur: .8, size: s * 1.25, add: true });
  for (let k = 0; k < 45; k++) { const a = Math.random() * TAU, v = rr(1, 6); spawnPart({ x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rr(0, 5), life: rr(.3, .9), size: rr(.012, .03), col: [1, .6, .2], add: true, grav: 8, bounce: .3 }); }
  for (let k = 0; k < 10; k++) spawnPart({ x: x + rr(-.3, .3), y: y + rr(-.3, .3), z: z + rr(0, .4), vx: rr(-.3, .3), vy: rr(-.3, .3), vz: rr(.2, .6), life: rr(1.5, 3), size: rr(.25, .45), grow: .3, col: [.3, .28, .26], a: .6, add: false, lit: true, tex: 'smoke', drag: .6 });
  for (let k = 0; k < 12; k++) { const a = Math.random() * TAU, v = rr(1, 3.5); spawnPart({ x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rr(1, 4), life: rr(.8, 1.6), size: rr(.02, .045), col: [.12, .12, .11], add: false, lit: true, grav: 9, bounce: .25 }); }
}
function ejectShell(sg) {
  const cx = Math.cos(P.a), cy = Math.sin(P.a), rx = -cy, ry = cx;
  spawnPart({ x: P.x + cx * .25 + rx * .12, y: P.y + cy * .25 + ry * .12, z: P.z - .15, vx: rx * rr(1.2, 1.8) - cx * .3, vy: ry * rr(1.2, 1.8) - cy * .3, vz: rr(1.2, 1.8), life: 1.4, size: sg ? .018 : .012, col: sg ? [.7, .1, .08] : [.85, .65, .2], add: false, lit: true, grav: 9, bounce: .45 });
}
const SKY_CELLS = [], POOL_CELLS = [], EAST_CELLS = [];
function ambientParts(dt) {
  if (!SKY_CELLS.length) for (const c of CELLS) { if (c.fl & F_NUK) POOL_CELLS.push(c); else if (c.fl & F_SKY) SKY_CELLS.push(c); if (c.x >= 21 && c.y >= 12 && isOpen(c)) EAST_CELLS.push(c); }
  if (Math.random() < dt * 14) { const c = SKY_CELLS[Math.random() * SKY_CELLS.length | 0]; spawnPart({ x: c.x + Math.random(), y: c.y + Math.random(), z: 2.2, vx: rr(-.2, .2), vy: rr(-.2, .2), vz: -rr(.15, .3), life: 7, size: rr(.006, .012), col: [.8, .75, .7], a: .8, add: false, lit: true, drag: .1 }); }
  if (Math.random() < dt * 10) { const c = POOL_CELLS[Math.random() * POOL_CELLS.length | 0]; spawnPart({ x: c.x + Math.random(), y: c.y + Math.random(), z: c.h0 + .01, vz: rr(.05, .25), life: rr(.4, 1), size: rr(.012, .03), col: [.45, 1, .25], a: .8, add: true }); }
  if (Math.random() < dt * 9) { const c = EAST_CELLS[Math.random() * EAST_CELLS.length | 0]; spawnPart({ x: c.x + Math.random(), y: c.y + Math.random(), z: c.h0 + rr(0, .3), vx: rr(-.1, .1), vy: rr(-.1, .1), vz: rr(.12, .35), life: rr(2, 4), size: rr(.006, .012), col: [1, .45, .12], add: true }); }
}

/* 자동 지도용 발견 셀 */
const SEEN = new Uint8Array(MW * MH);
let seenT = 0;
function markSeen() {
  seenT -= 1; if (seenT > 0) return; seenT = 6;
  const px = Math.floor(P.x), py = Math.floor(P.y);
  for (let y = py - 7; y <= py + 7; y++) for (let x = px - 7; x <= px + 7; x++) {
    if (x < 0 || y < 0 || x >= MW || y >= MH || SEEN[y * MW + x]) continue;
    const c = CELLS[y * MW + x];
    if (!isOpen(c) || c.window) continue;
    if (segClear(P.x, P.y, P.z, x + .5, y + .5, clamp(P.z, c.h0 + .05, c.h1 - .05))) {
      SEEN[y * MW + x] = 1;
      for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) { const xx = x + u, yy = y + v; if (xx >= 0 && yy >= 0 && xx < MW && yy < MH && !isOpen(CELLS[yy * MW + xx])) SEEN[yy * MW + xx] = 1; }
    }
  }
}

/* 조명 지도 CPU 샘플 (무기 조명용) */
function sampleLM(x, y) {
  const fx = x * LM - .5, fy = y * LM - .5, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, o = new Float32Array(8);
  for (const [u, v, w] of [[0, 0, (1 - tx) * (1 - ty)], [1, 0, tx * (1 - ty)], [0, 1, (1 - tx) * ty], [1, 1, tx * ty]]) {
    const k = (clamp(iy + v, 0, LMH - 1) * LMW + clamp(ix + u, 0, LMW - 1)) * 4;
    for (let c = 0; c < 4; c++) { o[c] += LMAP.irr[k + c] * w; o[4 + c] += LMAP.dir[k + c] * w; }
  }
  return o;
}

/* 프레임 조립: 카메라 · 동적 광원 · 인스턴스 배열 · 무기 */
const IB = { spr: new Float32Array(MAX_INST * INST_F), fxA: new Float32Array(MAX_INST * INST_F), fxB: new Float32Array(MAX_INST * INST_F) };
function putInst(arr, n, x, y, z, w, h, uv, col, p0, p1, p2, mirror) {
  if (n >= MAX_INST) return n;
  const o = n * INST_F;
  arr[o] = x; arr[o + 1] = y; arr[o + 2] = z; arr[o + 3] = w; arr[o + 4] = h;
  if (uv) { arr[o + 5] = mirror ? uv.u1 : uv.u0; arr[o + 6] = uv.v0; arr[o + 7] = mirror ? uv.u0 : uv.u1; arr[o + 8] = uv.v1; }
  else { arr[o + 5] = 0; arr[o + 6] = 0; arr[o + 7] = 1; arr[o + 8] = 1; }
  arr[o + 9] = col[0]; arr[o + 10] = col[1]; arr[o + 11] = col[2]; arr[o + 12] = col[3];
  arr[o + 13] = p0; arr[o + 14] = p1; arr[o + 15] = p2;
  return n + 1;
}
function enemyFrame(e, cam) {
  const set = SPR[e.type];
  if (e.dead) return { rec: set.death[Math.min(5, e.deadT / .11 | 0)], mirror: false };
  const rel = Math.atan2(cam.y - e.y, cam.x - e.x) - e.a;
  const idx = Math.round((((rel % TAU) + TAU) % TAU) / (Math.PI / 4)) % 8, mirror = idx > 4, k = mirror ? 8 - idx : idx;
  let arr;
  if (e.pain > 0) arr = set.pain[0];
  else if (e.atk > 0) arr = set.atk[e.atk > e.atkHit ? 0 : 1];
  else arr = set.walk[e.awake ? (e.walk * 3.2 | 0) % 4 : 0];
  return { rec: arr[k], mirror };
}
const NO_COL = [0, 0, 0, 0];
function buildFrame(cam) {
  const dx = Math.cos(cam.a), dy = Math.sin(cam.a), rx = -dy, ry = dx, t = G.time;
  const depthOf = (x, y) => (x - cam.x) * dx + (y - cam.y) * dy;
  // 불투명 스프라이트
  const L = [];
  const add = (x, y, z, rec, mirror, fl, em) => { const d = depthOf(x, y); if (d > .06 && d < 45 && rec) L.push({ d, x, y, z, rec, mirror, fl, em }); };
  const addFx = [], alphaFx = [];
  if (G.ready) {
    for (const it of items) if (!it.taken) add(it.x, it.y, it.fz + .04 + Math.sin(t * 2.2 + it.ph) * .025, SPR.item[it.k][((t * 1.1 + it.ph) * 12 | 0) % 12], false, 0, it.k === 'k' ? 2 : 1);
    for (const b of barrels) if (b.alive) add(b.x, b.y, b.fz, SPR.barrel, false, 0, 1);
    for (const d of decor) {
      add(d.x, d.y, d.fz, SPR[d.k], false, 0, 1);
      const fl = .85 + .15 * Math.sin(t * 17 + d.x * 3) * Math.sin(t * 11 + d.y);
      if (d.k === 'candle') for (const [ox, oy] of [[-.11, .655], [0, .695], [.11, .655]]) addFx.push({ x: d.x + rx * ox - dx * .03, y: d.y + ry * ox - dy * .03, z: d.fz + oy, w: .045 * fl, h: .09 * fl, rec: SPR.fx.flame[(t * 10 + ox * 30 | 0) & 3], col: [1, 1, 1, 1], tex: 1 });
      if (d.k === 'torch') { addFx.push({ x: d.x - dx * .03, y: d.y - dy * .03, z: d.fz + .66, w: .15 * fl, h: .3 * fl, rec: SPR.fx.flame[(t * 10 + d.x | 0) & 3], col: [1, .55, .4, 1], tex: 1 }); addFx.push({ x: d.x, y: d.y, z: d.fz + .64, w: .6, h: .6, col: [1, .3, .08, .18 * fl], tex: 0 }); }
      if (d.k === 'lamp') addFx.push({ x: d.x - dx * .05, y: d.y - dy * .05, z: d.fz + .73, w: .55, h: .55, col: [.55, .65, .85, .22], tex: 0 });
    }
    for (const e of enemies) { const f = enemyFrame(e, cam); add(e.x, e.y, e.fz, f.rec, f.mirror, e.flash > 0 ? .5 : 0, 1); }
    for (const s of shots) {
      addFx.push({ x: s.x, y: s.y, z: s.z, w: .38, h: .38, rec: SPR.fx.fire[(t * 14 | 0) & 3], col: [1, 1, 1, 1], tex: 1 });
      addFx.push({ x: s.x, y: s.y, z: s.z, w: 1.1, h: 1.1, col: [1, .35, .08, .35], tex: 0 });
    }
    for (const f of fxs) { const fr = SPR.fx[f.fr]; addFx.push({ x: f.x, y: f.y, z: f.z, w: f.size, h: f.size, rec: fr[Math.min(fr.length - 1, f.age / f.dur * fr.length | 0)], col: [1, 1, 1, 1], tex: 1 }); }
    for (const p of parts) {
      const k = p.life / p.max, a = p.a * (p.tex ? k : Math.min(1, k * 3));
      const o = { x: p.x, y: p.y, z: p.z, w: p.size, h: p.size, col: [p.col[0], p.col[1], p.col[2], a], tex: p.tex ? 1 : 0, rec: p.tex ? SPR.fx.smoke[(p.x * 7 | 0) & 1] : null, lit: p.lit };
      (p.add ? addFx : alphaFx).push(o);
    }
  }
  L.sort((a, b) => b.d - a.d);
  let n = 0;
  for (const s of L) n = putInst(IB.spr, n, s.x, s.y, s.z + s.rec.y0, s.rec.ww, s.rec.wh, s.rec, s.fl ? [1, .85, .75, s.fl] : NO_COL, s.em, 0, 0, s.mirror);
  alphaFx.forEach(f => f.d = depthOf(f.x, f.y)); alphaFx.sort((a, b) => b.d - a.d);
  let na = 0; for (const f of alphaFx) if (f.d > .05) na = putInst(IB.fxA, na, f.x, f.y, f.z, f.w, f.h, f.rec, f.col, f.tex, f.lit ? 1 : 0, -.5, false);
  let nb = 0; for (const f of addFx) nb = putInst(IB.fxB, nb, f.x, f.y, f.z, f.w, f.h, f.rec, f.col, f.tex, 0, -.5, false);

  // 동적 광원 후보 → 가까운/강한 순으로 8개
  const cand = [];
  const lamp = (x, y, z, r, i, c, sh, imp) => cand.push({ x, y, z, r, i, c, sh, s: imp * i / (1 + ((x - cam.x) ** 2 + (y - cam.y) ** 2) * .04) });
  if (G.flash > 0 && G.state === 'play' && !P.dead) lamp(P.x + dx * .45, P.y + dy * .45, P.z - .05, 5.5, 3.2 * G.flash, [1, .72, .38], 1, 100);
  for (const s of shots) lamp(s.x, s.y, s.z, 3.8, 1.7, [1, .5, .15], 1, 50);
  for (const f of fxs) { const k = 1 - f.age / f.dur; lamp(f.x, f.y, f.z + .2, 3 + f.size * 2.5, 4.5 * k * k * (f.size / 1.6), [1, .58, .22], 1, 80); }
  for (const e of enemies) if (e.type === 'imp' && !e.dead && e.atk > e.atkHit && !e.melee) lamp(e.x, e.y, e.fz + .95, 2.6, 1.1, [1, .55, .15], 0, 40);
  const fl = (Math.sin(t * 23) + Math.sin(t * 7.3) > 1.1) ? .12 : 1;
  const lc = CELLS[14 * MW + 5];
  if (lc && Math.abs(lc.em - fl) > .01) { lc.em = fl; MAPD.m0[(14 * MW + 5) * 4 + 3] = fl; G.mapDirty = true; }
  lamp(5.5, 14.5, .85, 4.2, 1.7 * fl, [.85, .92, 1], 1, 3);
  const pulse = .5 + .5 * Math.sin(t * 3.2);
  lamp(10.5, 1.6, 1.25, 5, 2 * pulse, [1, .07, .03], 1, 3); lamp(17.5, 1.6, 1.25, 5, 2 * pulse, [1, .07, .03], 1, 3);
  if (G.switchOn) lamp(14, 1.3, .75, 4, 1.8, [.2, 1, .4], 1, 5);
  for (const d of decor) if (d.k === 'torch' || d.k === 'candle') lamp(d.x, d.y, d.fz + .7, 3, .35 + .2 * Math.sin(t * 13 + d.x * 5) * Math.sin(t * 7 + d.y), d.k === 'torch' ? [1, .35, .1] : [1, .6, .3], 0, 1);
  lamp(13.5, 12, .05, 3.5, .5 + .25 * Math.sin(t * 1.7), [.35, 1, .2], 0, 1);
  cand.sort((a, b) => b.s - a.s);
  const dynP = new Float32Array(32), dynC = new Float32Array(32), dynN = Math.min(8, cand.length);
  for (let i = 0; i < dynN; i++) { const c = cand[i]; dynP.set([c.x, c.y, c.z, c.r], i * 4); dynC.set([c.c[0] * c.i, c.c[1] * c.i, c.c[2] * c.i, c.sh], i * 4); }

  // 1인칭 무기
  let wpn = null;
  if (G.state === 'play' && !P.dead && G.ready) {
    const sg = P.weapon === 1, set = SPR.wpn[sg ? 'shotgun' : 'pistol'], ft = P.fireT;
    let fr = 0;
    if (sg) fr = ft > .82 ? 1 : ft > .62 ? 0 : ft > .5 ? 2 : ft > .34 ? 3 : ft > .2 ? 2 : 0; else fr = ft > .12 ? 1 : 0;
    const rec = set[fr], W = R.w, H = R.h, s = focalFor(W, H) / WPN_F;
    const amp = RM ? .3 : 1, bx = Math.cos(P.bob) * .02 * P.move * amp, by = Math.abs(Math.sin(P.bob)) * .025 * P.move * amp + (P.swap / .3) * .45 + (fr === 1 ? .03 : 0);
    const x0 = W / 2 + (rec.ox - WPN_W / 2) * s + bx * H, y0 = H / 2 + (rec.oy - WPN_H / 2) * s + by * H, x1 = x0 + rec.w * s, y1 = y0 + rec.h * s;
    const nx = x => x / W * 2 - 1, ny = y => 1 - y / H * 2;
    const lm = sampleLM(P.x, P.y), Ld = [lm[4], lm[5], lm[6]];
    const LDv = [Ld[0] * rx + Ld[1] * ry, Ld[2], -(Ld[0] * dx + Ld[1] * dy), lm[7]];
    let dsum = [0, 0, 0], ddir = [0, 0, 0];
    for (let i = 0; i < dynN; i++) {
      const c = cand[i], lx = c.x - P.x, ly = c.y - P.y, lz = c.z - P.z, d = Math.hypot(lx, ly, lz); if (d > c.r) continue;
      const att = (1 - d / c.r) ** 2 * c.i;
      for (let k = 0; k < 3; k++) dsum[k] += c.c[k] * att;
      const v = [(lx * rx + ly * ry) / (d || 1), lz / (d || 1), -(lx * dx + ly * dy) / (d || 1)]; for (let k = 0; k < 3; k++) ddir[k] += v[k] * att;
    }
    const dl = Math.hypot(...ddir) || 1;
    wpn = { rect: [nx(x0), ny(y1), nx(x1), ny(y0)], uv: [rec.u0, rec.v0, rec.u1, rec.v1], E: [lm[0], lm[1], lm[2]], LD: LDv, dynC: dsum, dynD: ddir.map(v => v / dl), flash: G.flash, flashRect: null };
    if (G.flash > .05 && ft > 0) {
      const fs = (sg ? .4 : .28) * H * (.85 + Math.random() * .3), mx = W / 2 + (rec.mx - WPN_W / 2) * s + bx * H, my = H / 2 + (rec.my - WPN_H / 2) * s + by * H, fx = SPR.fx.flash[(G.time * 60 | 0) & 1];
      wpn.flashRect = [nx(mx - fs / 2), ny(my + fs / 2), nx(mx + fs / 2), ny(my - fs / 2)]; wpn.flashUV = [fx.u0, fx.v0, fx.u1, fx.v1];
    }
  }
  const sh = RM ? 0 : G.shake;
  return {
    cam: [cam.x, cam.y, cam.z], dir: [Math.cos(cam.a + (Math.random() - .5) * .02 * sh), Math.sin(cam.a + (Math.random() - .5) * .02 * sh)],
    horiz: (Math.random() - .5) * .02 * sh, time: t, fog: [.018, .01, .008, .06], scat: .0045, expo: 1.0,
    dynP, dynC, dynN, spr: IB.spr, sprN: n, fxA: IB.fxA, fxAN: na, fxB: IB.fxB, fxBN: nb, wpn,
    dmg: G.dmgA, pick: G.pickA, lowHp: G.state === 'play' && !P.dead && P.hp <= 25 ? 1 : 0,
  };
}
