/* ───────── 레벨: 격자 · 높이 · 조명 굽기 ─────────
   # 벽 · T 기술벽 · S 컴퓨터 기둥 · X 출구 스위치 · D 잠긴 봉쇄문 · d 문 · W 창
   P 시작 · i 임프 · z 데몬 · b 폭발 드럼 · h 의료 키트 · a 탄약 · r 방호복 · k 키카드 · g 샷건 */
const SRC = [
  '#############XX#############',
  '#......#T..........T########',
  '#..g...#T....h.....T########',
  '#......#T..........T########',
  '#.i....#T..i....i..T########',
  '#......#TTTTTDTTTTTT########',
  '#..a...######.##############',
  '#...z..######.##############',
  '#......#............########',
  '#....h....b.........########',
  '#......#..S..i...S..########',
  '########............########',
  '########b...........d......#',
  '#####..d............#..z...#',
  '#####.##..S......S..#......#',
  '#####.##....i...b...W.r....#',
  '#####.##............#...z..#',
  '#......##############......#',
  '#....a.##############......#',
  '#..h...##############...i..#',
  '#......##############..k...#',
  '#...P..##############a....h#',
  '#......##############......#',
  '############################',
];
const MW = SRC[0].length, MH = SRC.length;
const F_SKY = 1, F_DOOR = 2, F_NUK = 4, F_BLOOD = 8, F_PULSE = 16;
const LAMP_CELLS = [[2, 19], [5, 21], [5, 14], [9, 9], [18, 9], [9, 15], [18, 15], [11, 3], [16, 3], [13, 6]];
const DECOR = [
  { k: 'lamp', x: 8.5, y: 16.5 }, { k: 'lamp', x: 19.5, y: 16.5 }, { k: 'lamp', x: 19.5, y: 9.5 },
  { k: 'candle', x: 2.5, y: 1.5 }, { k: 'candle', x: 4.5, y: 1.5 }, { k: 'candle', x: 1.5, y: 8.5 }, { k: 'candle', x: 6.5, y: 5.5 },
  { k: 'torch', x: 26.5, y: 13.5 }, { k: 'torch', x: 21.5, y: 18.5 }, { k: 'torch', x: 26.5, y: 20.5 },
  { k: 'marine', x: 9.5, y: 13.4 },
];
let CELLS = [], SPAWNS = [], LIGHTS = [];

function wallTex(x, y, ch) {
  if (ch === 'T') return TX.TECH;
  if (ch === 'S') return TX.COMP;
  if (ch === 'X') return TX.SWOFF;
  if (x <= 7 && y <= 11) return TX.STONE;
  if (x >= 7 && x <= 20 && y >= 5 && y <= 17) return TX.TECH;
  if (x >= 21 && y >= 11) return TX.FLESH;
  if (x >= 20 && y >= 17) return TX.FLESH;
  return TX.BRICK;
}
function buildLevel() {
  CELLS = []; SPAWNS = []; LIGHTS = [];
  for (let y = 0; y < MH; y++) {
    if (SRC[y].length !== MW) throw new Error('map row ' + y + ' has wrong length');
    for (let x = 0; x < MW; x++) {
      const ch = SRC[y][x], solid = '#TSX'.includes(ch);
      const c = { x, y, ch, h0: 0, h1: 1, fl: 0, em: 1, side: TX.BEAM, lower: TX.STEP, floor: TX.FTILE, ceil: TX.CPANEL, solid };
      if (solid) { c.h0 = 50; c.h1 = -50; c.side = c.lower = wallTex(x, y, ch); if (c.side === TX.FLESH) c.fl |= F_PULSE; }
      else if (ch === 'D' || ch === 'd') { c.door = { locked: ch === 'D', open: 0, moving: false }; c.fl |= F_DOOR; c.side = ch === 'D' ? TX.DOORRED : TX.DOOR; c.lower = TX.STEP; c.floor = c.ceil = TX.FPLATE; }
      else if (ch === 'W') { c.window = true; c.side = c.lower = TX.TECH; c.floor = c.ceil = TX.FPLATE; c.h0 = .38; c.h1 = .82; }
      else if ('Pizharkgb'.includes(ch)) SPAWNS.push({ ch, x: x + .5, y: y + .5 });
      CELLS.push(c);
    }
  }
  const Z = (x0, y0, x1, y1, p) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = CELLS[y * MW + x]; if (!c.solid && !c.door && !c.window) Object.assign(c, p); } };
  Z(1, 17, 6, 22, { h1: 1.1, floor: TX.FTILE, ceil: TX.CPANEL, side: TX.BRICK, lower: TX.STEP });
  Z(1, 17, 3, 17, { h0: .42, lower: TX.COMP, floor: TX.FPLATE });
  Z(5, 13, 6, 16, { h1: .9, floor: TX.FPLATE, ceil: TX.CPANEL, side: TX.TECH });
  Z(8, 8, 19, 16, { h1: 1.6, floor: TX.FTILE, ceil: TX.CPANEL, side: TX.BEAM, lower: TX.SLIME });
  Z(8, 8, 19, 8, { h0: .2, floor: TX.FPLATE, lower: TX.STEP });
  Z(11, 9, 16, 15, { h1: 2.8, fl: F_SKY });
  Z(12, 11, 15, 13, { h0: -.25, floor: TX.NUKAGE, fl: F_SKY | F_NUK });
  Z(13, 6, 13, 7, { h0: .2, h1: 1, floor: TX.FPLATE, ceil: TX.CPANEL, side: TX.TECH, lower: TX.STEP });
  Z(9, 1, 18, 4, { h0: .2, h1: 1.4, floor: TX.FPLATE, ceil: TX.CPANEL, side: TX.TECH, lower: TX.STEP });
  Z(12, 1, 15, 1, { h0: .36 });
  Z(1, 1, 6, 10, { h1: 1.3, floor: TX.FSTONE, ceil: TX.CSTONE, side: TX.STONE, lower: TX.MARBLE });
  Z(2, 1, 4, 3, { h0: .2, floor: TX.MARBLE });
  Z(7, 9, 7, 9, { h1: .9, floor: TX.FSTONE, ceil: TX.CSTONE, side: TX.STONE });
  Z(21, 12, 26, 22, { h1: 1.3, floor: TX.FBLOODY, ceil: TX.CSTONE, side: TX.FLESH, lower: TX.FLESH, fl: F_PULSE });
  Z(24, 17, 25, 18, { h0: -.12, floor: TX.BLOODL, fl: F_PULSE | F_BLOOD });
  Z(23, 20, 23, 20, { h0: .12, floor: TX.MARBLE, lower: TX.MARBLE });
  for (const [x, y] of LAMP_CELLS) CELLS[y * MW + x].ceil = TX.CLAMP;
  const door = (x, y, h0, hOpen) => { const c = CELLS[y * MW + x]; c.h0 = c.h1 = h0; c.door.h0 = h0; c.door.hOpen = hOpen; };
  door(13, 5, .2, 1); door(7, 13, 0, .85); door(20, 12, 0, .85);

  const L = (x, y, z, c, i, r) => LIGHTS.push({ x, y, z, c: hex(c), i, r });
  L(2.5, 19.5, 1.02, '#ffe6c8', 1.5, 5.5); L(5.5, 21.5, 1.02, '#ffe6c8', 1.4, 5.5);
  L(2.5, 17.6, .7, '#6affb0', .5, 2.6);
  L(5.5, 14.5, .8, '#d8e8ff', .3, 3.5);
  L(13.5, 6.5, .95, '#ffe0c0', 1.1, 4);
  for (const [x, y] of [[9, 9], [18, 9], [9, 15], [18, 15]]) L(x + .5, y + .5, 1.5, '#dce8ff', 1.6, 6.5);
  for (const d of DECOR) {
    if (d.k === 'lamp') L(d.x, d.y, .78, '#cfe0ff', 1.0, 4);
    if (d.k === 'candle') L(d.x, d.y, .78, '#ffa050', 1.05, 4.5);
    if (d.k === 'torch') L(d.x, d.y, .68, '#ff5020', 1.25, 4.8);
  }
  for (const c of CELLS) {
    if (c.fl & F_NUK) L(c.x + .5, c.y + .5, -.05, '#7aff40', .42, 2.8);
    else if (c.fl & F_SKY) L(c.x + .5, c.y + .5, 2.5, '#ff9a5a', .33, 4.2);
  }
  L(13.5, 1.25, .75, '#ff3a20', .9, 3.2); L(14.5, 1.25, .75, '#ff3a20', .5, 3);
  for (const [x, y] of [[11, 3], [16, 3]]) L(x + .5, y + .5, 1.35, '#ffe0c0', 1.1, 5);
  L(23.5, 20.5, .4, '#ff2020', .6, 2.2);
  L(22, 15, .9, '#ff4a20', .4, 3.5); L(25.5, 21, .9, '#ff4a20', .35, 3);
}

/* 셀 조회 · 시야 · 사격 판정 */
function cellAt(x, y) { const ix = Math.floor(x), iy = Math.floor(y); return (ix < 0 || iy < 0 || ix >= MW || iy >= MH) ? null : CELLS[iy * MW + ix]; }
const isOpen = c => !!c && c.h1 - c.h0 > .02;
function floorAt(x, y) { const c = cellAt(x, y); return c ? c.h0 : 0; }
// 두 점 사이 선분이 모든 셀의 [바닥, 천장] 범위 안에 머무르는지
function segClear(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay;
  let ix = Math.floor(ax), iy = Math.floor(ay);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  let tx = dx !== 0 ? (dx > 0 ? ix + 1 - ax : ax - ix) * tdx : Infinity, ty = dy !== 0 ? (dy > 0 ? iy + 1 - ay : ay - iy) * tdy : Infinity, t = 0;
  for (let n = 0; n < 256; n++) {
    if (ix < 0 || iy < 0 || ix >= MW || iy >= MH) return false;
    const c = CELLS[iy * MW + ix], tn = Math.min(tx, ty, 1), z0 = az + (bz - az) * t, z1 = az + (bz - az) * tn;
    if (Math.min(z0, z1) < c.h0 - 1e-3 || Math.max(z0, z1) > c.h1 + 1e-3) return false;
    if (tn >= 1) return true;
    t = tn; if (tx < ty) { tx += tdx; ix += sx; } else { ty += tdy; iy += sy; }
  }
  return true;
}
// 높이 z에서 수평으로 쏜 광선이 처음 막히는 곳 (거리·면 노멀·앞쪽 열린 셀)
function rayHit(ax, ay, az, dx, dy, maxD) {
  let ix = Math.floor(ax), iy = Math.floor(ay);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  let tx = dx !== 0 ? (dx > 0 ? ix + 1 - ax : ax - ix) * tdx : Infinity, ty = dy !== 0 ? (dy > 0 ? iy + 1 - ay : ay - iy) * tdy : Infinity;
  let prev = cellAt(ax, ay);
  for (let n = 0; n < 256; n++) {
    let d, nx = 0, ny = 0;
    if (tx < ty) { d = tx; tx += tdx; ix += sx; nx = -sx; } else { d = ty; ty += tdy; iy += sy; ny = -sy; }
    if (d > maxD) return { d: maxD, nx: 0, ny: 0, cell: null, open: prev };
    if (ix < 0 || iy < 0 || ix >= MW || iy >= MH) return { d, nx, ny, cell: null, open: prev };
    const c = CELLS[iy * MW + ix];
    if (az < c.h0 || az > c.h1) return { d, nx, ny, cell: c, open: prev };
    prev = c;
  }
  return { d: maxD, nx: 0, ny: 0, cell: null, open: prev };
}

/* 조명 굽기: 셀당 4×4 텍셀. irr = 방사조도 RGB + 바닥 차폐(A), dir = 주광 방향 xyz + 방향성(A) */
const LM = 4, LMW = MW * LM, LMH = MH * LM;
function bakeLight() {
  const N = LMW * LMH, irr = new Float32Array(N * 4), dir = new Float32Array(N * 4), open = new Uint8Array(N);
  for (let j = 0; j < LMH; j++) for (let i = 0; i < LMW; i++) {
    const x = (i + .5) / LM, y = (j + .5) / LM, c = cellAt(x, y), o = (j * LMW + i) * 4;
    if (!isOpen(c) || c.window) continue;
    open[j * LMW + i] = 1;
    const pz = clamp(c.h0 + .45, c.h0 + .02, c.h1 - .02);
    let r = .026, g = .022, b = .022, dx = 0, dy = 0, dz = 0, ws = 0;
    for (const Lt of LIGHTS) {
      const lx = Lt.x - x, ly = Lt.y - y, lz = Lt.z - pz, d = Math.hypot(lx, ly, lz);
      if (d >= Lt.r) continue;
      const att = Lt.i * (1 - d / Lt.r) ** 2;
      if (att < .004 || !segClear(x, y, pz, Lt.x, Lt.y, Lt.z)) continue;
      r += Lt.c[0] * att; g += Lt.c[1] * att; b += Lt.c[2] * att;
      const w = att * (Lt.c[0] + Lt.c[1] + Lt.c[2]) / 3, id = 1 / Math.max(d, .05);
      dx += lx * id * w; dy += ly * id * w; dz += lz * id * w; ws += w;
    }
    irr[o] = r; irr[o + 1] = g; irr[o + 2] = b;
    const dl = Math.hypot(dx, dy, dz);
    if (dl > 1e-6) { dir[o] = dx / dl; dir[o + 1] = dy / dl; dir[o + 2] = dz / dl; dir[o + 3] = dl / ws; } else { dir[o + 2] = 1; }
    // 바닥 차폐: 주변에 벽이나 높은 바닥이 있으면 어둡게
    let occ = 0, cnt = 0;
    for (const rad of [.3, .6]) for (let k = 0; k < 10; k++) {
      const a = k / 10 * TAU + rad * 3, q = cellAt(x + Math.cos(a) * rad, y + Math.sin(a) * rad); cnt++;
      if (!isOpen(q) || q.h0 > c.h0 + .15) occ += rad < .5 ? 1 : .6;
    }
    irr[o + 3] = 1 - .6 * occ / cnt;
  }
  // 약하게 흐리게 (부드러운 그림자)
  const tmp = new Float32Array(irr);
  for (let j = 0; j < LMH; j++) for (let i = 0; i < LMW; i++) {
    if (!open[j * LMW + i]) continue;
    const s = [0, 0, 0, 0]; let n = 0;
    for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) {
      const ii = i + u, jj = j + v; if (ii < 0 || jj < 0 || ii >= LMW || jj >= LMH || !open[jj * LMW + ii]) continue;
      const k = (jj * LMW + ii) * 4, w = u === 0 && v === 0 ? 2 : 1; for (let c = 0; c < 4; c++) s[c] += tmp[k + c] * w; n += w;
    }
    const o = (j * LMW + i) * 4; for (let c = 0; c < 4; c++) irr[o + c] = s[c] / n;
  }
  // 벽 안쪽 텍셀을 이웃 값으로 채워 쌍선형 보간 시 검게 번지지 않게 한다
  for (let it = 0; it < 4; it++) {
    const add = [];
    for (let j = 0; j < LMH; j++) for (let i = 0; i < LMW; i++) {
      if (open[j * LMW + i]) continue;
      const s = new Float32Array(8); let n = 0;
      for (const [u, v] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + u, jj = j + v; if (ii < 0 || jj < 0 || ii >= LMW || jj >= LMH || !open[jj * LMW + ii]) continue;
        const k = (jj * LMW + ii) * 4; for (let c = 0; c < 4; c++) { s[c] += irr[k + c]; s[4 + c] += dir[k + c]; } n++;
      }
      if (n) add.push(j * LMW + i, s.map(v => v / n));
    }
    for (let k = 0; k < add.length; k += 2) { const o = add[k] * 4, s = add[k + 1]; for (let c = 0; c < 4; c++) { irr[o + c] = s[c]; dir[o + c] = s[4 + c]; } open[add[k]] = 2; }
    for (let k = 0; k < add.length; k += 2) open[add[k]] = 1;
  }
  return { irr, dir };
}
function mapData() {
  const m0 = new Float32Array(MW * MH * 4), m1 = new Uint8Array(MW * MH * 4);
  CELLS.forEach((c, i) => { m0.set([c.h0, c.h1, c.fl, c.em], i * 4); m1.set([c.side, c.lower, c.floor, c.ceil], i * 4); });
  return { m0, m1 };
}
