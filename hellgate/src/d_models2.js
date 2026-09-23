/* ───────── 3D 모델: 아이템 · 소품 · 1인칭 무기 · 효과 이미지 · 생성 일정 ───────── */
const C_WOOD1 = hex('#4a2812'), C_WOOD2 = hex('#8a5428');
const woodCol = (x, y, z) => { const g = fract(x * 34 + y * 11 + fbm3(x * 6, y * 6, z * 26, 2) * 3); return mixc(C_WOOD1, C_WOOD2, smooth(.25, .75, g)); };
Object.assign(MAT, {
  white: { col: hex('#e4e2da'), spec: .5 }, metal: { col: hex('#555860'), spec: .85, bump: .05, bf: 60, mott: .3, mf: 30 },
  gun: { col: hex('#2c2e33'), spec: .9, bump: .03, bf: 90, mott: .25, mf: 40 }, gunDark: { col: hex('#18191c'), spec: .8 },
  grip: { col: hex('#221e1a'), spec: .3, bump: .5, bf: 220 }, hole: { col: hex('#050505'), spec: .1 },
  wood: { col: woodCol, spec: .45 }, woodDark: { col: hex('#3a200e'), spec: .3 },
  skin: { col: hex('#b07a58'), spec: .35, bump: .15, bf: 80, mott: .35, mf: 30 }, glove: { col: hex('#3a2a1e'), spec: .3 },
  sleeve: { col: hex('#3c5a2a'), spec: .3, bump: .25, bf: 50, mott: .4, mf: 15 }, brass: { col: hex('#d0a848'), spec: .95 },
  olive: { col: hex('#5a5a32'), spec: .3, mott: .4, mf: 20 }, shell: { col: hex('#a81a14'), spec: .55 },
  green: { col: hex('#2e8a3a'), spec: .85, bump: .08, bf: 30, mott: .3, mf: 10 }, greenDark: { col: hex('#1a4a22'), spec: .6 },
  dark: { col: hex('#141414'), spec: .2 }, slime: { col: hex('#8cf23a'), emit: .7, spec: .95, bump: .2, bf: 20 },
  lampGlow: { col: hex('#eaf4ff'), emit: 1 }, iron: { col: hex('#2a2622'), spec: .6, bump: .1, bf: 40, mott: .4, mf: 15 },
  wax: { col: hex('#e8dcc0'), spec: .3 }, flameY: { col: hex('#ffe08a'), emit: 1 }, flameR: { col: hex('#ff5a2a'), emit: 1 },
  visor: { col: hex('#1a2a2a'), spec: 1 },
});
const C_CROSS = hex('#c81818'), C_KIT = hex('#e4e2da'), C_LABEL = hex('#d8b040'), C_OLIVE = hex('#5a5a32');
const C_KEY = hex('#d02020'), C_KEYW = hex('#f4f0e8'), C_CHIP = hex('#ffd060');
const C_PAINT = hex('#46553a'), C_RUST = hex('#6a3414'), C_HAZ = hex('#e0b020'), C_BLK = hex('#161616');

function medkitModel() {
  const P = [];
  P.push(Box([0, .095, 0], [.15, .09, .11], I3, { spec: .5, col: (x, y, z, p) => {
    const q = localOf(p, x, y, z), ax = Math.abs(q[0]), ay = Math.abs(q[1]), az = Math.abs(q[2]);
    let c = false;
    if (az > p.h[2] - .004) c = (ax < .02 && ay < .062) || (ay < .02 && ax < .062);
    else if (ay > p.h[1] - .004) c = (ax < .02 && az < .062) || (az < .02 && ax < .062);
    return c ? C_CROSS : C_KIT;
  } }, .018));
  P.push(Cap([-.05, .2, 0], [.05, .2, 0], .012, MAT.dark));
  for (const sx of [-1, 1]) P.push(Box([sx * .08, .16, .112], [.012, .015, .004], I3, MAT.metal));
  return P;
}
function ammoModel() {
  const P = [];
  P.push(Box([0, .055, 0], [.14, .055, .075], I3, { spec: .3, col: (x, y, z, p) => { const q = localOf(p, x, y, z); return Math.abs(q[2]) > p.h[2] - .004 && Math.abs(q[1]) < .018 ? C_LABEL : C_OLIVE; } }, .01));
  for (let k = 0; k < 5; k++) { const x = -.08 + k * .04; P.push(Cyl([x, .105, 0], [x, .125, 0], .018, MAT.brass)); P.push(Cyl([x, .125, 0], [x, .205, 0], .017, MAT.shell)); }
  return P;
}
function armorModel() {
  const P = [];
  P.push(Ell([0, .2, 0], [.14, .17, .085], I3, MAT.green));
  P.push(Box([0, .235, .06], [.1, .075, .03], I3, MAT.green, .025));
  for (const y of [.13, .08]) P.push(Box([0, y, .055], [.09, .022, .025], I3, MAT.greenDark, .012));
  for (const sx of [-1, 1]) P.push(Ell([sx * .14, .33, 0], [.07, .045, .085], rotZ(sx * .45), MAT.greenDark));
  P.push(Ell([0, .365, 0], [.06, .018, .05], I3, MAT.dark));
  return P;
}
function keyModel() {
  return [Box([0, .15, 0], [.065, .095, .006], I3, { spec: .7, emit: .22, col: (x, y, z, p) => {
    const q = localOf(p, x, y, z);
    if (Math.abs(q[1] - .045) < .012) return C_KEYW;
    if (q[0] > -.045 && q[0] < -.012 && q[1] > -.06 && q[1] < -.025) return C_CHIP;
    return C_KEY;
  } }, .004)];
}
function shotgunItemModel() {
  const P = [];
  P.push(Cyl([-.36, .055, 0], [.14, .055, 0], .016, MAT.gun));
  P.push(Cyl([-.3, .028, 0], [.1, .028, 0], .013, MAT.gunDark));
  P.push(Cyl([-.17, .03, 0], [-.03, .03, 0], .027, MAT.wood));
  P.push(Box([.19, .048, 0], [.055, .036, .022], I3, MAT.gun));
  P.push(Box([.31, .042, 0], [.08, .034, .02], rotZ(.12), MAT.wood));
  return P;
}
function barrelModel() {
  const P = [];
  P.push(Cyl([0, 0, 0], [0, .43, 0], .15, { spec: .4, col: (x, y, z) => {
    const a = Math.atan2(z, x), n = fbm3(x * 9, y * 9, z * 9, 3);
    if (y > .18 && y < .25 && Math.abs(a - Math.PI / 2) < .9) return ((a * 8 + y * 40) % 1 + 1) % 1 < .5 ? C_HAZ : C_BLK;
    return mixc(mulc(C_PAINT, .8 + n * .4), C_RUST, smooth(.58, .72, n + (.43 - y) * .15));
  } }));
  for (const y of [.09, .33]) P.push(Cyl([0, y, 0], [0, y + .02, 0], .158, MAT.metal));
  P.push(Cyl([0, .415, 0], [0, .432, 0], .153, MAT.metal));
  P.push(Ell([0, .428, 0], [.132, .022, .132], I3, MAT.slime));
  return P;
}
function lampModel() {
  const P = [];
  P.push(Cyl([0, 0, 0], [0, .06, 0], .1, MAT.metal));
  P.push(Cyl([0, .06, 0], [0, .62, 0], .028, MAT.metal));
  P.push(Cyl([0, .62, 0], [0, .84, 0], .062, MAT.lampGlow));
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; P.push(Cap([Math.cos(a) * .07, .62, Math.sin(a) * .07], [Math.cos(a) * .07, .84, Math.sin(a) * .07], .007, MAT.metal)); }
  P.push(Cyl([0, .84, 0], [0, .88, 0], .075, MAT.metal)); P.push(Cyl([0, .6, 0], [0, .625, 0], .075, MAT.metal));
  return P;
}
function candleModel() {
  const P = [];
  for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + .3; P.push(Cap([0, .1, 0], [Math.cos(a) * .12, .005, Math.sin(a) * .12], .012, MAT.iron)); }
  P.push(Cyl([0, .08, 0], [0, .52, 0], .016, MAT.iron));
  for (const sx of [-1, 0, 1]) {
    const x = sx * .11, y = sx ? .56 : .6;
    if (sx) { P.push(Cap([0, .5, 0], [x, .52, 0], .01, MAT.iron)); P.push(Cap([x, .52, 0], [x, y, 0], .01, MAT.iron)); }
    P.push(Cyl([x, y, 0], [x, y + .015, 0], .03, MAT.iron));
    P.push(Cyl([x, y + .015, 0], [x, y + .07, 0], .014, MAT.wax));
    P.push(Ell([x, y + .095, 0], [.011, .024, .011], I3, MAT.flameY));
  }
  return P;
}
function torchModel() {
  return [Cyl([0, 0, 0], [0, .52, 0], .024, MAT.iron), Cyl([0, .5, 0], [0, .56, 0], .05, MAT.iron), Ell([0, .64, 0], [.04, .09, .04], I3, MAT.flameR), Ell([0, .62, 0], [.022, .05, .022], I3, MAT.flameY)];
}
function marineModel() {
  const P = [], hip = .46;
  leg(P, [-.08, hip, 0], .1, .15, .22, .23, .055, .045, MAT.sleeve, MAT.dark);
  leg(P, [.08, hip, 0], -.05, .1, .22, .23, .055, .045, MAT.sleeve, MAT.dark);
  P.push(Ell([0, .64, 0], [.15, .2, .1], I3, MAT.green));
  P.push(Box([0, .68, .07], [.11, .09, .03], I3, MAT.green, .02));
  P.push(Sph([0, .9, .0], .085, MAT.green)); P.push(Ell([0, .89, .06], [.065, .028, .035], I3, MAT.visor));
  for (const sx of [-1, 1]) { limbEll(P, [sx * .17, .78, 0], [sx * .25, .6, .05], .045, MAT.sleeve); limbEll(P, [sx * .25, .6, .05], [sx * .3, .45, .12], .038, MAT.skin); P.push(Ell([sx * .17, .8, 0], [.07, .045, .08], I3, MAT.greenDark)); }
  return topple(P, 1.5, 0);
}

function pistolModel(fire) {
  const P = [], sb = fire ? .028 : 0;
  P.push(Box([0, .03, -.08 + sb], [.017, .02, .1], I3, MAT.gun, .004));
  for (let k = 0; k < 5; k++) P.push(Box([0, .03, .005 + sb - k * .008], [.0176, .0165, .0018], I3, MAT.gunDark, .001));
  P.push(Box([0, 0, -.05], [.015, .012, .085], I3, MAT.gunDark, .004));
  P.push(Cyl([0, .033, -.18 + sb], [0, .033, -.186 + sb], .0085, MAT.gun));
  P.push(Sph([0, .033, -.187 + sb], .0052, MAT.hole));
  P.push(Box([0, .054, -.165 + sb], [.0025, .006, .004], I3, MAT.gunDark, .001));
  for (const sx of [-1, 1]) P.push(Box([sx * .008, .054, .012 + sb], [.004, .006, .004], I3, MAT.gunDark, .001));
  P.push(Box([0, -.055, .012], [.0145, .052, .028], rotX(-.25), MAT.grip, .006));
  P.push(Ell([0, -.07, .036], [.042, .056, .046], rotX(-.25), MAT.skin));
  for (let k = 0; k < 3; k++) P.push(Cap([-.022, -.035 - k * .021, -.022], [.022, -.038 - k * .021, -.022], .0115, MAT.skin));
  P.push(Cap([-.021, -.012, -.024], [-.004, -.018, -.042], .011, MAT.skin));
  P.push(Cap([.024, -.02, .03], [.025, .006, -.025], .011, MAT.skin));
  P.push(Cyl([0, -.095, .065], [.004, -.115, .085], .047, MAT.glove));
  P.push(Cyl([.004, -.11, .08], [.02, -.26, .22], .05, MAT.sleeve));
  return xform(P, I3, [0, -.19, -.33]);
}
function shotgunModel(fr) {
  const P = [], pb = fr === 3 ? .09 : fr === 2 ? .045 : 0;
  P.push(Cyl([0, .02, .06], [0, .02, -.62], .0135, MAT.gun));
  P.push(Sph([0, .02, -.621], .009, MAT.hole));
  P.push(Cyl([0, -.008, .02], [0, -.008, -.56], .011, MAT.gunDark));
  P.push(Cyl([0, -.006, -.17 + pb], [0, -.006, -.36 + pb], .023, MAT.wood));
  for (let k = 0; k < 6; k++) P.push(Cyl([0, -.006, -.2 - k * .025 + pb], [0, -.006, -.207 - k * .025 + pb], .0238, MAT.woodDark));
  P.push(Box([0, .004, .11], [.025, .036, .085], I3, MAT.gun, .006));
  P.push(Sph([0, .037, -.6], .0045, MAT.brass));
  P.push(Ell([0, -.04, -.27 + pb], [.042, .03, .065], I3, MAT.skin));
  for (let k = 0; k < 4; k++) P.push(Cap([-.03, -.02, -.235 - k * .02 + pb], [-.024, .006, -.235 - k * .02 + pb], .0105, MAT.skin));
  P.push(Cap([.028, -.02, -.25 + pb], [.022, .008, -.29 + pb], .011, MAT.skin));
  P.push(Cyl([0, -.06, -.24 + pb], [.13, -.26, -.06 + pb], .046, MAT.sleeve));
  const Q = fr === 1 ? xform(P, rotX(.07), [0, .012, .03]) : P;
  return xform(Q, I3, [0, -.15, -.22]);
}

/* 효과 이미지 (2D 절차 생성) */
function fxImage(w, h, fn) {
  const col = new Uint8Array(w * h * 4), nrm = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = fn((x + .5) / w, (y + .5) / h), o = (y * w + x) * 4;
    col[o] = clamp(r[0], 0, 1) * 255; col[o + 1] = clamp(r[1], 0, 1) * 255; col[o + 2] = clamp(r[2], 0, 1) * 255; col[o + 3] = clamp(r[3], 0, 1) * 255;
    nrm[o] = 128; nrm[o + 1] = 128; nrm[o + 2] = 0; nrm[o + 3] = (r[4] || 0) * 255;
  }
  return { w, h, col, nrm };
}
const FIRE_RAMP = t => t > .66 ? mixc([1, .72, .25], [1, .97, .8], (t - .66) / .34) : t > .33 ? mixc([.85, .25, .04], [1, .72, .25], (t - .33) / .33) : mixc([.3, .05, .02], [.85, .25, .04], t / .33);
function fireFx(k) { return fxImage(64, 64, (u, v) => { const r = Math.hypot(u - .5, v - .5) * 2, n = fbm3(u * 5, v * 5, k * .8, 4), t = clamp(1.25 - r - (n - .5) * .9 - r * r * .3, 0, 1); return [...FIRE_RAMP(t), smooth(0, .25, t), 1]; }); }
function boomFx(k) {
  const t = k / 7;
  return fxImage(128, 128, (u, v) => {
    const r = Math.hypot(u - .5, v - .5) * 2 / (.45 + .55 * Math.sqrt(t)), n = fbm3(u * 4 + k * .3, v * 4, k * .45, 5);
    const heat = clamp((1.1 - r - (n - .5) * 1.1) * (1.15 - t * .8), 0, 1), smoke = clamp((1 - r) * 1.4 - (n - .5), 0, 1) * smooth(.2, .9, t);
    const c = FIRE_RAMP(heat), a = Math.max(smooth(0, .2, heat), smoke * .8);
    return [...mixc(c, [.12, .1, .09], smoke * (1 - heat)), a * (1 - smooth(.7, 1, t) * .6), heat > .05 ? 1 : 0];
  });
}
function smokeFx(k) { return fxImage(64, 64, (u, v) => { const r = Math.hypot(u - .5, v - .5) * 2, n = fbm3(u * 5 + k * 9, v * 5, k, 4); const a = clamp((1 - r) * 1.6 - (n - .5) * 1.4, 0, 1) * .85; const g = .45 + n * .3; return [g, g * .96, g * .92, a, 0]; }); }
function flameFx(k) {
  return fxImage(32, 64, (u, v) => {
    const y = 1 - v, sway = Math.sin(y * 5 + k * 1.6) * .08 * y, w = .42 * Math.pow(1 - y, .55) * (1 - Math.pow(1 - y, 8) * .7), dx = Math.abs(u - .5 - sway);
    const n = fbm3(u * 4, v * 4 - k * .5, k * .7, 3), t = clamp((1 - dx / (w + .001)) * (1.1 - y * .6) + (n - .5) * .4, 0, 1);
    return [...FIRE_RAMP(t), smooth(0, .3, t), 1];
  });
}
function flashFx(k) {
  return fxImage(128, 128, (u, v) => {
    const dx = u - .5, dy = v - .5, r = Math.hypot(dx, dy) * 2, a = Math.atan2(dy, dx);
    const rays = Math.pow(Math.abs(Math.cos(a * 3.5 + k * .9)), 18) * (1 - r) * 1.2, core = Math.exp(-r * r * 9) * 1.3;
    const n = fbm3(u * 6, v * 6, k * 3, 3), t = clamp((rays + core) * (.75 + n * .5), 0, 1);
    return [...FIRE_RAMP(.35 + t * .65), smooth(0, .35, t), 1];
  });
}

/* 생성 일정 */
const SPR = {};
const ENEMY_IMG = { imp: { W: 128, H: 128, ps: 1.25 / 128 }, demon: { W: 128, H: 128, ps: 1.45 / 128 } };
function orthoCam(W, ps, y0 = -.02) { return { ortho: true, ps, x0: -W * ps / 2, y0 }; }
function putSprite(img, ps, y0 = -.02) { const r = atlasPut(img); r.ww = img.w * ps; r.wh = img.h * ps; r.y0 = y0; return r; }
function cropImage(img) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.col[(y * img.w + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(img.w - 1, x1 + 2); y1 = Math.min(img.h - 1, y1 + 2);
  const w = x1 - x0 + 1, h = y1 - y0 + 1, out = { w, h, col: new Uint8Array(w * h * 4), nrm: new Uint8Array(w * h * 4), ox: x0, oy: y0 };
  for (let y = 0; y < h; y++) { out.col.set(img.col.subarray(((y0 + y) * img.w + x0) * 4, ((y0 + y) * img.w + x0 + w) * 4), y * w * 4); out.nrm.set(img.nrm.subarray(((y0 + y) * img.w + x0) * 4, ((y0 + y) * img.w + x0 + w) * 4), y * w * 4); }
  return out;
}
const WPN_W = 480, WPN_H = 300, WPN_F = WPN_H * .77;
function weaponFrame(P, muzzle) {
  const full = rtRender(P, WPN_W, WPN_H, { f: WPN_F }), c = cropImage(full), r = atlasPut(c);
  r.ox = c.ox; r.oy = c.oy;
  r.mx = WPN_W / 2 + muzzle[0] / -muzzle[2] * WPN_F; r.my = WPN_H / 2 - muzzle[1] / -muzzle[2] * WPN_F;
  return r;
}

async function buildSprites(onProgress) {
  atlasInit();
  const jobs = [];
  for (const name of ['imp', 'demon']) {
    const S = ENEMY_IMG[name], model = name === 'imp' ? impModel : demonModel, set = SPR[name] = { walk: [], atk: [], pain: [], death: [] };
    const rotSet = (arr, o) => { const f = []; arr.push(f); for (let k = 0; k < ROTS; k++) jobs.push(() => { f[k] = putSprite(rtRender(rotView(model(o), k), S.W, S.H, orthoCam(S.W, S.ps)), S.ps); }); };
    for (let w = 0; w < 4; w++) rotSet(set.walk, { ph: w / 4 });
    for (let a = 0; a < 2; a++) rotSet(set.atk, name === 'imp' ? { atk: a } : { bite: a });
    rotSet(set.pain, { pain: true });
    const PSI = [.25, .6, 1, 1.35, 1.52, 1.57];
    for (let d = 0; d < 6; d++) jobs.push(() => { set.death[d] = putSprite(rtRender(topple(model({ dying: d / 5 }), PSI[d], 0), 192, S.H, orthoCam(192, S.ps)), S.ps); });
  }
  SPR.item = {};
  for (const [k, fn] of [['h', medkitModel], ['a', ammoModel], ['r', armorModel], ['k', keyModel], ['g', shotgunItemModel]]) {
    const arr = SPR.item[k] = [], wide = k === 'g', W = wide ? 96 : 64, H = wide ? 48 : 64, ps = wide ? .82 / 96 : .5 / 64;
    for (let f = 0; f < 12; f++) jobs.push(() => { arr[f] = putSprite(rtRender(xform(fn(), rotY(f / 12 * TAU)), W, H, orthoCam(W, ps)), ps); });
  }
  jobs.push(() => { SPR.barrel = putSprite(rtRender(barrelModel(), 96, 96, orthoCam(96, .6 / 96)), .6 / 96); });
  jobs.push(() => { SPR.lamp = putSprite(rtRender(lampModel(), 48, 128, orthoCam(48, 1 / 128)), 1 / 128); });
  jobs.push(() => { SPR.candle = putSprite(rtRender(candleModel(), 64, 96, orthoCam(64, .8 / 96)), .8 / 96); });
  jobs.push(() => { SPR.torch = putSprite(rtRender(torchModel(), 32, 96, orthoCam(32, .8 / 96)), .8 / 96); });
  jobs.push(() => { SPR.marine = putSprite(rtRender(marineModel(), 128, 64, orthoCam(128, 1.4 / 128)), 1.4 / 128); });
  SPR.wpn = { pistol: [], shotgun: [] };
  for (let f = 0; f < 2; f++) jobs.push(() => { SPR.wpn.pistol[f] = weaponFrame(pistolModel(f === 1), [0, .033 - .19, -.187 + (f ? .028 : 0) - .33]); });
  for (let f = 0; f < 4; f++) jobs.push(() => {
    const mz = f === 1 ? vadd(mv(rotX(.07), [0, .02, -.625]), [0, .012, .03]) : [0, .02, -.625];
    SPR.wpn.shotgun[f] = weaponFrame(shotgunModel(f), vadd(mz, [0, -.15, -.22]));
  });
  SPR.fx = { fire: [], boom: [], smoke: [], flame: [], flash: [] };
  jobs.push(() => {
    for (let k = 0; k < 4; k++) SPR.fx.fire[k] = atlasPut(fireFx(k));
    for (let k = 0; k < 8; k++) SPR.fx.boom[k] = atlasPut(boomFx(k));
    for (let k = 0; k < 2; k++) SPR.fx.smoke[k] = atlasPut(smokeFx(k));
    for (let k = 0; k < 4; k++) SPR.fx.flame[k] = atlasPut(flameFx(k));
    for (let k = 0; k < 2; k++) SPR.fx.flash[k] = atlasPut(flashFx(k));
  });
  let t0 = performance.now();
  for (let i = 0; i < jobs.length; i++) {
    jobs[i]();
    if (performance.now() - t0 > 30) { onProgress((i + 1) / jobs.length); await yieldFrame(); t0 = performance.now(); }
  }
  onProgress(1);
}
