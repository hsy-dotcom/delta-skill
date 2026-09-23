/* ───────── 공용 수학 · 난수 · 노이즈 ───────── */
const $ = id => document.getElementById(id);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const fract = x => x - Math.floor(x);
const yieldFrame = () => new Promise(r => setTimeout(r, 0));

let seed = 1;
function setSeed(s) { seed = s | 0; }
function rnd() { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const rr = (a, b) => a + (b - a) * rnd();

function ihash(x, y, s) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function ihash3(x, y, z) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483587) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// 주기 px·py로 이어지는 2D 값 노이즈 (텍스처가 이음매 없이 반복되도록)
function vnoise(x, y, px, py, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px, y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
  const a = ihash(x0, y0, s), b = ihash(x1, y0, s), c = ihash(x0, y1, s), d = ihash(x1, y1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
// u,v ∈ [0,1) 텍스처 좌표 기준 fBm. f는 정수여야 이음매가 없다.
function fbm(u, v, f, oct, s, gain = .5) {
  let sum = 0, amp = 1, norm = 0;
  for (let o = 0; o < oct; o++) { const p = f << o; sum += amp * vnoise(u * p, v * p, p, p, s + o * 17); norm += amp; amp *= gain; }
  return sum / norm;
}
// 이음매 없는 셀룰러(워리) 노이즈: 결과는 전역 WF1·WF2·WID·WX·WY
let WF1 = 0, WF2 = 0, WID = 0, WX = 0, WY = 0;
function worley(u, v, f, s, jitter = 1) {
  const x = u * f, y = v * f, xi = Math.floor(x), yi = Math.floor(y);
  let f1 = 9, f2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, wx = ((cx % f) + f) % f, wy = ((cy % f) + f) % f;
    const px = cx + .5 + (ihash(wx, wy, s) - .5) * jitter, py = cy + .5 + (ihash(wx, wy, s + 1) - .5) * jitter;
    const d = Math.hypot(px - x, py - y);
    if (d < f1) { f2 = f1; f1 = d; WID = wy * f + wx; WX = px / f; WY = py / f; } else if (d < f2) f2 = d;
  }
  WF1 = f1; WF2 = f2; return f1;
}
// 3D 값 노이즈 (레이트레이서 표면 질감용, 반복 불필요)
function vnoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const a = ihash3(xi, yi, zi), b = ihash3(xi + 1, yi, zi), c = ihash3(xi, yi + 1, zi), d = ihash3(xi + 1, yi + 1, zi);
  const e = ihash3(xi, yi, zi + 1), f = ihash3(xi + 1, yi, zi + 1), g = ihash3(xi, yi + 1, zi + 1), h = ihash3(xi + 1, yi + 1, zi + 1);
  const k0 = a + (b - a) * ux, k1 = c + (d - c) * ux, k2 = e + (f - e) * ux, k3 = g + (h - g) * ux;
  const m0 = k0 + (k1 - k0) * uy, m1 = k2 + (k3 - k2) * uy;
  return m0 + (m1 - m0) * uz;
}
function fbm3(x, y, z, oct) {
  let s = 0, a = 1, n = 0;
  for (let o = 0; o < oct; o++) { s += a * vnoise3(x, y, z); n += a; a *= .5; x = x * 2.03 + 17.1; y = y * 2.03 + 3.7; z = z * 2.03 + 9.3; }
  return s / n;
}

const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mulc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
