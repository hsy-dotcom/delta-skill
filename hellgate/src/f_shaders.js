/* ───────── GLSL 셰이더 ───────── */
const GLSL_HEAD = `#version 300 es
precision highp float; precision highp int; precision highp sampler2DArray; precision highp usampler2D;
`;
const FS_TRI_VS = GLSL_HEAD + `
out vec2 vUV;
void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUV = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`;

const DYN_UNIFORMS = `uniform vec4 uDynP[8], uDynC[8]; uniform int uDynN;`;
const NOISE_GLSL = `
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y); }`;

/* 월드: 화소마다 높이 격자를 광선 진행해 벽·바닥·천장·하늘을 찾고 조명한다 */
const WORLD_FS = GLSL_HEAD + `
uniform vec2 uRes, uDir, uRight, uNF, uMapSize; uniform vec3 uCam; uniform float uFocal, uHoriz, uTime, uEnc;
uniform sampler2D uMap0, uIrr, uLdir, uSky, uDec; uniform usampler2D uMap1, uDecGrid;
uniform sampler2DArray uAlb, uNrm;
uniform vec3 uFogC; uniform float uFogD, uScat;
` + DYN_UNIFORMS + NOISE_GLSL + `
out vec4 oCol;
const float TAU = 6.2831853;
float shadowDyn(vec3 p, vec3 l) {
  for (int s = 1; s < 8; s++) {
    vec3 q = mix(p, l, float(s) / 8.);
    vec4 c = texelFetch(uMap0, ivec2(floor(q.xy)), 0);
    if (q.z < c.x || q.z > c.y) return 0.;
  }
  return 1.;
}
void main() {
  vec2 fc = gl_FragCoord.xy;
  float syTop = uRes.y - fc.y;
  vec2 rd = uDir + uRight * ((fc.x - uRes.x * .5) / uFocal);
  float dz = (uHoriz - syTop) / uFocal;
  vec2 rdS = vec2(abs(rd.x) < 1e-5 ? 1e-5 : rd.x, abs(rd.y) < 1e-5 ? 1e-5 : rd.y);
  vec2 dd = abs(1. / rdS);
  ivec2 st = ivec2(rdS.x > 0. ? 1 : -1, rdS.y > 0. ? 1 : -1);
  ivec2 cell = ivec2(floor(uCam.xy));
  vec2 sd = vec2(rdS.x > 0. ? float(cell.x) + 1. - uCam.x : uCam.x - float(cell.x), rdS.y > 0. ? float(cell.y) + 1. - uCam.y : uCam.y - float(cell.y)) * dd;
  vec4 cur = texelFetch(uMap0, cell, 0), hitC = cur;
  ivec2 openCell = cell, hitCell = cell;
  float t = 60.; int kind = 5, side = 0; bool lowerF = false;
  float h0o = cur.x, h1o = cur.y;
  for (int i = 0; i < 100; i++) {
    float tEx = min(sd.x, sd.y);
    if (dz < 0.) { float tf = (cur.x - uCam.z) / dz; if (tf <= tEx) { t = tf; kind = 1; hitCell = openCell = cell; hitC = cur; break; } }
    else if (dz > 0.) { float tc = (cur.y - uCam.z) / dz; if (tc <= tEx) { t = tc; kind = (int(cur.z + .5) & 1) == 1 ? 4 : 2; hitCell = openCell = cell; hitC = cur; break; } }
    ivec2 prev = cell;
    if (sd.x < sd.y) { sd.x += dd.x; cell.x += st.x; side = 0; } else { sd.y += dd.y; cell.y += st.y; side = 1; }
    if (cell.x < 0 || cell.y < 0 || cell.x >= int(uMapSize.x) || cell.y >= int(uMapSize.y)) { t = tEx; kind = 5; break; }
    vec4 nx = texelFetch(uMap0, cell, 0);
    float z = uCam.z + dz * tEx;
    if (z < nx.x || z > nx.y) { t = tEx; kind = 3; lowerF = z < nx.x; hitC = nx; hitCell = cell; openCell = prev; h0o = cur.x; h1o = cur.y; break; }
    cur = nx;
  }
  float rlen = length(vec3(rd, dz));
  vec3 rdir = vec3(rd, dz) / rlen;
  float fd = t * rlen;
  vec3 P = vec3(uCam.xy + rd * t, uCam.z + dz * t);
  vec3 col; float depth01;
  if (kind >= 4) {
    float ang = atan(rd.y, rd.x), el = atan(dz, length(rd));
    col = kind == 4 ? textureLod(uSky, vec2(ang / TAU + .5, 1. - clamp(el / 1.396, 0., 1.)), 0.).rgb * 1.35 : vec3(0.);
    depth01 = 1.; fd = min(fd, 30.);
  } else {
    uvec4 tx = texelFetch(uMap1, hitCell, 0);
    int flags = int(hitC.z + .5);
    vec3 N, T, B; vec2 uv; float layer, ao;
    if (kind == 3) {
      N = side == 0 ? vec3(-float(st.x), 0., 0.) : vec3(0., -float(st.y), 0.);
      if (side == 0) { uv.x = st.x < 0 ? 1. - fract(P.y) : fract(P.y); T = vec3(0., st.x < 0 ? -1. : 1., 0.); }
      else { uv.x = st.y < 0 ? fract(P.x) : 1. - fract(P.x); T = vec3(st.y < 0 ? 1. : -1., 0., 0.); }
      B = vec3(0., 0., -1.);
      uv.y = fract((lowerF ? hitC.x : hitC.y) - P.z);
      layer = float(lowerF ? tx.y : tx.x);
      ao = mix(.45, 1., smoothstep(0., .35, P.z - h0o)) * mix(.7, 1., smoothstep(0., .3, h1o - P.z));
    } else {
      N = kind == 1 ? vec3(0., 0., 1.) : vec3(0., 0., -1.); T = vec3(1., 0., 0.); B = vec3(0., 1., 0.);
      uv = fract(P.xy);
      layer = float(kind == 1 ? tx.z : tx.w);
      if (kind == 1 && (flags & 12) != 0) {
        float sp = (flags & 4) != 0 ? 1. : .45;
        uv = fract(uv + sp * (vec2(sin(uTime * .7 + P.y * 3.), cos(uTime * .6 + P.x * 3.)) * .025 + vec2(uTime * .02, uTime * .013)));
      }
      ao = 1.;
    }
    vec2 lmUV = (kind == 3 ? P.xy + N.xy * .12 : P.xy) / uMapSize;
    vec4 E = texture(uIrr, lmUV), LD = texture(uLdir, lmUV);
    if (kind != 3) ao = E.a;
    float lod = log2(max(1., 256. * t / uFocal / max(abs(dot(rdir, N)), .12)));
    vec4 alb = textureLod(uAlb, vec3(uv, layer), lod), nrm = textureLod(uNrm, vec3(uv, layer), lod);
    vec3 base = alb.rgb; float gloss = nrm.a, emis = alb.a;
    vec3 nt = nrm.xyz * 2. - 1.;
    // 데칼: 탄흔 · 핏자국 · 그을음 (셀별 최대 4개)
    uvec4 ids = texelFetch(uDecGrid, openCell, 0);
    for (int j = 0; j < 4; j++) {
      uint id = ids[j];
      if (id == 0u) continue;
      vec4 d0 = texelFetch(uDec, ivec2(int(id) - 1, 0), 0), d1 = texelFetch(uDec, ivec2(int(id) - 1, 1), 0);
      if (dot(N, d1.xyz) < .9) continue;
      vec3 dp = P - d0.xyz; float pd = dot(dp, d1.xyz);
      if (abs(pd) > .05) continue;
      vec3 ip = dp - d1.xyz * pd; float r = length(ip) / d0.w;
      if (r >= 1.) continue;
      vec3 bx = normalize(cross(d1.xyz, abs(d1.z) > .5 ? vec3(1, 0, 0) : vec3(0, 0, 1))), by = cross(d1.xyz, bx);
      float ang = atan(dot(ip, by), dot(ip, bx)), typ = floor(d1.w), sdd = fract(d1.w) * 97.;
      float nz = vnoise(vec2(cos(ang), sin(ang)) * 2.5 + sdd);
      if (typ < 1.5) {
        float hole = smoothstep(.2, .34, r);
        base *= mix(.05, 1., hole) * (1. + .4 * smoothstep(.3, .42, r) * smoothstep(.62, .42, r)) * mix(.5, 1., smoothstep(.35, 1., r + nz * .35));
        gloss *= hole;
      } else if (typ < 2.5) {
        float e = .5 + .5 * nz, k = smoothstep(e, e - .14, r);
        base = mix(base, vec3(.2, .01, .008), k * .93); gloss = mix(gloss, .92, k);
      } else {
        base *= mix(.1, 1., smoothstep(.1, 1., r + (nz - .5) * .6)); gloss *= .4; emis *= smoothstep(.2, .8, r);
      }
    }
    vec3 Nw = normalize(T * nt.x + B * nt.y + N * max(nt.z, .2));
    vec3 V = -rdir, Ld = LD.xyz; float dn = clamp(LD.w, 0., 1.);
    float gexp = 6. + gloss * 60.;
    vec3 lit = (base * E.rgb * mix(1., max(dot(Nw, Ld), 0.) * 1.45 + .1, dn * .85)
             + E.rgb * pow(max(dot(Nw, normalize(Ld + V)), 0.), gexp) * gloss * dn * 1.3) * ao;
    for (int i = 0; i < 8; i++) {
      if (i >= uDynN) break;
      vec3 Lv = uDynP[i].xyz - P; float d = length(Lv), rr = uDynP[i].w;
      if (d >= rr) continue;
      vec3 L = Lv / d; float att = 1. - d / rr; att *= att;
      float nl = max(dot(Nw, L), 0.) * smoothstep(-.05, .15, dot(N, L));
      if (nl <= 0.) continue;
      float sh = uDynC[i].w > .5 ? shadowDyn(P + N * .02, uDynP[i].xyz) : 1.;
      lit += uDynC[i].rgb * att * sh * (base * nl + pow(max(dot(Nw, normalize(L + V)), 0.), gexp) * gloss * .9);
    }
    float em = emis * hitC.w;
    if ((flags & 16) != 0) em *= .55 + .45 * sin(uTime * 2.3 + P.x * 1.7 + P.y * 1.3 + P.z * 2.);
    col = lit + base * em * 2.4;
    depth01 = .5 * (uNF.x + uNF.y / max(t, .001)) + .5;
  }
  // 대기: 굽힌 조명을 따라 흩어지는 빛 + 동적 광원의 공기 산란
  float jit = hash12(fc + fract(uTime) * 61.), segT = min(t, 14.);
  vec3 sc = vec3(0.);
  for (int s = 0; s < 5; s++) sc += texture(uIrr, (uCam.xy + rd * ((float(s) + jit) / 5. * segT)) / uMapSize).rgb;
  sc *= segT * rlen / 5. * uScat;
  float Ls = min(fd, 20.);
  for (int i = 0; i < 8; i++) {
    if (i >= uDynN) break;
    vec3 lp = uDynP[i].xyz - uCam; float tc = dot(lp, rdir), h = max(length(lp - rdir * tc), .08);
    sc += uDynC[i].rgb * min((atan((Ls - tc) / h) - atan(-tc / h)) / h, 10.) * uScat * .6;
  }
  col = mix(col, uFogC, 1. - exp(-fd * uFogD)) + sc;
  oCol = vec4(col * uEnc, 1.);
  gl_FragDepth = depth01;
}`;

/* 스프라이트·입자 공용 정점 셰이더 (카메라를 향한 사각형) */
const QUAD_VS = GLSL_HEAD + `
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 iPos; layout(location=2) in vec2 iSize; layout(location=3) in vec4 iUV; layout(location=4) in vec4 iCol; layout(location=5) in vec3 iPar;
uniform vec2 uRes, uDir, uRight, uNF, uMapSize; uniform vec3 uCam; uniform float uFocal, uHoriz;
uniform sampler2D uIrr, uLdir;
out vec2 vUV; out vec3 vW; flat out vec4 vE, vLD, vCol; flat out vec3 vPar;
void main() {
  vec2 w2 = iPos.xy + uRight * (aCorner.x * iSize.x);
  float wz = iPos.z + (aCorner.y + iPar.z) * iSize.y;
  vec2 rel = w2 - uCam.xy;
  float depth = dot(rel, uDir), lat = dot(rel, uRight), up = wz - uCam.z;
  gl_Position = vec4(2. * lat * uFocal / uRes.x, depth * (1. - 2. * uHoriz / uRes.y) + 2. * up * uFocal / uRes.y, uNF.x * depth + uNF.y, depth);
  vUV = mix(iUV.xy, iUV.zw, vec2(aCorner.x + .5, 1. - aCorner.y));
  vW = vec3(w2, wz);
  vec2 lm = iPos.xy / uMapSize;
  vE = textureLod(uIrr, lm, 0.); vLD = textureLod(uLdir, lm, 0.);
  vCol = iCol; vPar = iPar;
}`;
const SPRITE_FS = GLSL_HEAD + `
uniform sampler2D uAtlas, uAtlasN; uniform vec2 uDir, uRight; uniform vec3 uCam, uFogC; uniform float uFogD, uEnc;
` + DYN_UNIFORMS + `
in vec2 vUV; in vec3 vW; flat in vec4 vE, vLD, vCol; flat in vec3 vPar;
out vec4 oCol;
void main() {
  vec4 c = texture(uAtlas, vUV);
  if (c.a < .06) discard;
  vec4 n = texture(uAtlasN, vUV);
  vec2 nxy = n.xy * 2. - 1.; float nz = sqrt(max(0., 1. - dot(nxy, nxy)));
  vec3 N = normalize(vec3(uRight * nxy.x - uDir * nz, nxy.y));
  vec3 V = normalize(uCam - vW), Ld = vLD.xyz; float dn = clamp(vLD.w, 0., 1.);
  float gloss = n.b, gexp = 8. + gloss * 50.;
  vec3 col = c.rgb * vE.rgb * (mix(1., max(dot(N, Ld), 0.) * 1.5 + .12, dn * .85) + pow(1. - nz, 2.5) * .3)
           + vE.rgb * pow(max(dot(N, normalize(Ld + V)), 0.), gexp) * gloss * dn;
  for (int i = 0; i < 8; i++) {
    if (i >= uDynN) break;
    vec3 Lv = uDynP[i].xyz - vW; float d = length(Lv), rr = uDynP[i].w;
    if (d >= rr) continue;
    vec3 L = Lv / d; float att = 1. - d / rr; att *= att;
    col += uDynC[i].rgb * att * (c.rgb * max(dot(N, L), 0.) + pow(max(dot(N, normalize(L + V)), 0.), gexp) * gloss * .8);
  }
  col += c.rgb * n.a * 2.4 * vPar.x;
  col = mix(col, vCol.rgb, vCol.a);
  col = mix(col, uFogC, 1. - exp(-length(vW - uCam) * uFogD));
  oCol = vec4(col * uEnc, c.a);
}`;
const FX_FS = GLSL_HEAD + `
uniform sampler2D uAtlas; uniform vec3 uCam, uFogC; uniform float uFogD, uEnc; uniform int uAdd;
in vec2 vUV; in vec3 vW; flat in vec4 vE, vLD, vCol; flat in vec3 vPar;
out vec4 oCol;
void main() {
  vec4 c;
  if (vPar.x > .5) c = texture(uAtlas, vUV);
  else { float d = length(vUV * 2. - 1.); c = vec4(1., 1., 1., smoothstep(1., .15, d)); }
  vec3 rgb = c.rgb * vCol.rgb; float a = c.a * vCol.a;
  if (vPar.y > .5) rgb *= vE.rgb * 1.3 + .02;
  float fog = 1. - exp(-length(vW - uCam) * uFogD);
  if (uAdd == 1) oCol = vec4(rgb * a * (1. - fog) * uEnc, 0.);
  else oCol = vec4(mix(rgb, uFogC, fog) * uEnc, a);
}`;

/* 1인칭 무기 (화면 공간) */
const WPN_VS = GLSL_HEAD + `
layout(location=0) in vec2 aCorner;
uniform vec4 uRect, uUV;
out vec2 vUV;
void main() { vec2 q = vec2(aCorner.x + .5, aCorner.y); gl_Position = vec4(mix(uRect.xy, uRect.zw, q), 0., 1.); vUV = mix(uUV.xw, uUV.zy, q); }`;
const WPN_FS = GLSL_HEAD + `
uniform sampler2D uAtlas, uAtlasN; uniform vec3 uE, uDynV, uDynDirV; uniform vec4 uLD; uniform float uFlash, uEnc; uniform int uMode;
in vec2 vUV; out vec4 oCol;
void main() {
  vec4 c = texture(uAtlas, vUV);
  if (uMode == 1) { oCol = vec4(c.rgb * c.a * uFlash * 3.5 * uEnc, 0.); return; }
  if (c.a < .02) discard;
  vec4 n = texture(uAtlasN, vUV);
  vec2 nxy = n.xy * 2. - 1.; vec3 N = vec3(nxy, sqrt(max(0., 1. - dot(nxy, nxy)))), V = vec3(0., 0., 1.);
  float dn = clamp(uLD.w, 0., 1.), gloss = n.b, gexp = 10. + gloss * 60.;
  vec3 E = uE + .03;
  vec3 diff = E * mix(1., max(dot(N, uLD.xyz), 0.) * 1.5 + .15, dn * .85) + uDynV * max(dot(N, uDynDirV), 0.);
  vec3 spec = (E * dn * pow(max(dot(N, normalize(uLD.xyz + V)), 0.), gexp) + uDynV * pow(max(dot(N, normalize(uDynDirV + V)), 0.), gexp)) * gloss;
  vec3 col = c.rgb * diff + spec + c.rgb * vec3(1., .72, .4) * uFlash * (.5 + .7 * max(N.y, 0.)) + c.rgb * n.a * 2.;
  oCol = vec4(col * uEnc, c.a);
}`;

/* 후처리: 블룸 체인 + 톤매핑 */
const PRE_FS = GLSL_HEAD + `
uniform sampler2D uSrc; uniform vec2 uPx; uniform float uThr, uDecode; in vec2 vUV; out vec4 oCol;
void main() {
  vec3 c = (texture(uSrc, vUV + uPx * vec2(-.5, -.5)).rgb + texture(uSrc, vUV + uPx * vec2(.5, -.5)).rgb + texture(uSrc, vUV + uPx * vec2(-.5, .5)).rgb + texture(uSrc, vUV + uPx * vec2(.5, .5)).rgb) * .25;
  vec3 cd = c * uDecode;
  float br = max(cd.r, max(cd.g, cd.b)), knee = uThr * .5, soft = clamp(br - uThr + knee, 0., 2. * knee);
  soft = soft * soft / (4. * knee + 1e-4);
  oCol = vec4(c * max(soft, br - uThr) / max(br, 1e-4), 1.);
}`;
const DOWN_FS = GLSL_HEAD + `
uniform sampler2D uSrc; uniform vec2 uPx; in vec2 vUV; out vec4 oCol;
void main() { oCol = (texture(uSrc, vUV + uPx * vec2(-1, -1)) + texture(uSrc, vUV + uPx * vec2(1, -1)) + texture(uSrc, vUV + uPx * vec2(-1, 1)) + texture(uSrc, vUV + uPx * vec2(1, 1))) * .25; }`;
const UP_FS = GLSL_HEAD + `
uniform sampler2D uSrc; uniform vec2 uPx; in vec2 vUV; out vec4 oCol;
void main() {
  vec4 s = texture(uSrc, vUV) * 4.;
  s += (texture(uSrc, vUV + uPx * vec2(-1, 0)) + texture(uSrc, vUV + uPx * vec2(1, 0)) + texture(uSrc, vUV + uPx * vec2(0, -1)) + texture(uSrc, vUV + uPx * vec2(0, 1))) * 2.;
  s += texture(uSrc, vUV + uPx * vec2(-1, -1)) + texture(uSrc, vUV + uPx * vec2(1, -1)) + texture(uSrc, vUV + uPx * vec2(-1, 1)) + texture(uSrc, vUV + uPx * vec2(1, 1));
  oCol = s / 16.;
}`;
const COMP_FS = GLSL_HEAD + `
uniform sampler2D uScene, uBloom; uniform float uBloomI, uExpo, uTime, uDmg, uPick, uLowHp, uDecode;
in vec2 vUV; out vec4 oCol;
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
void main() {
  vec3 sc;
  if (uDmg > .01) { vec2 off = (vUV - .5) * uDmg * .014; sc = vec3(texture(uScene, vUV + off).r, texture(uScene, vUV).g, texture(uScene, vUV - off).b); }
  else sc = texture(uScene, vUV).rgb;
  vec3 c = (sc + texture(uBloom, vUV).rgb * uBloomI) * uDecode * uExpo;
  float vig = smoothstep(.25, 1.15, length((vUV - .5) * vec2(1.2, 1.)) * 1.25);
  c = mix(c, c * vec3(1.7, .35, .28) + vec3(.3, 0., 0.) * vig, clamp(uDmg, 0., 1.) * (.3 + .7 * vig));
  c += vec3(.9, .7, .2) * uPick * .22;
  c = aces(c);
  c = mix(c, vec3(dot(c, vec3(.299, .587, .114))), uLowHp * .55);
  c *= 1. - vig * (.5 + uLowHp * .35 * (.5 + .5 * sin(uTime * 6.)));
  c = pow(c, vec3(1. / 2.2)) + (h12(gl_FragCoord.xy + fract(uTime) * 91.7) - .5) * .03;
  oCol = vec4(c, 1.);
}`;
