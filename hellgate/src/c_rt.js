/* ───────── 스프라이트용 소형 레이트레이서 ─────────
   구·타원체·캡슐·원기둥·상자 원시도형으로 만든 모델을 알베도(차폐 포함)와 시점 공간 노멀로 굽는다.
   좌표: x 오른쪽, y 위, z 카메라 쪽. 결과 노멀 맵은 R·G = 노멀 xy, B = 광택, A = 발광. */
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const v3 = (x, y, z) => [x, y, z];
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vscl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vlen = a => Math.hypot(a[0], a[1], a[2]);
const vnorm = a => vscl(a, 1 / (vlen(a) || 1));
const vlerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function mv(R, v) { return [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]]; }
function mm(A, B) { const o = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o.push(A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]); return o; }
const rotX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const rotY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rotZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
// 로컬 y축이 dir을 향하는 회전 (팔다리 타원체 정렬용)
function axisTo(dir) {
  const y = vnorm(dir), t = Math.abs(y[0]) < .9 ? [1, 0, 0] : [0, 0, 1];
  const z = vnorm(vcross(t, y)), x = vcross(y, z);
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}

// 원시도형 생성자 — m: { col:[r,g,b] | fn(x,y,z,prim), spec, emit, bump, bf, mott, mf }
const Sph = (c, r, m) => ({ k: 0, c, r, m });
const Ell = (c, rad, R, m) => ({ k: 1, c, rad, R: R || I3, m });
const Cap = (a, b, r, m) => ({ k: 2, a, b, r, m });
const Cyl = (a, b, r, m) => ({ k: 3, a, b, r, m });
const Box = (c, h, R, m, bev = .012) => ({ k: 4, c, h, R: R || I3, m, bev });
// 두 점 사이를 가늘어지는 구 사슬로 잇는다 (뿔·가시·이빨·손톱)
function spike(out, a, b, r0, r1, m, n = 5) { for (let i = 0; i < n; i++) { const t = i / (n - 1); out.push(Sph(vlerp(a, b, t), lerp(r0, r1, t), m)); } }
function limbEll(out, a, b, r, m) { const d = vsub(b, a); out.push(Ell(vlerp(a, b, .5), [r, vlen(d) / 2 + r * .35, r * .92], axisTo(d), m)); }

function xform(prims, R, t = [0, 0, 0]) {
  return prims.map(p => {
    const q = Object.assign({}, p);
    if (p.c) q.c = vadd(mv(R, p.c), t);
    if (p.a) { q.a = vadd(mv(R, p.a), t); q.b = vadd(mv(R, p.b), t); }
    if (p.R) q.R = mm(R, p.R);
    return q;
  });
}
function prep(prims) {
  for (const p of prims) {
    if (p.k === 0) { p.bc = p.c; p.br = p.r; }
    else if (p.k === 1) { p.bc = p.c; p.br = Math.max(p.rad[0], p.rad[1], p.rad[2]); }
    else if (p.k === 2 || p.k === 3) {
      p.bc = vlerp(p.a, p.b, .5); p.br = vlen(vsub(p.b, p.a)) / 2 + p.r;
      p.bax = p.b[0] - p.a[0]; p.bay = p.b[1] - p.a[1]; p.baz = p.b[2] - p.a[2]; p.baba = p.bax * p.bax + p.bay * p.bay + p.baz * p.baz;
    } else { p.bc = p.c; p.br = vlen(p.h); }
  }
  return prims;
}

function isect(p, ox, oy, oz, dx, dy, dz) {
  switch (p.k) {
    case 0: {
      const px = ox - p.c[0], py = oy - p.c[1], pz = oz - p.c[2], b = px * dx + py * dy + pz * dz, h = b * b - (px * px + py * py + pz * pz - p.r * p.r);
      return h < 0 ? -1 : -b - Math.sqrt(h);
    }
    case 1: {
      const R = p.R, wx = ox - p.c[0], wy = oy - p.c[1], wz = oz - p.c[2];
      const ax = (R[0] * wx + R[3] * wy + R[6] * wz) / p.rad[0], ay = (R[1] * wx + R[4] * wy + R[7] * wz) / p.rad[1], az = (R[2] * wx + R[5] * wy + R[8] * wz) / p.rad[2];
      const bx = (R[0] * dx + R[3] * dy + R[6] * dz) / p.rad[0], by = (R[1] * dx + R[4] * dy + R[7] * dz) / p.rad[1], bz = (R[2] * dx + R[5] * dy + R[8] * dz) / p.rad[2];
      const a = bx * bx + by * by + bz * bz, b = ax * bx + ay * by + az * bz, c = ax * ax + ay * ay + az * az - 1, h = b * b - a * c;
      return h < 0 ? -1 : (-b - Math.sqrt(h)) / a;
    }
    case 2: {
      const oax = ox - p.a[0], oay = oy - p.a[1], oaz = oz - p.a[2];
      const bard = p.bax * dx + p.bay * dy + p.baz * dz, baoa = p.bax * oax + p.bay * oay + p.baz * oaz;
      const rdoa = dx * oax + dy * oay + dz * oaz, oaoa = oax * oax + oay * oay + oaz * oaz;
      const a = p.baba - bard * bard; let b = p.baba * rdoa - baoa * bard, c = p.baba * oaoa - baoa * baoa - p.r * p.r * p.baba, h = b * b - a * c;
      if (h >= 0) {
        const t = (-b - Math.sqrt(h)) / a, y = baoa + t * bard;
        if (y > 0 && y < p.baba) return t;
        const ocx = y <= 0 ? oax : ox - p.b[0], ocy = y <= 0 ? oay : oy - p.b[1], ocz = y <= 0 ? oaz : oz - p.b[2];
        b = dx * ocx + dy * ocy + dz * ocz; c = ocx * ocx + ocy * ocy + ocz * ocz - p.r * p.r; h = b * b - c;
        if (h > 0) return -b - Math.sqrt(h);
      }
      return -1;
    }
    case 3: {
      const ocx = ox - p.a[0], ocy = oy - p.a[1], ocz = oz - p.a[2];
      const bard = p.bax * dx + p.bay * dy + p.baz * dz, baoc = p.bax * ocx + p.bay * ocy + p.baz * ocz;
      const k2 = p.baba - bard * bard, k1 = p.baba * (ocx * dx + ocy * dy + ocz * dz) - baoc * bard;
      const k0 = p.baba * (ocx * ocx + ocy * ocy + ocz * ocz) - baoc * baoc - p.r * p.r * p.baba;
      let h = k1 * k1 - k2 * k0; if (h < 0) return -1; h = Math.sqrt(h);
      let t = (-k1 - h) / k2; const y = baoc + t * bard;
      if (y > 0 && y < p.baba) return t;
      t = ((y < 0 ? 0 : p.baba) - baoc) / bard;
      return Math.abs(k1 + k2 * t) < h ? t : -1;
    }
    default: {
      const R = p.R, wx = ox - p.c[0], wy = oy - p.c[1], wz = oz - p.c[2];
      const o = [R[0] * wx + R[3] * wy + R[6] * wz, R[1] * wx + R[4] * wy + R[7] * wz, R[2] * wx + R[5] * wy + R[8] * wz];
      const d = [R[0] * dx + R[3] * dy + R[6] * dz, R[1] * dx + R[4] * dy + R[7] * dz, R[2] * dx + R[5] * dy + R[8] * dz];
      let tn = -1e9, tf = 1e9;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-9) { if (Math.abs(o[i]) > p.h[i]) return -1; continue; }
        let t1 = (-p.h[i] - o[i]) / d[i], t2 = (p.h[i] - o[i]) / d[i]; if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
        if (t1 > tn) tn = t1; if (t2 < tf) tf = t2; if (tn > tf) return -1;
      }
      return tn > 0 ? tn : -1;
    }
  }
}
let NX = 0, NY = 0, NZ = 1;
function normalOf(p, x, y, z) {
  let n;
  switch (p.k) {
    case 0: n = [x - p.c[0], y - p.c[1], z - p.c[2]]; break;
    case 1: {
      const R = p.R, wx = x - p.c[0], wy = y - p.c[1], wz = z - p.c[2];
      const l = [(R[0] * wx + R[3] * wy + R[6] * wz) / (p.rad[0] * p.rad[0]), (R[1] * wx + R[4] * wy + R[7] * wz) / (p.rad[1] * p.rad[1]), (R[2] * wx + R[5] * wy + R[8] * wz) / (p.rad[2] * p.rad[2])];
      n = mv(R, l); break;
    }
    case 2: case 3: {
      const pax = x - p.a[0], pay = y - p.a[1], paz = z - p.a[2], hh = (pax * p.bax + pay * p.bay + paz * p.baz) / p.baba;
      if (p.k === 3 && hh <= 1e-4) n = [-p.bax, -p.bay, -p.baz];
      else if (p.k === 3 && hh >= 1 - 1e-4) n = [p.bax, p.bay, p.baz];
      else { const h = clamp(hh, 0, 1); n = [pax - h * p.bax, pay - h * p.bay, paz - h * p.baz]; }
      break;
    }
    default: {
      const R = p.R, wx = x - p.c[0], wy = y - p.c[1], wz = z - p.c[2];
      const q = [R[0] * wx + R[3] * wy + R[6] * wz, R[1] * wx + R[4] * wy + R[7] * wz, R[2] * wx + R[5] * wy + R[8] * wz];
      let ax = 0, best = -1;
      for (let i = 0; i < 3; i++) { const r = Math.abs(q[i]) / p.h[i]; if (r > best) { best = r; ax = i; } }
      const l = [0, 0, 0]; l[ax] = Math.sign(q[ax]);
      for (let i = 0; i < 3; i++) if (i !== ax) l[i] = Math.sign(q[i]) * smooth(p.h[i] - p.bev, p.h[i], Math.abs(q[i])) * .9;
      n = mv(R, l);
    }
  }
  const il = 1 / (Math.hypot(n[0], n[1], n[2]) || 1); NX = n[0] * il; NY = n[1] * il; NZ = n[2] * il;
}
function localOf(p, x, y, z) { // 타원체·상자 로컬 좌표
  const R = p.R, wx = x - p.c[0], wy = y - p.c[1], wz = z - p.c[2];
  return [R[0] * wx + R[3] * wy + R[6] * wz, R[1] * wx + R[4] * wy + R[7] * wz, R[2] * wx + R[5] * wy + R[8] * wz];
}

function occluded(prims, x, y, z, dx, dy, dz, maxT) {
  for (let k = 0; k < prims.length; k++) {
    const p = prims[k], cx = p.bc[0] - x, cy = p.bc[1] - y, cz = p.bc[2] - z, along = cx * dx + cy * dy + cz * dz;
    if (along < -p.br || along > maxT + p.br) continue;
    if (cx * cx + cy * cy + cz * cz - along * along > p.br * p.br) continue;
    const t = isect(p, x, y, z, dx, dy, dz); if (t > 1e-4 && t < maxT) return true;
  }
  return false;
}
// 한 점을 셰이딩: 알베도·노멀·광택·발광을 out에 기록
const AO_DIRS = [[0, 1, 0], [.7, .45, .55], [-.7, .45, .55], [0, .3, 1]];
function shadeAt(prims, p, x, y, z, out, o) {
  normalOf(p, x, y, z);
  let nx = NX, ny = NY, nz = NZ;
  const m = p.m;
  let col = typeof m.col === 'function' ? m.col(x, y, z, p) : m.col;
  if (m.mott) { const f = fbm3(x * m.mf, y * m.mf, z * m.mf, 3); col = mulc(col, 1 + (f - .5) * m.mott); }
  if (m.bump) {
    const f = m.bf, e = .15, qx = x * f, qy = y * f, qz = z * f, n0 = fbm3(qx, qy, qz, 2);
    const gx = (fbm3(qx + e, qy, qz, 2) - n0) / e, gy = (fbm3(qx, qy + e, qz, 2) - n0) / e, gz = (fbm3(qx, qy, qz + e, 2) - n0) / e;
    const gd = gx * nx + gy * ny + gz * nz;
    nx -= (gx - gd * nx) * m.bump; ny -= (gy - gd * ny) * m.bump; nz -= (gz - gd * nz) * m.bump;
    const il = 1 / Math.hypot(nx, ny, nz); nx *= il; ny *= il; nz *= il;
  }
  let vis = 0;
  const ox = x + nx * .004, oy = y + ny * .004, oz = z + nz * .004;
  for (const d of AO_DIRS) {
    let ax = d[0] + nx, ay = d[1] + ny, az = d[2] + nz; const il = 1 / (Math.hypot(ax, ay, az) || 1); ax *= il; ay *= il; az *= il;
    if (!occluded(prims, ox, oy, oz, ax, ay, az, .22)) vis++;
  }
  const occ = m.emit ? 1 : .42 + .58 * vis / AO_DIRS.length;
  out.col[o] = clamp(col[0] * occ, 0, 1) * 255; out.col[o + 1] = clamp(col[1] * occ, 0, 1) * 255; out.col[o + 2] = clamp(col[2] * occ, 0, 1) * 255;
  out.nrm[o] = (nx * .5 + .5) * 255; out.nrm[o + 1] = (ny * .5 + .5) * 255; out.nrm[o + 2] = clamp(m.spec || .15, 0, 1) * 255; out.nrm[o + 3] = clamp(m.emit || 0, 0, 1) * 255;
}

/* 이미지 렌더: cam = { ortho:true, ps, x0, y0 } 또는 { f } (원근: 원점에서 -z를 본다) */
function rtRender(prims, W, H, cam) {
  prep(prims);
  const out = { w: W, h: H, col: new Uint8Array(W * H * 4), nrm: new Uint8Array(W * H * 4) };
  const TB = 8, tw = Math.ceil(W / TB), th = Math.ceil(H / TB), bins = Array.from({ length: tw * th }, () => []);
  for (const p of prims) {
    let sx, sy, sr;
    if (cam.ortho) { sx = (p.bc[0] - cam.x0) / cam.ps; sy = H - (p.bc[1] - cam.y0) / cam.ps; sr = p.br / cam.ps; }
    else { const zz = Math.max(.02, -p.bc[2]); sx = W / 2 + p.bc[0] / zz * cam.f; sy = H / 2 - p.bc[1] / zz * cam.f; sr = p.br / Math.max(.02, zz - p.br) * cam.f * 1.05; }
    const x0 = clamp(Math.floor((sx - sr) / TB), 0, tw - 1), x1 = clamp(Math.floor((sx + sr) / TB), 0, tw - 1);
    const y0 = clamp(Math.floor((sy - sr) / TB), 0, th - 1), y1 = clamp(Math.floor((sy + sr) / TB), 0, th - 1);
    if (sx + sr < 0 || sy + sr < 0 || sx - sr > W || sy - sr > H) continue;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) bins[ty * tw + tx].push(p);
  }
  const ray = (px, py) => { // 픽셀 좌표 → 광선 (전역 변수로 전달)
    if (cam.ortho) { RO[0] = cam.x0 + px * cam.ps; RO[1] = cam.y0 + (H - py) * cam.ps; RO[2] = 50; RD[0] = 0; RD[1] = 0; RD[2] = -1; }
    else { RO[0] = 0; RO[1] = 0; RO[2] = 0; const dx = (px - W / 2) / cam.f, dy = -(py - H / 2) / cam.f, il = 1 / Math.hypot(dx, dy, 1); RD[0] = dx * il; RD[1] = dy * il; RD[2] = -il; }
  };
  const nearest = (list) => {
    let best = 1e9, bp = null;
    for (let k = 0; k < list.length; k++) { const t = isect(list[k], RO[0], RO[1], RO[2], RD[0], RD[1], RD[2]); if (t > 1e-5 && t < best) { best = t; bp = list[k]; } }
    HT = best; return bp;
  };
  const hitMask = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const list = bins[(j / TB | 0) * tw + (i / TB | 0)]; if (!list.length) continue;
    ray(i + .5, j + .5); const p = nearest(list); if (!p) continue;
    const o = (j * W + i) * 4;
    shadeAt(prims, p, RO[0] + RD[0] * HT, RO[1] + RD[1] * HT, RO[2] + RD[2] * HT, out, o);
    out.col[o + 3] = 255; hitMask[j * W + i] = 1;
  }
  // 가장자리 픽셀만 4배 샘플로 덮임 비율(알파)을 계산
  const SUB = [[.25, .25], [.75, .25], [.25, .75], [.75, .75]];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const m = hitMask[j * W + i];
    const edge = (i > 0 && hitMask[j * W + i - 1] !== m) || (i < W - 1 && hitMask[j * W + i + 1] !== m) || (j > 0 && hitMask[(j - 1) * W + i] !== m) || (j < H - 1 && hitMask[(j + 1) * W + i] !== m);
    if (!edge) continue;
    const list = bins[(j / TB | 0) * tw + (i / TB | 0)]; if (!list.length) continue;
    let cnt = 0, firstP = null, fx = 0, fy = 0, fz = 0;
    for (const s of SUB) { ray(i + s[0], j + s[1]); const p = nearest(list); if (p) { cnt++; if (!firstP) { firstP = p; fx = RO[0] + RD[0] * HT; fy = RO[1] + RD[1] * HT; fz = RO[2] + RD[2] * HT; } } }
    const o = (j * W + i) * 4;
    if (!m && firstP) shadeAt(prims, firstP, fx, fy, fz, out, o);
    out.col[o + 3] = cnt * 255 / 4;
  }
  dilate(out, 4);
  return out;
}
const RO = [0, 0, 0], RD = [0, 0, -1]; let HT = 0;
// 투명 픽셀 RGB를 이웃 색으로 채워 밉맵 가장자리 번짐을 막는다
function dilate(img, iters) {
  const { w, h, col, nrm } = img, filled = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) filled[i] = col[i * 4 + 3] > 0 ? 1 : 0;
  for (let it = 0; it < iters; it++) {
    const add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (filled[i]) continue;
      let n = 0; const s = [0, 0, 0, 0, 0, 0, 0];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const k = yy * w + xx; if (!filled[k]) continue;
        n++; for (let c = 0; c < 3; c++) s[c] += col[k * 4 + c]; for (let c = 0; c < 4; c++) s[3 + c] += nrm[k * 4 + c];
      }
      if (n) add.push(i, s.map(v => v / n));
    }
    for (let k = 0; k < add.length; k += 2) { const i = add[k], s = add[k + 1]; for (let c = 0; c < 3; c++) col[i * 4 + c] = s[c]; for (let c = 0; c < 4; c++) nrm[i * 4 + c] = s[3 + c]; filled[i] = 1; }
  }
  for (let i = 0; i < w * h; i++) if (!filled[i]) { nrm[i * 4] = 128; nrm[i * 4 + 1] = 128; }
}

/* 아틀라스: 선반(shelf) 방식으로 채운다 */
const ATLAS = { W: 2048, H: 1536, col: null, nrm: null, x: 0, y: 0, rowH: 0, pad: 8 };
function atlasInit() { ATLAS.col = new Uint8Array(ATLAS.W * ATLAS.H * 4); ATLAS.nrm = new Uint8Array(ATLAS.W * ATLAS.H * 4); ATLAS.x = ATLAS.y = ATLAS.rowH = 0; }
function atlasPut(img) {
  const A = ATLAS;
  if (A.x + img.w > A.W) { A.x = 0; A.y += A.rowH + A.pad; A.rowH = 0; }
  if (A.y + img.h > A.H) throw new Error('sprite atlas full');
  for (let y = 0; y < img.h; y++) {
    A.col.set(img.col.subarray(y * img.w * 4, (y + 1) * img.w * 4), ((A.y + y) * A.W + A.x) * 4);
    A.nrm.set(img.nrm.subarray(y * img.w * 4, (y + 1) * img.w * 4), ((A.y + y) * A.W + A.x) * 4);
  }
  const rec = { u0: A.x / A.W, v0: A.y / A.H, u1: (A.x + img.w) / A.W, v1: (A.y + img.h) / A.H, w: img.w, h: img.h };
  A.x += img.w + A.pad; A.rowH = Math.max(A.rowH, img.h);
  return rec;
}
