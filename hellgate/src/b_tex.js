/* ───────── 절차적 텍스처: 알베도 + 높이(→노멀) + 발광 + 광택 ───────── */
const TS = 256, TN = TS * TS;
const TX = {}, TEXGEN = [];
function defTex(name, fn) { TX[name] = TEXGEN.length; TEXGEN.push({ name, fn }); }
function newLayer() { return { a: new Float32Array(TN * 3), h: new Float32Array(TN).fill(.5), e: new Float32Array(TN), g: new Float32Array(TN).fill(.15), bump: 2.5, cav: 1 }; }
function each(L, f) { for (let y = 0, i = 0; y < TS; y++) for (let x = 0; x < TS; x++, i++) f(x, y, i, (x + .5) / TS, (y + .5) / TS); }
const wrapI = (x, y) => ((y & 255) << 8) | (x & 255);
function put(L, i, c) { L.a[i * 3] = c[0]; L.a[i * 3 + 1] = c[1]; L.a[i * 3 + 2] = c[2]; }
function get(L, i) { return [L.a[i * 3], L.a[i * 3 + 1], L.a[i * 3 + 2]]; }

function disc(cx, cy, r, f) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
    const dx = x + .5 - cx, dy = y + .5 - cy, d2 = dx * dx + dy * dy;
    if (d2 <= r2) f(wrapI(x, y), Math.sqrt(d2) / r, dx, dy);
  }
}
function rect(x0, y0, w, h, f) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) f(wrapI(x0 + x, y0 + y), x, y); }
function line(x0, y0, x1, y1, f) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) + 1;
  for (let k = 0; k < n; k++) { const t = k / Math.max(1, n - 1); f(wrapI(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t)), t); }
}
function rivet(L, cx, cy, r, col, top = .95) {
  const R = r + 1.3;
  disc(cx, cy, R, (i, d) => {
    const dd = d * R;
    if (dd > r) { L.h[i] -= .03; put(L, i, mulc(get(L, i), .72)); return; }
    const q = Math.sqrt(Math.max(0, 1 - (dd / r) ** 2));
    L.h[i] = Math.max(L.h[i], top - .22 + q * .22); put(L, i, mulc(col, .78 + q * .38)); L.g[i] = .6;
  });
}
function scratches(L, n, s, bright = 1.3) {
  setSeed(s);
  for (let k = 0; k < n; k++) {
    const x = rnd() * TS, y = rnd() * TS, a = rr(-.5, .5) + (rnd() < .5 ? 0 : Math.PI / 2), len = rr(6, 40);
    line(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, i => { put(L, i, mulc(get(L, i), bright)); L.h[i] -= .025; L.g[i] = Math.min(1, L.g[i] + .25); });
  }
}
function hazard(L, x0, y0, w, h, ca, cb, per, hi) {
  rect(x0, y0, w, h, (i, x, y) => {
    const s = ((x + y) % per) < per / 2, n = vnoise((x0 + x) / 6, (y0 + y) / 6, 43, 43, 91);
    put(L, i, mulc(s ? ca : cb, .72 + n * .38)); L.h[i] = hi + (s ? .025 : 0) + (n - .5) * .03; L.g[i] = .35;
  });
}
function textMask(txt, size) {
  const c = document.createElement('canvas'); c.width = 256; c.height = Math.ceil(size * 1.4);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.font = `900 ${size}px "Arial Black", Impact, "Helvetica Neue", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 128, c.height / 2);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  return { w: c.width, h: c.height, a: (x, y) => (x < 0 || y < 0 || x >= c.width || y >= c.height) ? 0 : d[(y * c.width + x) * 4 + 3] / 255 };
}
function boxBlur(src, r) {
  const tmp = new Float32Array(TN), out = new Float32Array(TN), k = 1 / (2 * r + 1);
  for (let y = 0; y < TS; y++) {
    let s = 0; for (let x = -r; x <= r; x++) s += src[wrapI(x, y)];
    for (let x = 0; x < TS; x++) { tmp[(y << 8) | x] = s * k; s += src[wrapI(x + r + 1, y)] - src[wrapI(x - r, y)]; }
  }
  for (let x = 0; x < TS; x++) {
    let s = 0; for (let y = -r; y <= r; y++) s += tmp[wrapI(x, y)];
    for (let y = 0; y < TS; y++) { out[(y << 8) | x] = s * k; s += tmp[wrapI(x, y + r + 1)] - tmp[wrapI(x, y - r)]; }
  }
  return out;
}
// 높이 → 노멀, 오목한 곳 차폐(AO)를 알베도에 굽는다. 알베도 A = 발광, 노멀 A = 광택
function finalize(L) {
  const h = L.h, hb = boxBlur(h, 5), alb = new Uint8Array(TN * 4), nrm = new Uint8Array(TN * 4), k = L.bump * 4;
  for (let y = 0, i = 0; y < TS; y++) for (let x = 0; x < TS; x++, i++) {
    const dx = h[wrapI(x + 1, y)] - h[wrapI(x - 1, y)], dy = h[wrapI(x, y + 1)] - h[wrapI(x, y - 1)];
    let nx = -dx * k, ny = -dy * k, nz = 1; const inv = 1 / Math.hypot(nx, ny, nz); nx *= inv; ny *= inv; nz *= inv;
    const cav = clamp(1 + (h[i] - hb[i]) * 2.4 * L.cav, .32, 1.12);
    const o = i * 4;
    alb[o] = clamp(L.a[i * 3] * cav, 0, 1) * 255; alb[o + 1] = clamp(L.a[i * 3 + 1] * cav, 0, 1) * 255; alb[o + 2] = clamp(L.a[i * 3 + 2] * cav, 0, 1) * 255;
    alb[o + 3] = clamp(L.e[i], 0, 1) * 255;
    nrm[o] = (nx * .5 + .5) * 255; nrm[o + 1] = (ny * .5 + .5) * 255; nrm[o + 2] = (nz * .5 + .5) * 255; nrm[o + 3] = clamp(L.g[i], 0, 1) * 255;
  }
  return { alb, nrm };
}

/* ── 벽 ── */
defTex('BRICK', L => {
  L.bump = 2.6;
  each(L, (x, y, i, u, v) => {
    const row = y >> 5, off = (row & 1) * 32, xx = (x + off) & 255, col = xx >> 6;
    const lx = xx - col * 64, ly = y - row * 32;
    const r0 = ihash(col, row, 11), r1 = ihash(col, row, 12), r2 = ihash(col, row, 13);
    const inside = Math.min(lx - 1.5, 62.5 - lx, ly - 1.5, 30.5 - ly);
    const n = fbm(u, v, 16, 4, 3), n2 = fbm(u, v, 4, 3, 7);
    let h, c;
    if (inside <= 0) { h = .12 + n * .1; c = mulc([.40, .35, .30], .5 + n * .5); }
    else {
      const chip = fbm(u, v, 32, 3, 21 + row), ch = chip > .7 ? (chip - .7) * 1.6 : 0;
      h = .42 + smooth(0, 5 + r2 * 3, inside) * .4 + (n - .5) * .16 - ch;
      c = mulc(mixc(mixc(hex('#7a2e1c'), hex('#9c4c2e'), r0), hex('#4e2014'), r1 * .55), .74 + n * .45);
      if (ch > 0) c = mulc(c, .78);
    }
    c = mulc(c, 1 - smooth(.6, 1, v) * .3 - smooth(.55, .8, n2) * .35);
    put(L, i, c); L.h[i] = h; L.g[i] = inside > 0 ? .2 : .08;
  });
});

defTex('TECH', L => {
  L.bump = 2.2;
  const base = hex('#4a5058');
  each(L, (x, y, i, u, v) => {
    const brush = vnoise(u * 128, v * 12, 128, 12, 5) * .6 + vnoise(u * 256, v * 24, 256, 24, 6) * .4, big = fbm(u, v, 4, 3, 8);
    let h = .55, c = mulc(base, .8 + brush * .3), px0 = -1, py0 = 0, pw = 0, ph = 0;
    if (y < 112) { px0 = x < 128 ? 0 : 128; pw = 128; ph = 112; } else if (y >= 144) { px0 = 0; py0 = 144; pw = 256; ph = 112; }
    if (px0 >= 0) {
      const lx = x - px0, ly = y - py0, e = Math.min(lx - 1, pw - 2 - lx, ly - 1, ph - 2 - ly);
      if (e < 0) { h = .1; c = hex('#15171a'); }
      else { h = .3 + smooth(0, 4, e) * .35 + brush * .03; c = mulc(c, .68 + smooth(0, 16, e) * .38 - big * .16); }
    } else { h = .12 + (y > 124 && y < 132 ? .1 : 0); c = mulc(hex('#1d2024'), .8 + brush * .4); }
    put(L, i, c); L.h[i] = h; L.g[i] = .35 + brush * .15;
  });
  for (let k = 0; k < 16; k++) rect(64, 172 + k * 4, 128, 2, (i, x) => { if (k < 12) { L.h[i] = .15; put(L, i, hex('#0d0e10')); } });
  for (let k = 0; k < 8; k++) {
    const cx = 16 + k * 32;
    disc(cx, 128, 8.5, (i, d) => { L.h[i] = .45 - d * .1; put(L, i, hex('#2a2e33')); });
    disc(cx, 128, 5.5, (i, d) => { const q = Math.sqrt(1 - d * d); put(L, i, mixc(hex('#9dffc0'), hex('#34d070'), d)); L.e[i] = .6 + q * .4; L.h[i] = .5 + q * .15; L.g[i] = .95; });
  }
  const riv = [[8, 8], [120, 8], [8, 104], [120, 104], [136, 8], [248, 8], [136, 104], [248, 104], [8, 152], [248, 152], [8, 248], [248, 248], [128, 152], [128, 248]];
  setSeed(9);
  for (const [a, b] of riv) {
    rivet(L, a, b, 4.5, hex('#9aa0a8'));
    if (rnd() < .6) { const len = rr(10, 34); for (let y = 6; y < len; y++) { const t = 1 - y / len; for (let dx = -1; dx <= 1; dx++) { const i = wrapI(a + dx, b + y); put(L, i, mixc(get(L, i), hex('#6a3414'), .5 * t)); } } }
  }
  hazard(L, 20, 158, 40, 10, hex('#e0b020'), hex('#161616'), 10, .64);
  scratches(L, 44, 10);
});

defTex('STONE', L => {
  L.bump = 3;
  each(L, (x, y, i, u, v) => {
    worley(u, v, 4, 31, .85);
    const gap = WF2 - WF1, r0 = ihash(WID, 0, 33), r1 = ihash(WID, 1, 33);
    const n = fbm(u, v, 16, 4, 34), n2 = fbm(u, v, 64, 2, 35), edge = smooth(.02, .22, gap);
    let h = .15 + edge * .55 + (n - .5) * .25 + (n2 - .5) * .06;
    let c = mulc(mixc(hex('#55574c'), hex('#72695a'), r0), .68 + n * .5 + (r1 - .5) * .16);
    if (gap < .03) c = mulc(hex('#26261f'), .6 + n);
    const moss = smooth(.55, .75, fbm(u, v, 8, 3, 36)) * (1 - edge * .6);
    c = mixc(c, mulc(hex('#3f5a26'), .6 + n2 * .6), moss * .7);
    if (Math.abs(fbm(u, v, 6, 4, 37) - .5) < .012 && edge > .5) { h -= .12; c = mulc(c, .45); }
    put(L, i, c); L.h[i] = h; L.g[i] = .1 + moss * .25;
  });
});

defTex('FLESH', L => {
  L.bump = 3.2;
  each(L, (x, y, i, u, v) => {
    worley(u, v, 6, 41, .9);
    const gap = WF2 - WF1, f1 = WF1, n = fbm(u, v, 8, 4, 42);
    const vein = Math.abs(fbm(u, v, 4, 4, 43) - .5), vein2 = Math.abs(fbm(u, v, 8, 3, 44) - .5), lobe = smooth(0, .45, gap);
    let h = .2 + lobe * .5 + (n - .5) * .2, e = 0;
    let c = mixc(hex('#5a1410'), hex('#9a3a2c'), lobe * .7 + n * .3);
    c = mixc(c, hex('#c86a58'), smooth(.55, .9, 1 - f1) * .25);
    if (gap < .06) { const k = 1 - gap / .06; c = mixc(c, hex('#ff7a20'), k); e = k * k * .9; h -= k * .15; }
    const vk = Math.min(1, (1 - smooth(.004, .02, vein)) + (1 - smooth(.003, .012, vein2)) * .6);
    if (vk > 0) { c = mixc(c, hex('#3a0a2a'), vk * .8); h += vk * .06; }
    put(L, i, c); L.h[i] = h; L.e[i] = e; L.g[i] = .55 + lobe * .3;
  });
  setSeed(45);
  for (let k = 0; k < 26; k++) disc(rnd() * TS, rnd() * TS, rr(2.5, 6), (i, d) => { const q = Math.sqrt(1 - d * d); L.h[i] += q * .25; put(L, i, mixc(get(L, i), hex('#d8b060'), .6 * q)); L.g[i] = .9; });
});

function doorBase(L, sa, sb) {
  L.bump = 2.4;
  each(L, (x, y, i, u, v) => {
    const brush = vnoise(u * 16, v * 160, 16, 160, 51), dent = fbm(u, v, 8, 3, 52), rib = x & 31, ribE = Math.min(rib - 4, 11 - rib);
    let h = .45 + (dent - .5) * .08, c = mulc(hex('#5b6470'), .75 + brush * .3 - (dent - .5) * .3);
    if (ribE >= 0 && y > 26 && y < 229) { h += .12 + smooth(0, 2, ribE) * .1; c = mulc(c, 1.12); }
    put(L, i, c); L.h[i] = h; L.g[i] = .45;
  });
  hazard(L, 0, 0, 256, 24, sa, sb, 32, .62); hazard(L, 0, 232, 256, 24, sa, sb, 32, .62);
  rect(0, 24, 256, 3, i => { L.h[i] = .3; put(L, i, hex('#1a1c20')); });
  rect(0, 229, 256, 3, i => { L.h[i] = .3; put(L, i, hex('#1a1c20')); });
  rect(0, 118, 256, 20, (i, x, y) => { const e = Math.min(y, 19 - y); L.h[i] = .62 + smooth(0, 3, e) * .12; put(L, i, mulc(hex('#6a7380'), .8 + vnoise(x / 3, y / 3, 86, 7, 53) * .3)); });
  for (let k = 0; k < 8; k++) rivet(L, 16 + k * 32, 128, 4, hex('#9aa0a8'));
  scratches(L, 60, 54);
}
defTex('DOOR', L => {
  doorBase(L, hex('#e0b020'), hex('#1a1a1a'));
  disc(236, 60, 7, (i, d) => { L.h[i] = .5; put(L, i, hex('#15171a')); });
  disc(236, 60, 4.5, (i, d) => { L.e[i] = 1 - d * .4; put(L, i, hex('#50ff80')); L.h[i] = .66; L.g[i] = .9; });
});
defTex('DOORRED', L => {
  doorBase(L, hex('#c01818'), hex('#1a1a1a'));
  rect(96, 40, 64, 64, (i, x, y) => { const e = Math.min(x, 63 - x, y, 63 - y); L.h[i] = e < 3 ? .8 : .5; put(L, i, e < 3 ? hex('#2a2d33') : hex('#101114')); });
  rect(104, 48, 48, 30, (i, x, y) => { const sc = y % 3 === 0 ? .7 : 1; put(L, i, mulc(hex('#ff3020'), sc)); L.e[i] = .85 * sc; L.g[i] = .9; });
  rect(118, 54, 20, 16, (i, x, y) => { if (x < 2 || x > 17 || y < 2 || y > 13 || (y > 4 && y < 7)) { put(L, i, hex('#ffd0c0')); L.e[i] = 1; } });
  rect(110, 84, 36, 10, i => { put(L, i, hex('#08090a')); L.h[i] = .35; });
});

function switchTex(L, on) {
  L.bump = 2.2;
  each(L, (x, y, i, u, v) => { const b = vnoise(u * 96, v * 12, 96, 12, 61); put(L, i, mulc(hex('#3c4148'), .75 + b * .3)); L.h[i] = .5 + b * .02; L.g[i] = .4; });
  rect(0, 0, 256, 256, (i, x, y) => { const e = Math.min(x, 255 - x, y, 255 - y); if (e < 6) { L.h[i] = .35 + e * .05; put(L, i, mulc(get(L, i), .7)); } });
  rect(72, 36, 112, 184, (i, x, y) => { const e = Math.min(x, 111 - x, y, 183 - y); L.h[i] = e < 4 ? .55 - e * .06 : .2; put(L, i, e < 4 ? hex('#2a2e34') : mulc(hex('#1c1f23'), .9 + vnoise(x / 4, y / 4, 28, 46, 62) * .2)); });
  const m = textMask('EXIT', 34), col = on ? hex('#50ff80') : hex('#ff4030');
  rect(80, 44, 96, 40, (i, x, y) => {
    const a = m.a(80 + x, Math.round(m.h / 2 - 20 + y));
    if (a > 0) { put(L, i, mixc(mulc(col, .1), col, a)); L.e[i] = a; L.h[i] = .26 + a * .04; } else { put(L, i, mulc(col, .1)); L.e[i] = .05; }
    L.g[i] = .9;
  });
  rect(120, 100, 16, 100, i => { L.h[i] = .05; put(L, i, hex('#07080a')); });
  const ly = on ? 176 : 112;
  rect(124, Math.min(ly, 150), 8, Math.abs(ly - 150) + 8, (i, x) => { put(L, i, mulc(hex('#a0a6ae'), .7 + (x / 8) * .5)); L.h[i] = .7; L.g[i] = .8; });
  disc(128, ly, 11, (i, d) => { const q = Math.sqrt(1 - d * d); put(L, i, mulc(on ? hex('#30e060') : hex('#e02a20'), .6 + q * .6)); L.h[i] = .75 + q * .2; L.e[i] = .35 + q * .3; L.g[i] = .9; });
  hazard(L, 76, 206, 104, 10, hex('#e0b020'), hex('#1a1a1a'), 16, .45);
  for (const [a, b] of [[16, 16], [240, 16], [16, 240], [240, 240]]) rivet(L, a, b, 5, hex('#8a9098'));
  scratches(L, 30, 63);
}
defTex('SWOFF', L => switchTex(L, false));
defTex('SWON', L => switchTex(L, true));

defTex('COMP', L => {
  L.bump = 2;
  each(L, (x, y, i, u, v) => { const b = vnoise(u * 64, v * 64, 64, 64, 71); put(L, i, mulc(hex('#5a5e56'), .75 + b * .25)); L.h[i] = .5; L.g[i] = .3; });
  for (const sx of [16, 136]) {
    rect(sx - 6, 10, 116, 84, (i, x, y) => { const e = Math.min(x, 115 - x, y, 83 - y); L.h[i] = .55 + smooth(0, 3, e) * .1; put(L, i, hex('#2b2e30')); });
    setSeed(sx);
    const lines = []; for (let k = 0; k < 9; k++) lines.push([rr(.2, .95), rnd() < .3]);
    rect(sx, 16, 104, 72, (i, x, y) => {
      const scan = y % 2 ? .75 : 1; let e = .12, col = hex('#0c3a2a');
      if (sx === 16) { const row = (y - 4) / 7 | 0, ly = (y - 4) % 7; if (y >= 4 && row < 9 && ly < 4 && x > 4 && x < 4 + lines[row][0] * 96) { e = .9; col = lines[row][1] ? hex('#ffd060') : hex('#60ffb0'); } }
      else {
        const gy = 36 + Math.sin(x * .18) * 14 * Math.cos(x * .031);
        if (x > 6 && x < 98 && Math.abs(y - gy) < 1.6) { e = 1; col = hex('#70ffc0'); }
        if (y === 36 || x === 52) { e = Math.max(e, .35); col = mixc(col, hex('#1e8a5a'), .5); }
      }
      put(L, i, mulc(col, scan)); L.e[i] = e * scan; L.h[i] = .4; L.g[i] = .95;
    });
  }
  setSeed(72);
  const pal = [hex('#ff3a2a'), hex('#ffc030'), hex('#40ff70'), hex('#40a0ff')];
  for (let r = 0; r < 2; r++) for (let k = 0; k < 12; k++) {
    const cx = 22 + k * 20, cy = 116 + r * 20, c = pal[rnd() * 4 | 0], lit = rnd() < .6;
    rect(cx - 6, cy - 5, 12, 10, (i, x, y) => { const e = Math.min(x, 11 - x, y, 9 - y); L.h[i] = .6 + smooth(0, 2, e) * .12; put(L, i, mulc(c, lit ? 1 : .35)); L.e[i] = lit ? .7 : 0; L.g[i] = .8; });
  }
  rect(12, 160, 232, 84, i => { L.h[i] = .35; put(L, i, hex('#232628')); });
  for (let r = 0; r < 5; r++) for (let k = 0; k < 17; k++) {
    const x0 = 16 + k * 13 + (r & 1) * 5, y0 = 166 + r * 15; if (x0 + 11 > 242) continue;
    rect(x0, y0, 11, 12, (i, x, y) => { const e = Math.min(x, 10 - x, y, 11 - y); L.h[i] = .45 + smooth(0, 2, e) * .15; put(L, i, mulc(hex('#8a8e86'), .7 + smooth(0, 2, e) * .3 - (y > 8 ? .1 : 0))); L.g[i] = .3; });
  }
  scratches(L, 20, 73, 1.2);
});

defTex('BEAM', L => {
  L.bump = 2.6;
  each(L, (x, y, i, u, v) => {
    const n = fbm(u, v, 8, 4, 81), rust = smooth(.55, .75, fbm(u, v, 4, 4, 82));
    let h, c;
    if (y < 40 || y > 215) { const e = y < 40 ? Math.min(y, 39 - y) : Math.min(y - 216, 255 - y); h = .6 + smooth(0, 3, e) * .15; c = hex('#6a6258'); }
    else { h = .35; c = hex('#4e4943'); const s = x & 127; if (s < 6 || s > 121) { h = .5; c = hex('#5a544c'); } }
    c = mixc(mulc(c, .7 + n * .5), mulc(hex('#7a3a14'), .7 + n * .6), rust * .85);
    put(L, i, c); L.h[i] = h + (n - .5) * .05 - rust * .04; L.g[i] = .35 - rust * .25;
  });
  for (let k = 0; k < 16; k++) { rivet(L, 8 + k * 16, 20, 4, hex('#8a847a')); rivet(L, 8 + k * 16, 236, 4, hex('#8a847a')); }
  for (let k = 0; k < 2; k++) for (let r = 0; r < 5; r++) rivet(L, k * 128, 60 + r * 34, 3.5, hex('#8a847a'));
  scratches(L, 40, 83);
});

defTex('STEP', L => {
  L.bump = 2.2;
  each(L, (x, y, i, u, v) => { const n = fbm(u, v, 8, 3, 91); put(L, i, mulc(hex('#3e3a36'), .7 + n * .5)); L.h[i] = .45 + (n - .5) * .06; L.g[i] = .3; });
  hazard(L, 0, 0, 256, 40, hex('#d8a818'), hex('#141414'), 40, .6);
  rect(0, 40, 256, 4, i => { L.h[i] = .3; put(L, i, hex('#141414')); });
  for (let k = 0; k < 8; k++) rivet(L, 16 + k * 32, 62, 4, hex('#8a8680'));
  scratches(L, 80, 92, 1.35);
});

defTex('SLIME', L => {
  L.bump = 2.4;
  each(L, (x, y, i, u, v) => {
    const n = fbm(u, v, 8, 4, 101); let c = mulc(hex('#4a4c48'), .6 + n * .5), h = .45 + (n - .5) * .1;
    if ((x & 127) < 3 || (y & 127) < 3) { h = .3; c = mulc(c, .5); }
    put(L, i, c); L.h[i] = h; L.g[i] = .3;
  });
  for (const [a, b] of [[8, 8], [120, 8], [136, 8], [248, 8], [8, 136], [120, 136], [136, 136], [248, 136]]) rivet(L, a, b, 4, hex('#7a7c76'));
  setSeed(102);
  const slime = (i, q) => { put(L, i, mixc(get(L, i), hex('#6ad02a'), .8 * q + .1)); L.e[i] = Math.max(L.e[i], .28 * q); L.g[i] = .9; L.h[i] += .05 * q; };
  for (let k = 0; k < 34; k++) {
    const x0 = rnd() * TS, len = rr(12, 70), w = rr(2, 5);
    for (let y = 0; y < len; y++) { const ww = w * (1 - y / len * .6); for (let dx = -ww; dx <= ww; dx++) slime(wrapI(Math.round(x0 + dx + Math.sin(y * .05 + k) * 2), y), 1 - Math.abs(dx) / (ww + .01)); }
  }
  rect(0, 52, 256, 12, (i, x, y) => slime(i, .6 + vnoise(x / 6, y / 3, 43, 4, 103) * .4));
});

defTex('MARBLE', L => {
  L.bump = 1.5;
  each(L, (x, y, i, u, v) => {
    const w = fbm(u, v, 4, 5, 111), vk = Math.pow(1 - Math.abs(Math.sin((u * 3 + v * 2 + w * 4) * Math.PI)), 12);
    let c = mixc(mixc(hex('#0e2a1a'), hex('#1e4a2c'), fbm(u, v, 8, 3, 112)), hex('#8ac0a0'), vk * .8), h = .5;
    if ((x & 127) < 2 || (y & 127) < 2) { h = .38; c = mulc(c, .4); }
    put(L, i, c); L.h[i] = h; L.g[i] = .85;
  });
});
