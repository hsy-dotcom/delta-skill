/* ───────── WebGL2 렌더러 ───────── */
const R = { gl: null, P: {}, T: {}, tg: {}, w: 0, h: 0, cw: 0, ch: 0, scale: 1, enc: 1, fmt: null };
const MAX_INST = 4096, INST_F = 16;
const U = { MAP0: 0, MAP1: 1, ALB: 2, NRM: 3, IRR: 4, LDIR: 5, SKY: 6, DGRID: 7, DEC: 8, ATL: 9, ATLN: 10, SCENE: 11, BLOOM: 12 };
const NEAR = .03, FAR = 80, DEPTH_A = (FAR + NEAR) / (FAR - NEAR), DEPTH_B = -2 * FAR * NEAR / (FAR - NEAR);

function glProg(vs, fs, samplers) {
  const gl = R.gl, p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('셰이더 컴파일 실패: ' + gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('셰이더 링크 실패: ' + gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); }
  gl.useProgram(p);
  for (const k in samplers) if (u[k]) gl.uniform1i(u[k], samplers[k]);
  return { p, u };
}
function glTex(target, setup) {
  const gl = R.gl, t = gl.createTexture(); gl.bindTexture(target, t); setup(gl); return t;
}
function texParams(gl, target, min, mag, wrapS, wrapT) {
  gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, min); gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, mag);
  gl.texParameteri(target, gl.TEXTURE_WRAP_S, wrapS); gl.texParameteri(target, gl.TEXTURE_WRAP_T, wrapT);
}

function initGL(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('NO_WEBGL2');
  R.gl = gl;
  const hf = !!gl.getExtension('EXT_color_buffer_float');
  R.fmt = hf ? { i: gl.RGBA16F, t: gl.HALF_FLOAT } : { i: gl.RGBA8, t: gl.UNSIGNED_BYTE };
  R.enc = hf ? 1 : .5;
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  const worldS = { uMap0: U.MAP0, uMap1: U.MAP1, uAlb: U.ALB, uNrm: U.NRM, uIrr: U.IRR, uLdir: U.LDIR, uSky: U.SKY, uDecGrid: U.DGRID, uDec: U.DEC };
  R.P.world = glProg(FS_TRI_VS, WORLD_FS, worldS);
  R.P.sprite = glProg(QUAD_VS, SPRITE_FS, { uIrr: U.IRR, uLdir: U.LDIR, uAtlas: U.ATL, uAtlasN: U.ATLN });
  R.P.fx = glProg(QUAD_VS, FX_FS, { uIrr: U.IRR, uLdir: U.LDIR, uAtlas: U.ATL });
  R.P.wpn = glProg(WPN_VS, WPN_FS, { uAtlas: U.ATL, uAtlasN: U.ATLN });
  R.P.pre = glProg(FS_TRI_VS, PRE_FS, { uSrc: U.SCENE });
  R.P.down = glProg(FS_TRI_VS, DOWN_FS, { uSrc: U.SCENE });
  R.P.up = glProg(FS_TRI_VS, UP_FS, { uSrc: U.SCENE });
  R.P.comp = glProg(FS_TRI_VS, COMP_FS, { uScene: U.SCENE, uBloom: U.BLOOM });
  R.triVAO = gl.createVertexArray();
  const corners = new Float32Array([-.5, 0, .5, 0, -.5, 1, .5, 1]);
  R.wpnVAO = gl.createVertexArray(); gl.bindVertexArray(R.wpnVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  R.quadVAO = gl.createVertexArray(); gl.bindVertexArray(R.quadVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  R.instBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, R.instBuf); gl.bufferData(gl.ARRAY_BUFFER, MAX_INST * INST_F * 4, gl.DYNAMIC_DRAW);
  [[1, 3, 0], [2, 2, 12], [3, 4, 20], [4, 4, 36], [5, 3, 52]].forEach(([loc, n, off]) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, INST_F * 4, off); gl.vertexAttribDivisor(loc, 1); });
  gl.bindVertexArray(null);
}

function uploadWorld(tex, lightmap, mapD) {
  const gl = R.gl, n = tex.layers.length, a = new Uint8Array(TN * 4 * n), b = new Uint8Array(TN * 4 * n);
  tex.layers.forEach((L, i) => { a.set(L.alb, i * TN * 4); b.set(L.nrm, i * TN * 4); });
  const arr = (ifmt, data) => glTex(gl.TEXTURE_2D_ARRAY, gl => {
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, ifmt, TS, TS, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    texParams(gl, gl.TEXTURE_2D_ARRAY, gl.LINEAR_MIPMAP_LINEAR, gl.NEAREST, gl.REPEAT, gl.REPEAT);
  });
  R.T.alb = arr(gl.SRGB8_ALPHA8, a); R.T.nrm = arr(gl.RGBA8, b);
  R.T.sky = glTex(gl.TEXTURE_2D, gl => { gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, SKY_W, SKY_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, tex.sky); texParams(gl, gl.TEXTURE_2D, gl.LINEAR, gl.LINEAR, gl.REPEAT, gl.CLAMP_TO_EDGE); });
  const lmTex = data => glTex(gl.TEXTURE_2D, gl => { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, LMW, LMH, 0, gl.RGBA, gl.FLOAT, data); texParams(gl, gl.TEXTURE_2D, gl.LINEAR, gl.LINEAR, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE); });
  R.T.irr = lmTex(lightmap.irr); R.T.ldir = lmTex(lightmap.dir);
  R.T.map0 = glTex(gl.TEXTURE_2D, gl => { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, MW, MH, 0, gl.RGBA, gl.FLOAT, mapD.m0); texParams(gl, gl.TEXTURE_2D, gl.NEAREST, gl.NEAREST, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE); });
  R.T.map1 = glTex(gl.TEXTURE_2D, gl => { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI, MW, MH, 0, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, mapD.m1); texParams(gl, gl.TEXTURE_2D, gl.NEAREST, gl.NEAREST, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE); });
  R.T.dgrid = glTex(gl.TEXTURE_2D, gl => { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI, MW, MH, 0, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, new Uint8Array(MW * MH * 4)); texParams(gl, gl.TEXTURE_2D, gl.NEAREST, gl.NEAREST, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE); });
  R.T.dec = glTex(gl.TEXTURE_2D, gl => { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, MAX_DECALS, 2, 0, gl.RGBA, gl.FLOAT, new Float32Array(MAX_DECALS * 8)); texParams(gl, gl.TEXTURE_2D, gl.NEAREST, gl.NEAREST, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE); });
  // 스프라이트 아틀라스는 나중에 채운다 (자리만 만든다)
  const atl = ifmt => glTex(gl.TEXTURE_2D, gl => { gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, 4, 4, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(64)); texParams(gl, gl.TEXTURE_2D, gl.LINEAR, gl.LINEAR, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE); });
  R.T.atl = atl(gl.SRGB8_ALPHA8); R.T.atln = atl(gl.RGBA8);
  bindAll();
}
function uploadAtlas() {
  const gl = R.gl;
  for (const [t, ifmt, data] of [[R.T.atl, gl.SRGB8_ALPHA8, ATLAS.col], [R.T.atln, gl.RGBA8, ATLAS.nrm]]) {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, ATLAS.W, ATLAS.H, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, 3);
    texParams(gl, gl.TEXTURE_2D, gl.LINEAR_MIPMAP_LINEAR, gl.NEAREST, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE);
  }
  bindAll();
}
function bindAll() {
  const gl = R.gl, b = (unit, target, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(target, t); };
  b(U.MAP0, gl.TEXTURE_2D, R.T.map0); b(U.MAP1, gl.TEXTURE_2D, R.T.map1); b(U.ALB, gl.TEXTURE_2D_ARRAY, R.T.alb); b(U.NRM, gl.TEXTURE_2D_ARRAY, R.T.nrm);
  b(U.IRR, gl.TEXTURE_2D, R.T.irr); b(U.LDIR, gl.TEXTURE_2D, R.T.ldir); b(U.SKY, gl.TEXTURE_2D, R.T.sky); b(U.DGRID, gl.TEXTURE_2D, R.T.dgrid); b(U.DEC, gl.TEXTURE_2D, R.T.dec);
  b(U.ATL, gl.TEXTURE_2D, R.T.atl); b(U.ATLN, gl.TEXTURE_2D, R.T.atln);
}
function updateMapTex(m0, m1) {
  const gl = R.gl;
  gl.activeTexture(gl.TEXTURE0 + U.MAP0); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, MW, MH, gl.RGBA, gl.FLOAT, m0);
  if (m1) { gl.activeTexture(gl.TEXTURE0 + U.MAP1); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, MW, MH, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, m1); }
}
function updateDecalTex(grid, data) {
  const gl = R.gl;
  gl.activeTexture(gl.TEXTURE0 + U.DGRID); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, MW, MH, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, grid);
  gl.activeTexture(gl.TEXTURE0 + U.DEC); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, MAX_DECALS, 2, gl.RGBA, gl.FLOAT, data);
}

function makeTarget(w, h, depth) {
  const gl = R.gl, tex = glTex(gl.TEXTURE_2D, gl => { gl.texImage2D(gl.TEXTURE_2D, 0, R.fmt.i, w, h, 0, gl.RGBA, R.fmt.t, null); texParams(gl, gl.TEXTURE_2D, gl.LINEAR, gl.LINEAR, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE); });
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  let rb = null;
  if (depth) { rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb); }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb, rb, w, h };
}
function freeTarget(t) { if (!t) return; const gl = R.gl; gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); if (t.rb) gl.deleteRenderbuffer(t.rb); }
function resizeGL(cw, ch, scale) {
  const w = Math.max(64, Math.round(cw * scale)), h = Math.max(48, Math.round(ch * scale));
  R.cw = cw; R.ch = ch;
  if (w === R.w && h === R.h) return;
  R.w = w; R.h = h;
  freeTarget(R.tg.scene); R.tg.scene = makeTarget(w, h, true);
  (R.tg.bloom || []).forEach(freeTarget); R.tg.bloom = [];
  let bw = w, bh = h;
  for (let i = 0; i < 5; i++) { bw = Math.max(2, bw >> 1); bh = Math.max(2, bh >> 1); R.tg.bloom.push(makeTarget(bw, bh, false)); }
}
const focalFor = (w, h) => Math.min(h * .77, w * .64);

function setCam(pg, F) {
  const gl = R.gl, u = pg.u;
  if (u.uRes) gl.uniform2f(u.uRes, R.w, R.h);
  if (u.uCam) gl.uniform3f(u.uCam, F.cam[0], F.cam[1], F.cam[2]);
  if (u.uDir) gl.uniform2f(u.uDir, F.dir[0], F.dir[1]);
  if (u.uRight) gl.uniform2f(u.uRight, -F.dir[1], F.dir[0]);
  if (u.uFocal) gl.uniform1f(u.uFocal, focalFor(R.w, R.h));
  if (u.uHoriz) gl.uniform1f(u.uHoriz, R.h / 2 + F.horiz * R.h);
  if (u.uNF) gl.uniform2f(u.uNF, DEPTH_A, DEPTH_B);
  if (u.uMapSize) gl.uniform2f(u.uMapSize, MW, MH);
  if (u.uTime) gl.uniform1f(u.uTime, F.time);
  if (u.uEnc) gl.uniform1f(u.uEnc, R.enc);
  if (u.uFogC) gl.uniform3f(u.uFogC, F.fog[0], F.fog[1], F.fog[2]);
  if (u.uFogD) gl.uniform1f(u.uFogD, F.fog[3]);
  if (u.uScat) gl.uniform1f(u.uScat, F.scat);
  if (u.uDynP) { gl.uniform4fv(u.uDynP, F.dynP); gl.uniform4fv(u.uDynC, F.dynC); gl.uniform1i(u.uDynN, F.dynN); }
}
function drawInst(data, count) {
  if (!count) return;
  const gl = R.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER, R.instBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * INST_F);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
}
function pass(pg, target, srcTex, px) {
  const gl = R.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
  gl.viewport(0, 0, target ? target.w : R.cw, target ? target.h : R.ch);
  gl.useProgram(pg.p);
  if (srcTex) { gl.activeTexture(gl.TEXTURE0 + U.SCENE); gl.bindTexture(gl.TEXTURE_2D, srcTex); }
  if (px && pg.u.uPx) gl.uniform2f(pg.u.uPx, px[0], px[1]);
  gl.bindVertexArray(R.triVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function renderFrame(F) {
  const gl = R.gl, sc = R.tg.scene;
  gl.bindFramebuffer(gl.FRAMEBUFFER, sc.fb); gl.viewport(0, 0, R.w, R.h);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.ALWAYS); gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
  let pg = R.P.world; gl.useProgram(pg.p); setCam(pg, F);
  gl.bindVertexArray(R.triVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
  // 스프라이트 (먼 것부터, 알파 혼합)
  gl.depthFunc(gl.LESS); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.bindVertexArray(R.quadVAO);
  pg = R.P.sprite; gl.useProgram(pg.p); setCam(pg, F); drawInst(F.spr, F.sprN);
  gl.depthMask(false);
  pg = R.P.fx; gl.useProgram(pg.p); setCam(pg, F);
  gl.uniform1i(pg.u.uAdd, 0); drawInst(F.fxA, F.fxAN);
  gl.blendFunc(gl.ONE, gl.ONE); gl.uniform1i(pg.u.uAdd, 1); drawInst(F.fxB, F.fxBN);
  // 1인칭 무기
  gl.disable(gl.DEPTH_TEST);
  if (F.wpn) {
    const w = F.wpn; pg = R.P.wpn; gl.useProgram(pg.p); gl.bindVertexArray(R.wpnVAO);
    gl.uniform3fv(pg.u.uE, w.E); gl.uniform4fv(pg.u.uLD, w.LD); gl.uniform3fv(pg.u.uDynV, w.dynC); gl.uniform3fv(pg.u.uDynDirV, w.dynD);
    gl.uniform1f(pg.u.uFlash, w.flash); gl.uniform1f(pg.u.uEnc, R.enc);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.uniform1i(pg.u.uMode, 0);
    gl.uniform4fv(pg.u.uRect, w.rect); gl.uniform4fv(pg.u.uUV, w.uv); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (w.flashRect) { gl.blendFunc(gl.ONE, gl.ONE); gl.uniform1i(pg.u.uMode, 1); gl.uniform4fv(pg.u.uRect, w.flashRect); gl.uniform4fv(pg.u.uUV, w.flashUV); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
  }
  gl.depthMask(true);
  // 블룸: 밝은 부분 추출 → 축소 → 확대하며 더하기
  gl.disable(gl.BLEND);
  const B = R.tg.bloom;
  pg = R.P.pre; gl.useProgram(pg.p); gl.uniform1f(pg.u.uThr, 1.1); gl.uniform1f(pg.u.uDecode, 1 / R.enc);
  pass(pg, B[0], sc.tex, [1 / sc.w, 1 / sc.h]);
  for (let i = 1; i < B.length; i++) pass(R.P.down, B[i], B[i - 1].tex, [1 / B[i - 1].w, 1 / B[i - 1].h]);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  for (let i = B.length - 1; i > 0; i--) pass(R.P.up, B[i - 1], B[i].tex, [1 / B[i].w, 1 / B[i].h]);
  gl.disable(gl.BLEND);
  // 합성
  pg = R.P.comp; gl.useProgram(pg.p);
  gl.activeTexture(gl.TEXTURE0 + U.BLOOM); gl.bindTexture(gl.TEXTURE_2D, B[0].tex);
  gl.uniform1f(pg.u.uBloomI, .55); gl.uniform1f(pg.u.uExpo, F.expo); gl.uniform1f(pg.u.uTime, F.time);
  gl.uniform1f(pg.u.uDmg, F.dmg); gl.uniform1f(pg.u.uPick, F.pick); gl.uniform1f(pg.u.uLowHp, F.lowHp); gl.uniform1f(pg.u.uDecode, 1 / R.enc);
  pass(pg, null, sc.tex);
}
