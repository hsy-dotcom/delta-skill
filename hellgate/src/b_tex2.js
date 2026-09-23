/* ── 바닥 · 천장 · 액체 · 하늘 ── */
function tileFloor(L, s) {
  L.bump = 2.2;
  each(L, (x, y, i, u, v) => {
    const lx = x & 63, ly = y & 63, inside = Math.min(lx - 1.5, 61.5 - lx, ly - 1.5, 61.5 - ly);
    const r0 = ihash(x >> 6, y >> 6, s), n = fbm(u, v, 16, 4, s + 1), dirt = fbm(u, v, 4, 4, s + 2);
    let h, c;
    if (inside <= 0) { h = .15; c = mulc(hex('#2a2622'), .6 + n * .6); }
    else { h = .45 + smooth(0, 3, inside) * .1 + (n - .5) * .05; c = mulc(mixc(hex('#6c665c'), hex('#7c7468'), r0), .75 + n * .35); }
    c = mulc(c, 1 - smooth(.5, .8, dirt) * .45);
    put(L, i, c); L.h[i] = h; L.g[i] = inside > 0 ? .38 : .1;
  });
  setSeed(s + 5);
  for (let k = 0; k < 5; k++) {           // 금 간 타일
    let x = rnd() * TS, y = rnd() * TS, a = rnd() * TAU;
    for (let j = 0; j < 40; j++) { const nx = x + Math.cos(a) * 1.5, ny = y + Math.sin(a) * 1.5; line(x, y, nx, ny, i => { L.h[i] -= .1; put(L, i, mulc(get(L, i), .5)); }); x = nx; y = ny; a += rr(-.5, .5); }
  }
  for (let k = 0; k < 6; k++) disc(rnd() * TS, rnd() * TS, rr(6, 18), (i, d) => { put(L, i, mulc(get(L, i), .55 + d * .45)); L.g[i] = Math.max(L.g[i], .6 * (1 - d)); });
  rect(136, 72, 48, 48, (i, x, y) => { const e = Math.min(x, 47 - x, y, 47 - y); if (e < 4) { L.h[i] = .55; put(L, i, hex('#5a5a58')); } else if ((y & 7) < 4) { L.h[i] = .05; put(L, i, hex('#060606')); } else { L.h[i] = .5; put(L, i, hex('#48484a')); L.g[i] = .5; } });
  scratches(L, 50, s + 3, 1.2);
}
defTex('FTILE', L => tileFloor(L, 121));

defTex('FPLATE', L => {
  L.bump = 2.8;
  each(L, (x, y, i, u, v) => {
    const n = fbm(u, v, 8, 4, 131), cx = x & 15, cy = y & 15, a = ((x >> 4) + (y >> 4)) & 1 ? 1 : -1;
    const dx = cx - 7.5, dy = cy - 7.5, p = (dx + a * dy) * .7071, q = (dx - a * dy) * .7071;
    const d = Math.hypot(p / 5.5, q / 1.6), bump = d < 1 ? Math.sqrt(1 - d * d) : 0;
    let h = .4 + bump * .25 + (n - .5) * .04, c = mulc(hex('#6e7076'), .62 + n * .4 + bump * .12);
    const rust = smooth(.62, .8, fbm(u, v, 4, 4, 133)) * (1 - bump);
    c = mixc(c, mulc(hex('#6a3a18'), .7 + n * .5), rust * .8);
    if ((x & 127) < 2 || (y & 127) < 2) { h = .2; c = mulc(c, .4); }
    put(L, i, c); L.h[i] = h; L.g[i] = .55 + bump * .2 - rust * .4;
  });
  for (const a of [6, 122, 134, 250]) for (const b of [6, 122, 134, 250]) rivet(L, a, b, 3.5, hex('#8a8c90'));
  scratches(L, 70, 134, 1.25);
});

defTex('FSTONE', L => {
  L.bump = 2.6;
  each(L, (x, y, i, u, v) => {
    worley(u, v, 5, 141, .9);
    const gap = WF2 - WF1, r0 = ihash(WID, 3, 141), n = fbm(u, v, 16, 4, 142), edge = smooth(.03, .12, gap);
    let c = mulc(mixc(hex('#5a544a'), hex('#6e665a'), r0), .7 + n * .45);
    if (gap < .04) c = mulc(hex('#221e18'), .7 + n * .5);
    c = mulc(c, 1 - smooth(.5, .75, fbm(u, v, 6, 3, 143)) * .35);
    put(L, i, c); L.h[i] = .2 + edge * .45 + (n - .5) * .12; L.g[i] = .15;
  });
});

defTex('FBLOODY', L => {
  tileFloor(L, 151);
  setSeed(152);
  for (let k = 0; k < 7; k++) {
    const cx = rnd() * TS, cy = rnd() * TS, r = rr(14, 40), s = k * 7 + 3;
    disc(cx, cy, r * 1.3, (i, d, dx, dy) => {
      const ang = Math.atan2(dy, dx), edge = .55 + .45 * vnoise(Math.cos(ang) * 2.5 + 9, Math.sin(ang) * 2.5 + 9, 999, 999, s);
      if (d * 1.3 < edge) { put(L, i, mixc(get(L, i), mulc(hex('#5a0806'), .8 + .4 * smooth(edge, edge - .2, d * 1.3)), .92)); L.g[i] = .85; L.h[i] += .02; }
    });
    for (let j = 0; j < 12; j++) { const a = rnd() * TAU, dist = r * rr(1.1, 2.2); disc(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, rr(1.5, 4), i => { put(L, i, hex('#4a0604')); L.g[i] = .85; }); }
  }
});

function ceilPanels(L, s) {
  L.bump = 2.2;
  each(L, (x, y, i, u, v) => {
    const lx = x & 63, ly = y & 63, e = Math.min(lx, 63 - lx, ly, 63 - ly);
    const n = fbm(u, v, 16, 3, s), dots = vnoise(u * 128, v * 128, 128, 128, s + 1);
    let h, c;
    if (e < 4) { h = .7 - e * .05; c = mulc(hex('#8a8c90'), .7 + n * .3); }
    else { h = .35 + (dots > .6 ? .02 : 0); c = mulc(hex('#5c5a54'), .78 + n * .3 - (dots > .7 ? .08 : 0)); }
    c = mixc(c, mulc(hex('#5a4020'), .8), smooth(.6, .8, fbm(u, v, 4, 4, s + 2)) * .5 * (e >= 4 ? 1 : .3));
    put(L, i, c); L.h[i] = h; L.g[i] = e < 4 ? .5 : .08;
  });
}
defTex('CPANEL', L => {
  ceilPanels(L, 161);
  rect(132, 196, 56, 56, (i, x, y) => { const e = Math.min(x, 55 - x, y, 55 - y); if (e < 3) { L.h[i] = .6; put(L, i, hex('#7a7c80')); } else if ((x & 7) < 4) { L.h[i] = .05; put(L, i, hex('#08080a')); } else { L.h[i] = .45; put(L, i, hex('#6a6c70')); } });
});
defTex('CLAMP', L => {
  ceilPanels(L, 171);
  rect(40, 64, 176, 128, (i, x, y) => { const e = Math.min(x, 175 - x, y, 127 - y); L.h[i] = e < 6 ? .8 - e * .03 : .3; put(L, i, e < 6 ? hex('#9a9ca0') : hex('#d8d4c8')); L.g[i] = .7; L.e[i] = e < 6 ? 0 : .3; });
  for (let k = 0; k < 3; k++) rect(52, 82 + k * 34, 152, 20, (i, x, y) => { const q = Math.sin((y + .5) / 20 * Math.PI); put(L, i, mixc(hex('#fff0d4'), hex('#ffffff'), q)); L.e[i] = .75 + q * .25; L.h[i] = .4 + q * .15; L.g[i] = .9; });
  for (let k = 0; k < 9; k++) rect(40 + k * 21, 64, 3, 128, i => { L.h[i] = .9; put(L, i, hex('#6a6c70')); L.e[i] = 0; });
  rect(40, 126, 176, 3, i => { L.h[i] = .9; put(L, i, hex('#6a6c70')); L.e[i] = 0; });
});
defTex('CSTONE', L => {
  L.bump = 3.4;
  each(L, (x, y, i, u, v) => {
    const n = fbm(u, v, 4, 5, 181), r = 1 - Math.abs(fbm(u, v, 8, 4, 182) * 2 - 1);
    put(L, i, mulc(mixc(hex('#3a3430'), hex('#5a5048'), n), .6 + r * .5)); L.h[i] = .3 + n * .4 + r * r * .25; L.g[i] = .1;
  });
});
defTex('NUKAGE', L => {
  L.bump = 1.2;
  each(L, (x, y, i, u, v) => {
    const w1 = fbm(u, v, 4, 4, 191), w2 = fbm(u + w1 * .3, v + w1 * .2, 8, 4, 192);
    const c = mixc(hex('#1e6a10'), hex('#8cf040'), smooth(.3, .8, w2));
    worley(u, v, 10, 193, .9);
    const ring = WF1 < .22 ? smooth(.12, .19, WF1) * smooth(.22, .19, WF1) : 0;
    put(L, i, mixc(c, hex('#d8ff90'), ring * .8)); L.e[i] = .45 + w2 * .45 + ring * .3; L.h[i] = .5 + (w2 - .5) * .2 + ring * .1; L.g[i] = .95;
  });
});
defTex('BLOODL', L => {
  L.bump = 1.4;
  each(L, (x, y, i, u, v) => {
    const w1 = fbm(u, v, 4, 4, 201), w2 = fbm(u + w1 * .4, v, 8, 4, 202);
    put(L, i, mixc(hex('#2a0202'), hex('#7a0a06'), smooth(.25, .85, w2))); L.e[i] = .04 + smooth(.7, .9, w2) * .12; L.h[i] = .5 + (w2 - .5) * .25; L.g[i] = .95;
  });
});

/* ── 화성 하늘 파노라마 (가로로 이어짐) ── */
const SKY_W = 1024, SKY_H = 320;
function skyNoise(u, v, f, oct, s) {
  let sum = 0, amp = 1, norm = 0;
  for (let o = 0; o < oct; o++) { const p = f << o; sum += amp * vnoise(u * p, v * p * .35, p, 1 << 20, s + o); norm += amp; amp *= .5; }
  return sum / norm;
}
function buildSky() {
  const px = new Uint8Array(SKY_W * SKY_H * 4);
  const sunU = .3, sunE = .16, moonU = .62, moonE = .55, moonR = .045;
  const ridge = new Float32Array(SKY_W), ridge2 = new Float32Array(SKY_W);
  for (let x = 0; x < SKY_W; x++) { const u = x / SKY_W; ridge[x] = .05 + skyNoise(u, 3.7, 6, 5, 211) * .16; ridge2[x] = .09 + skyNoise(u, 9.1, 4, 5, 212) * .2; }
  for (let y = 0; y < SKY_H; y++) for (let x = 0; x < SKY_W; x++) {
    const u = x / SKY_W, v = y / SKY_H, el = 1 - v;
    let c = mixc(hex('#f08a48'), hex('#6a2014'), Math.pow(el, .55));
    c = mixc(c, hex('#1c0707'), smooth(.55, 1, el) * .7);
    const cl = skyNoise(u, v * 3, 8, 5, 213), band = smooth(.45, .75, cl) * (1 - el * .8);
    c = mixc(c, hex('#ffb480'), band * .35);
    c = mixc(c, hex('#3a1008'), smooth(.55, .8, skyNoise(u + .37, v * 5, 16, 4, 214)) * .25 * el);
    let du = Math.abs(u - sunU); du = Math.min(du, 1 - du) * 4.5;
    const ds = Math.hypot(du, el - sunE);
    c = [c[0] + Math.exp(-ds * ds * 60) * .55 + Math.exp(-ds * ds * 900) * .8, c[1] + Math.exp(-ds * ds * 60) * .38 + Math.exp(-ds * ds * 900) * .75, c[2] + Math.exp(-ds * ds * 60) * .2 + Math.exp(-ds * ds * 900) * .6];
    let dm = Math.abs(u - moonU); dm = Math.min(dm, 1 - dm) * 4.5;
    const mx = dm * (u < moonU ? -1 : 1), my = el - moonE, md = Math.hypot(mx, my) / moonR;
    if (md < 1) {
      const nz = Math.sqrt(1 - md * md), lit = clamp(-mx / moonR * .8 + nz * .45 + .15, 0, 1), cr = vnoise(mx * 300 + 50, my * 300 + 50, 9999, 9999, 215);
      c = mixc(c, mulc(hex('#b8aa9c'), (.25 + lit * .9) * (.8 + cr * .35)), smooth(1, .92, md));
    }
    const r1 = ridge[x], r2 = ridge2[x];
    if (el < r2) c = mixc(c, mixc(hex('#8a4a30'), hex('#c0704a'), smooth(r2 - .03, r2, el)), .55);
    if (el < r1) { const rim = smooth(r1 - .015, r1, el); c = mixc(mixc(hex('#2a120a'), hex('#9a5030'), rim * .8), c, smooth(0, r1, el) * .18); }
    const o = (y * SKY_W + x) * 4;
    px[o] = clamp(c[0], 0, 1) * 255; px[o + 1] = clamp(c[1], 0, 1) * 255; px[o + 2] = clamp(c[2], 0, 1) * 255; px[o + 3] = 255;
  }
  return px;
}

async function buildTextures(onProgress) {
  const layers = [];
  for (let k = 0; k < TEXGEN.length; k++) {
    const L = newLayer(); TEXGEN[k].fn(L); layers.push(finalize(L));
    onProgress((k + 1) / (TEXGEN.length + 1)); await yieldFrame();
  }
  const sky = buildSky(); onProgress(1);
  return { layers, sky };
}
