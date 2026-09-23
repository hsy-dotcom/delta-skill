/* ───────── HUD · 얼굴 · 사운드 · 입력 · 루프 · 부팅 ───────── */
const view = $('view'), cvs = $('screen');

/* 사운드 (잔향 포함) */
let AC = null, NOISE = null, MASTER = null;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const dry = AC.createGain(), wet = AC.createGain(), conv = AC.createConvolver();
    MASTER = AC.createGain(); MASTER.gain.value = .5;
    const len = AC.sampleRate * 1.6, ir = AC.createBuffer(2, len, AC.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    conv.buffer = ir; dry.gain.value = .85; wet.gain.value = .32;
    MASTER.connect(dry); MASTER.connect(conv); conv.connect(wet); dry.connect(AC.destination); wet.connect(AC.destination);
    NOISE = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = NOISE.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function noise(dur, freq, v, type = 'lowpass', t0 = 0) {
  const t = AC.currentTime + t0, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = NOISE; f.type = type; f.frequency.value = freq; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f); f.connect(g); g.connect(MASTER); s.start(t); s.stop(t + dur + .05);
}
function tone(dur, f0, f1, v, type = 'square', t0 = 0) {
  const t = AC.currentTime + t0, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(MASTER); o.start(t); o.stop(t + dur + .05);
}
function sfx(n, v = 1) {
  if (!AC || v < .03) return;
  switch (n) {
    case 'pistol': noise(.2, 2600, .7 * v); tone(.09, 180, 55, .45 * v); break;
    case 'shotgun': noise(.45, 1500, .95 * v); tone(.28, 110, 38, .65 * v, 'sine'); noise(.12, 500, .4 * v, 'lowpass', .42); noise(.1, 1100, .3 * v, 'bandpass', .58); break;
    case 'click': tone(.04, 900, 700, .15 * v); break;
    case 'oof': tone(.14, 160, 90, .25 * v, 'sawtooth'); break;
    case 'impfire': tone(.35, 520, 120, .25 * v, 'sawtooth'); noise(.3, 900, .22 * v, 'bandpass'); break;
    case 'boom': noise(1, 450, 1 * v); tone(.7, 90, 28, .8 * v, 'sine'); noise(.4, 2000, .3 * v, 'highpass'); break;
    case 'splash': noise(.3, 700, .45 * v); break;
    case 'hurt': tone(.18, 240, 110, .35 * v); break;
    case 'die': tone(.9, 220, 50, .4 * v, 'sawtooth'); break;
    case 'pickup': tone(.06, 660, 660, .18 * v); tone(.08, 990, 990, .18 * v, 'square', .06); break;
    case 'weapon': tone(.08, 330, 330, .18 * v); tone(.08, 440, 440, .18 * v, 'square', .08); tone(.12, 660, 660, .18 * v, 'square', .16); break;
    case 'door': noise(.9, 300, .5 * v); tone(.9, 55, 42, .35 * v, 'sawtooth'); noise(.15, 900, .3 * v, 'bandpass', .85); break;
    case 'locked': tone(.12, 200, 200, .25 * v); tone(.12, 150, 150, .25 * v, 'square', .14); break;
    case 'impdie': tone(.5, 300, 60, .35 * v, 'sawtooth'); break;
    case 'demondie': tone(.6, 160, 40, .45 * v, 'sawtooth'); noise(.4, 500, .3 * v); break;
    case 'pain': tone(.15, 380, 200, .22 * v, 'sawtooth'); break;
    case 'bite': noise(.1, 2000, .5 * v, 'highpass'); tone(.12, 140, 90, .4 * v); break;
    case 'sight': tone(.3, 200, 420, .2 * v, 'sawtooth'); break;
    case 'switch': tone(.08, 300, 300, .3 * v); tone(.5, 600, 1200, .25 * v, 'triangle', .1); break;
  }
}
const vol = (x, y) => Math.min(1, 2.5 / (1 + Math.hypot(x - P.x, y - P.y) * .5));

/* 메시지 · HUD · 얼굴 */
function say(text) {
  if (!text) return;
  const box = $('msg'), d = document.createElement('div'); d.textContent = text; box.appendChild(d);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => d.remove(), 3200);
}
let hudKey = '', faceKey = '', faceLook = 0, faceLookT = 0, faceOuch = 0, faceGrin = 0;
const faceCtx = $('face').getContext('2d');
function updateHud() {
  const ammo = P.weapon ? P.shells : P.bullets;
  const k = [ammo, P.hp, P.armor, P.weapon, P.hasShotgun, P.key, G.kills, P.bullets, P.shells].join('|');
  if (k !== hudKey) {
    hudKey = k;
    $('h-ammo').textContent = ammo; $('h-hp').textContent = P.hp + '%'; $('h-armor').textContent = P.armor + '%';
    $('s1').className = 'have' + (P.weapon === 0 ? ' on' : ''); $('s2').className = (P.hasShotgun ? 'have' : '') + (P.weapon === 1 ? ' on' : '');
    $('h-key').className = 'keyslot' + (P.key ? ' have' : ''); $('h-kills').textContent = `${G.kills}/${G.totalKills}`;
    $('h-bul').textContent = `${P.bullets}/200`; $('h-sh').textContent = `${P.shells}/50`;
  }
  const mood = P.dead ? 'dead' : faceOuch > 0 ? 'ouch' : faceGrin > 0 ? 'grin' : 'n';
  const band = P.hp > 80 ? 0 : P.hp > 60 ? 1 : P.hp > 40 ? 2 : P.hp > 20 ? 3 : 4, fk = mood + band + faceLook;
  if (fk !== faceKey) { faceKey = fk; drawFace(mood, band, faceLook); }
}
function drawFace(mood, band, look) {
  const g = faceCtx, W = 48, H = 56;
  g.clearRect(0, 0, W, H);
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#3a302a'); bg.addColorStop(1, '#1c1512'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const skin = g.createRadialGradient(20, 24, 2, 24, 30, 20);
  skin.addColorStop(0, mood === 'dead' ? '#9a6a50' : '#e0a47a'); skin.addColorStop(1, mood === 'dead' ? '#4a2a1c' : '#7a4a30');
  g.fillStyle = skin; g.beginPath(); g.ellipse(24, 30, 15, 20, 0, 0, TAU); g.fill();
  g.fillStyle = '#4a2c18'; g.beginPath(); g.ellipse(24, 13, 15, 8, 0, Math.PI, TAU); g.fill(); g.fillRect(9, 12, 30, 5);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(9, 17, 30, 2);
  if (mood === 'dead') { g.fillStyle = '#2a0a06'; g.fillRect(13, 26, 8, 3); g.fillRect(27, 26, 8, 3); g.fillRect(17, 40, 14, 4); }
  else {
    g.fillStyle = '#f2ebdd'; g.fillRect(13, 24, 8, 6); g.fillRect(27, 24, 8, 6);
    const lx = look * 2; g.fillStyle = '#3a6a4a'; g.fillRect(16 + lx, 25, 3, 4); g.fillRect(30 + lx, 25, 3, 4);
    g.fillStyle = '#101010'; g.fillRect(17 + lx, 26, 1, 2); g.fillRect(31 + lx, 26, 1, 2);
    g.fillStyle = '#3a200e';
    if (mood === 'ouch') { g.fillRect(12, 20, 9, 2); g.fillRect(27, 20, 9, 2); g.beginPath(); g.ellipse(24, 42, 4, 4, 0, 0, TAU); g.fill(); }
    else if (mood === 'grin') { g.fillRect(12, 21, 9, 2); g.fillRect(27, 21, 9, 2); g.fillStyle = '#f7f1e6'; g.fillRect(15, 39, 18, 4); g.fillStyle = '#3a200e'; g.fillRect(15, 43, 18, 1); }
    else { g.fillRect(12, 21, 9, 2); g.fillRect(27, 21, 9, 2); g.fillRect(18, 41, 12, 2); }
    g.fillStyle = 'rgba(90,40,20,.5)'; g.fillRect(22, 30, 4, 7);
  }
  const spots = [[12, 34], [34, 16], [31, 38], [15, 16], [36, 30], [21, 47], [10, 28], [28, 47], [37, 22], [16, 35], [34, 44], [24, 17]];
  for (let i = 0; i < band * 3; i++) { const [x, y] = spots[i]; g.fillStyle = '#8a0e06'; g.fillRect(x, y, 3 + (i % 2), 3); g.fillRect(x + 1, y + 3, 1, 3 + (i % 3)); }
}

/* 자동 지도 (2D 덧그림) */
const mapCv = document.createElement('canvas');
mapCv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
mapCv.hidden = true; view.insertBefore(mapCv, $('msg'));
function drawAutomap() {
  const r = view.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  mapCv.width = r.width * dpr; mapCv.height = r.height * dpr;
  const g = mapCv.getContext('2d'), W = mapCv.width, H = mapCv.height;
  g.fillStyle = 'rgba(8,5,4,.86)'; g.fillRect(0, 0, W, H);
  const cs = Math.floor(Math.min(W / (MW + 2), H / (MH + 2))), ox = (W - cs * MW) / 2, oy = (H - cs * MH) / 2;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (!SEEN[y * MW + x]) continue;
    const c = CELLS[y * MW + x];
    g.fillStyle = c.door ? '#e0b020' : c.ch === 'X' ? (G.switchOn ? '#42ff80' : '#ff4a30') : c.solid ? (c.side === TX.FLESH ? '#8a1a10' : c.side === TX.STONE ? '#6a6a5a' : '#7a4a30') : (c.fl & F_NUK) ? '#3a8a20' : c.window ? '#4a6a8a' : c.h0 > .1 ? '#3a2e28' : '#261c18';
    g.fillRect(ox + x * cs, oy + y * cs, cs - (c.solid ? 0 : 1), cs - (c.solid ? 0 : 1));
  }
  const px = ox + P.x * cs, py = oy + P.y * cs, c = Math.cos(P.a), s = Math.sin(P.a), rr2 = cs * .9;
  g.fillStyle = '#ecdfc6'; g.beginPath(); g.moveTo(px + c * rr2, py + s * rr2); g.lineTo(px - c * rr2 * .7 - s * rr2 * .6, py - s * rr2 * .7 + c * rr2 * .6); g.lineTo(px - c * rr2 * .7 + s * rr2 * .6, py - s * rr2 * .7 - c * rr2 * .6); g.fill();
  g.fillStyle = '#f29a2e'; g.font = `${12 * dpr}px "Nanum Gothic Coding", monospace`; g.fillText('자동 지도 · E1M1 · Tab으로 닫기', 16 * dpr, H - 16 * dpr);
}

/* 흐름 */
const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function statsHtml(win, best) {
  return `<dt>처치</dt><dd>${G.kills}/${G.totalKills}<small>${Math.round(G.kills / G.totalKills * 100)}%</small></dd>` +
    `<dt>아이템</dt><dd>${G.itemsTaken}/${G.totalItems}<small>${Math.round(G.itemsTaken / G.totalItems * 100)}%</small></dd>` +
    `<dt>시간</dt><dd>${fmt(G.gameTime)}<small>기준 3:00${win && best ? ' · 최고 ' + fmt(best) : ''}</small></dd>`;
}
function loadBest() { try { const v = parseFloat(localStorage.getItem('hellgate-best')); return isFinite(v) ? v : 0; } catch (e) { return 0; } }
function showBest() { const b = loadBest(); $('best').textContent = b ? `최고 기록 ${fmt(b)}.` : ''; }
function endRun(win) {
  G.state = win ? 'win' : 'dead'; firing = false; touchFire = false;
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
  let best = loadBest();
  if (win && (!best || G.gameTime < best)) { best = G.gameTime; try { localStorage.setItem('hellgate-best', String(best)); } catch (e) {} }
  if (win) { $('win-stats').innerHTML = statsHtml(true, best); $('win').hidden = false; $('again').focus(); }
  else { $('dead-stats').innerHTML = statsHtml(false); $('dead').hidden = false; $('retry').focus(); }
}
function lockPointer() { try { const r = cvs.requestPointerLock && cvs.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
function start() {
  if (!G.ready) return;
  resetGame(); SEEN.fill(0); initAudio();
  $('title').hidden = true; $('dead').hidden = true; $('win').hidden = true;
  G.state = 'play'; $('msg').textContent = '';
  say('E1M1: 화성 제3격납고'); say('빨간 키카드를 찾아라.');
  lockPointer();
}

/* 입력 */
const keys = {};
let firing = false, touchFire = false, turnAcc = 0, showPerf = false;
const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 }, look = { id: null, lx: 0 };
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyF' && !e.repeat) { showPerf = !showPerf; $('perf').textContent = ''; }
  if (G.state !== 'play') { if (e.code === 'Enter' && !e.repeat && G.state === 'title' && document.activeElement?.tagName !== 'BUTTON') start(); return; }
  if (e.repeat) return;
  if (e.code === 'KeyE' || e.code === 'Space') use();
  else if (e.code === 'Digit1') switchWeapon(0);
  else if (e.code === 'Digit2') { if (P.hasShotgun) switchWeapon(1); else say('샷건이 없다.'); }
  else if (e.code === 'KeyQ') { if (P.hasShotgun) switchWeapon(1 - P.weapon); }
  else if (e.code === 'Tab' || e.code === 'KeyM') { G.automap = !G.automap; mapCv.hidden = !G.automap; }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; firing = false; });
document.addEventListener('mousemove', e => { if (G.state === 'play' && document.pointerLockElement === cvs) turnAcc += e.movementX * .0024; });
view.addEventListener('pointerdown', e => {
  if (G.state !== 'play' || e.target.closest('.tbtn')) return;
  initAudio();
  if (e.pointerType === 'mouse') { if (e.button === 0) { firing = true; if (document.pointerLockElement !== cvs) lockPointer(); } return; }
  const r = view.getBoundingClientRect();
  if (e.clientX - r.left < r.width * .45 && stick.id === null) {
    Object.assign(stick, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
    const st = $('stick'); st.style.display = 'block'; st.style.left = (e.clientX - r.left) + 'px'; st.style.top = (e.clientY - r.top) + 'px'; st.firstChild.style.transform = '';
  } else if (look.id === null) { look.id = e.pointerId; look.lx = e.clientX; }
  try { view.setPointerCapture(e.pointerId); } catch (_) {}
});
view.addEventListener('pointermove', e => {
  if (G.state !== 'play') return;
  if (e.pointerType === 'mouse') { if (document.pointerLockElement !== cvs && (e.buttons & 1)) turnAcc += e.movementX * .005; return; }
  if (e.pointerId === stick.id) {
    const mx = clamp(e.clientX - stick.ox, -40, 40), my = clamp(e.clientY - stick.oy, -40, 40);
    stick.x = mx / 40; stick.y = -my / 40; $('stick').firstChild.style.transform = `translate(${mx}px,${my}px)`;
  } else if (e.pointerId === look.id) { turnAcc += (e.clientX - look.lx) * .009; look.lx = e.clientX; }
});
function endPointer(e) {
  if (e.pointerType === 'mouse') { firing = false; return; }
  if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; $('stick').style.display = 'none'; }
  if (e.pointerId === look.id) look.id = null;
}
view.addEventListener('pointerup', endPointer); view.addEventListener('pointercancel', endPointer);
addEventListener('mouseup', () => { firing = false; });
view.addEventListener('contextmenu', e => e.preventDefault());
const tfire = $('t-fire');
tfire.addEventListener('pointerdown', e => { e.stopPropagation(); initAudio(); touchFire = true; });
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => tfire.addEventListener(t, () => { touchFire = false; }));
$('t-use').addEventListener('pointerdown', e => { e.stopPropagation(); initAudio(); use(); });
$('start').addEventListener('click', start); $('retry').addEventListener('click', start); $('again').addEventListener('click', start);

/* 해상도: 캔버스는 화면 해상도, 장면은 프레임 속도에 맞춰 배율 조절 */
const MAX_SCALE = 1;
function resize() {
  const r = view.getBoundingClientRect(), dpr = Math.min(1.25, devicePixelRatio || 1);
  const cw = Math.max(64, Math.round(r.width * dpr)), ch = Math.max(48, Math.round(r.height * dpr));
  if (cvs.width !== cw || cvs.height !== ch) { cvs.width = cw; cvs.height = ch; }
  resizeGL(cw, ch, R.scale);
}
let perfT = 0, perfN = 0;
function adaptResolution(dt) {
  perfT += dt; perfN++;
  if (perfT < 1.2) return;
  const fps = perfN / perfT; perfT = 0; perfN = 0;
  if (!R.lockScale) {
    if (fps < 48 && R.scale > .35) R.scale = Math.max(.35, R.scale * .84);
    else if (fps > 57 && R.scale < MAX_SCALE) R.scale = Math.min(MAX_SCALE, R.scale * 1.08);
    resizeGL(cvs.width, cvs.height, R.scale);
  }
  if (showPerf) $('perf').textContent = `${fps.toFixed(0)} fps · ${R.w}×${R.h}`;
}
const titleCam = t => ({ x: 13.5 + Math.sin(t * .09) * 1.6, y: 16.35, z: .52 + Math.sin(t * .2) * .03, a: -Math.PI / 2 + Math.sin(t * .13) * .42 });

let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (G.state !== 'loading') {
    update(dt);
    const cam = G.state === 'title' ? titleCam(G.time) : { x: P.x, y: P.y, z: P.z, a: P.a };
    if (G.mapDirty || G.map1Dirty) { updateMapTex(MAPD.m0, G.map1Dirty ? MAPD.m1 : null); G.mapDirty = G.map1Dirty = false; }
    flushDecals();
    renderFrame(buildFrame(cam));
    updateHud();
    if (G.automap && G.state === 'play') drawAutomap(); else if (!mapCv.hidden && G.state !== 'play') mapCv.hidden = true;
    adaptResolution(dt);
  }
  requestAnimationFrame(frame);
}
function setLoad(p, text) { $('load-bar').style.width = (p * 100).toFixed(1) + '%'; if (text) $('load-text').textContent = text; }
async function boot() {
  showBest();
  try { initGL(cvs); }
  catch (e) {
    $('load-text').innerHTML = e.message === 'NO_WEBGL2' ? '<span class="fatal">이 브라우저는 WebGL2를 지원하지 않아 게임을 실행할 수 없습니다. 최신 Chrome·Edge·Firefox·Safari에서 열어 주십시오.</span>' : `<span class="fatal">그래픽 초기화 실패: ${e.message}</span>`;
    return;
  }
  R.scale = .7; resize();
  addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(view);
  requestAnimationFrame(frame);
  setLoad(.02, '벽·바닥 텍스처를 합성하는 중…');
  const tex = await buildTextures(p => setLoad(p * .32));
  setLoad(.33, '조명과 그림자를 굽는 중…'); await yieldFrame();
  buildLevel(); LMAP = bakeLight();
  uploadWorld(tex, LMAP, mapData());
  resetGame(); G.state = 'title';
  setLoad(.38, '괴물·무기·소품을 레이트레이싱하는 중…');
  await buildSprites(p => setLoad(.38 + p * .62));
  uploadAtlas(); G.ready = true;
  $('load').hidden = true; $('start').disabled = false; $('start').focus();
}
window.__hg = { G, P, R, teleport(x, y, a) { P.x = x; P.y = y; P.fz = footFloor(x, y, PR); P.z = P.fz + EYE; if (a !== undefined) P.a = a; }, lock(s) { R.lockScale = true; R.scale = s; resize(); } };
boot().catch(e => { console.error(e); $('load-text').innerHTML = `<span class="fatal">오류: ${e.message}</span>`; });
