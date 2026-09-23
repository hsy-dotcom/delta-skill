/* ───────── 3D 모델: 임프 · 데몬 ───────── */
const MAT = {
  impSkin: { col: hex('#6e4128'), spec: .3, bump: .45, bf: 22, mott: .7, mf: 9 },
  impBelly: { col: hex('#9c6c46'), spec: .25, bump: .3, bf: 30, mott: .5, mf: 12 },
  impDark: { col: hex('#3e2414'), spec: .2, bump: .3, bf: 22, mott: .5, mf: 9 },
  bone: { col: hex('#e8dcc2'), spec: .55, bump: .12, bf: 40, mott: .25, mf: 20 },
  eyeGlow: { col: hex('#ffb030'), emit: 1, spec: .9 },
  mouth: { col: hex('#2a0503'), spec: .7 },
  fire: { col: hex('#ffd868'), emit: 1 },
  blood: { col: hex('#4e0504'), spec: .95 },
  bloodHi: { col: hex('#8a0a08'), spec: .9 },
  pink: { col: hex('#c86a72'), spec: .35, bump: .55, bf: 26, mott: .6, mf: 8 },
  pinkDark: { col: hex('#74302a'), spec: .25, bump: .5, bf: 18, mott: .6, mf: 7 },
  hoof: { col: hex('#2a1a16'), spec: .4 },
  gum: { col: hex('#7a1420'), spec: .8 },
  tooth: { col: hex('#efe6cc'), spec: .7 },
  demonEye: { col: hex('#fff080'), emit: 1 },
};

function leg(out, hip, th, kn, lT, lS, rT, rS, mat, footMat) {
  const knee = vadd(hip, [0, -Math.cos(th) * lT, Math.sin(th) * lT]);
  const ank = vadd(knee, [0, -Math.cos(th - kn) * lS, Math.sin(th - kn) * lS]);
  limbEll(out, hip, knee, rT, mat); limbEll(out, knee, ank, rS, mat);
  const foot = Ell(vadd(ank, [0, -.012, rS * 1.1]), [rS * 1.05, rS * .62, rS * 2.1], I3, footMat);
  out.push(foot);
  return foot;
}
function armDir(a, g, sx) { return vnorm([sx * Math.sin(g), -Math.cos(g) * Math.cos(a), Math.cos(g) * Math.sin(a)]); }
function primBottom(p) {
  if (p.k === 0) return p.c[1] - p.r;
  if (p.k === 1) return p.c[1] - Math.max(p.rad[0], p.rad[1], p.rad[2]) * .8;
  if (p.k === 2 || p.k === 3) return Math.min(p.a[1], p.b[1]) - p.r;
  return p.c[1] - vlen(p.h) * .7;
}
// 발(또는 몸 전체)의 가장 낮은 점이 바닥에 닿도록 들어 올린다
function ground(P, feet, y0 = .004) {
  let m = 1e9; for (const p of (feet || P)) m = Math.min(m, feet ? p.c[1] - p.rad[1] : primBottom(p));
  return xform(P, I3, [0, y0 - m, 0]);
}
// 쓰러짐: 발 쪽을 축으로 옆으로 눕힌 뒤 바닥에 놓고 가운데로 옮긴다
function topple(P, psi, pool, poolMat) {
  let Q = xform(P, rotZ(-psi));
  let m = 1e9, sx = 0; for (const p of Q) { m = Math.min(m, primBottom(p)); sx += (p.c || p.a)[0]; }
  Q = xform(Q, I3, [-sx / Q.length, .012 - m, 0]);
  if (pool > 0) Q.push(Ell([.02, .004, .02], [.12 + pool * .3, .006, .1 + pool * .16], I3, poolMat));
  return Q;
}

function impModel(o) {
  const P = [], ph = (o.ph || 0) * TAU, s = Math.sin(ph);
  let thR = .42 * s, thL = -.42 * s;
  let knR = .2 + .5 * Math.max(0, Math.sin(ph + 1.3)), knL = .2 + .5 * Math.max(0, Math.sin(ph + 1.3 + Math.PI));
  let lean = .08, bob = Math.abs(Math.cos(ph)) * .015;
  const arm = { R: [-.5 * s, .15, .5], L: [.5 * s, .15, .5] };  // [앞뒤 흔들기, 벌림, 팔꿈치 굽힘]
  if (o.pain) { thR = .15; thL = -.1; knR = knL = .3; lean = -.28; arm.R = [.3, 1.15, .4]; arm.L = [.3, 1.15, .4]; bob = 0; }
  if (o.atk === 0) { lean = -.12; thR = -.2; thL = .25; knR = .3; knL = .25; arm.R = [2.6, .25, .7]; arm.L = [.6, .2, .8]; bob = 0; }
  if (o.atk === 1) { lean = .3; thR = .35; thL = -.3; knR = .2; knL = .45; arm.R = [1.45, .1, .05]; arm.L = [-.4, .2, .4]; bob = 0; }
  if (o.dying) { knR = knL = .5 + o.dying * .25; lean = -.2 - o.dying * .1; arm.R = [.9, 1, .6]; arm.L = [.4, .9, .9]; }
  const hipY = .47 + bob, pelvis = [0, hipY, 0], sd = [0, Math.cos(lean), Math.sin(lean)], R = axisTo(sd);
  const chest = vadd(pelvis, vscl(sd, .21)), neck = vadd(pelvis, vscl(sd, .34)), head = vadd(neck, [0, .07, .03 + Math.sin(lean) * .03]);
  const feet = [
    leg(P, [-.075, hipY - .02, 0], thR, knR, .22, .23, .052, .04, MAT.impSkin, MAT.impDark),
    leg(P, [.075, hipY - .02, 0], thL, knL, .22, .23, .052, .04, MAT.impSkin, MAT.impDark),
  ];
  P.push(Ell(vadd(pelvis, vscl(sd, .06)), [.105, .09, .08], R, MAT.impSkin));
  P.push(Ell(vadd(pelvis, vscl(sd, .2)), [.14, .12, .1], R, MAT.impSkin));
  P.push(Ell(vadd(vadd(pelvis, vscl(sd, .17)), [0, 0, .042]), [.1, .11, .064], R, MAT.impBelly));
  limbEll(P, chest, neck, .045, MAT.impSkin);
  P.push(Ell(head, [.072, .078, .078], I3, MAT.impSkin));
  P.push(Ell(vadd(head, [0, -.045, .03]), [.056, .034, .06], I3, MAT.impSkin));
  P.push(Ell(vadd(head, [0, .018, .058]), [.068, .016, .03], I3, MAT.impDark));
  const open = o.atk === 0 || o.pain || o.dying;
  P.push(Ell(vadd(head, [0, -.036, .075]), [.036, open ? .016 : .007, .02], I3, MAT.mouth));
  for (const sx of [-1, 1]) {
    P.push(Sph(vadd(head, [sx * .03, .004, .07]), .0125, MAT.eyeGlow));
    spike(P, vadd(head, [sx * .045, .05, -.01]), vadd(head, [sx * .09, .125, -.065]), .018, .003, MAT.bone, 5);
    spike(P, vadd(head, [sx * .02, -.038, .088]), vadd(head, [sx * .018, -.06, .092]), .006, .002, MAT.bone, 3);
  }
  for (let k = 0; k < 4; k++) { const b = vadd(pelvis, vscl(sd, .08 + k * .07)); spike(P, vadd(b, [0, 0, -.07]), vadd(b, [0, .05, -.15]), .02, .003, MAT.bone, 4); }
  for (const [sx, a] of [[-1, arm.R], [1, arm.L]]) {
    const sh = vadd(chest, [sx * .145, .06, 0]);
    const elb = vadd(sh, vscl(armDir(a[0], a[1], sx), .19)), d2 = armDir(a[0] + a[2], a[1] * .7, sx), hand = vadd(elb, vscl(d2, .17));
    limbEll(P, sh, elb, .038, MAT.impSkin); limbEll(P, elb, hand, .032, MAT.impSkin);
    P.push(Sph(hand, .034, MAT.impDark));
    for (let c = -1; c <= 1; c++) spike(P, vadd(hand, [c * .018, 0, 0]), vadd(vadd(hand, vscl(d2, .07)), [c * .025, 0, .01]), .009, .002, MAT.bone, 3);
    spike(P, vadd(sh, [sx * .01, .03, -.01]), vadd(sh, [sx * .075, .145, -.05]), .026, .004, MAT.bone, 5);
    spike(P, vadd(elb, [0, 0, -.02]), vadd(elb, [sx * .02, .02, -.085]), .014, .003, MAT.bone, 3);
    if (o.atk === 0 && sx === -1) { P.push(Sph(vadd(hand, [0, .06, 0]), .062, MAT.fire)); }
  }
  return ground(P, feet);
}

function demonModel(o) {
  const P = [], ph = (o.ph || 0) * TAU, s = Math.sin(ph);
  let thR = .38 * s, thL = -.38 * s;
  let knR = .5 + .4 * Math.max(0, Math.sin(ph + 1.3)), knL = .5 + .4 * Math.max(0, Math.sin(ph + 1.3 + Math.PI));
  let pitch = .18 + Math.cos(ph * 2) * .03, jaw = .14;
  if (o.bite === 0) { jaw = .8; pitch = -.05; }
  if (o.bite === 1) { jaw = .04; pitch = .4; thR = .3; thL = -.2; }
  if (o.pain) { jaw = .5; pitch = -.22; }
  if (o.dying) { jaw = .6; knR = knL = 1; }
  const hipY = .44 + Math.abs(Math.cos(ph)) * .02, pel = [0, hipY, -.12], Rb = rotX(pitch);
  const f = mv(Rb, [0, 0, 1]), u = mv(Rb, [0, 1, 0]);
  const at = (a, b) => vadd(vadd(pel, vscl(f, a)), vscl(u, b));
  const feet = [
    leg(P, vadd(pel, [-.17, -.02, -.02]), thR, knR, .2, .22, .085, .058, MAT.pink, MAT.hoof),
    leg(P, vadd(pel, [.17, -.02, -.02]), thL, knL, .2, .22, .085, .058, MAT.pink, MAT.hoof),
  ];
  P.push(Ell(at(.2, .1), [.23, .21, .3], Rb, MAT.pink));
  P.push(Ell(at(.1, .27), [.2, .12, .22], Rb, MAT.pinkDark));
  P.push(Ell(at(.4, .03), [.19, .17, .14], Rb, MAT.pink));
  const Hc = at(.54, .06);
  P.push(Ell(Hc, [.15, .13, .14], Rb, MAT.pink));
  P.push(Ell(vadd(vadd(Hc, vscl(f, .08)), vscl(u, .085)), [.13, .04, .07], Rb, MAT.pinkDark));
  P.push(Ell(vadd(vadd(Hc, vscl(f, .15)), vscl(u, -.015)), [.13, .065, .11], Rb, MAT.pink));
  const hinge = vadd(vadd(Hc, vscl(f, .02)), vscl(u, -.06)), Rj = rotX(pitch + jaw), fj = mv(Rj, [0, 0, 1]), uj = mv(Rj, [0, 1, 0]);
  P.push(Ell(vadd(vadd(hinge, vscl(fj, .12)), vscl(uj, -.03)), [.12, .045, .12], Rj, MAT.pink));
  const Rm = rotX(pitch + jaw * .5);
  P.push(Ell(vadd(hinge, mv(Rm, [0, -.01, .1])), [.105, .03 + jaw * .06, .095], Rm, MAT.gum));
  for (let k = 0; k < 9; k++) {
    const a = -1.15 + k * 2.3 / 8, lx = .11 * Math.sin(a), lz = .115 * Math.cos(a) + .1;
    const top = vadd(vadd(vadd(Hc, vscl(f, lz + .03)), vscl(u, -.07)), [lx, 0, 0]);
    spike(P, top, vadd(top, vscl(u, -.05)), .013, .002, MAT.tooth, 3);
    const bot = vadd(vadd(vadd(hinge, vscl(fj, lz)), vscl(uj, -.0)), [lx * .95, 0, 0]);
    spike(P, bot, vadd(bot, vscl(uj, .045)), .012, .002, MAT.tooth, 3);
  }
  for (const sx of [-1, 1]) {
    P.push(Sph(vadd(vadd(vadd(Hc, vscl(f, .11)), vscl(u, .07)), [sx * .075, 0, 0]), .019, MAT.demonEye));
    const hb = vadd(vadd(Hc, vscl(u, .1)), [sx * .09, 0, 0]);
    spike(P, hb, vadd(vadd(hb, [sx * .08, .1, 0]), vscl(f, -.06)), .026, .004, MAT.bone, 5);
    const sh = vadd(at(.38, -.02), [sx * .2, 0, 0]), el = vadd(sh, [sx * .05, -.12, .06]), hd = vadd(el, [0, -.08, .1]);
    limbEll(P, sh, el, .05, MAT.pink); limbEll(P, el, hd, .04, MAT.pink);
    for (let c = -1; c <= 1; c++) spike(P, vadd(hd, [c * .02, 0, 0]), vadd(hd, [c * .026, -.03, .06]), .011, .002, MAT.bone, 3);
  }
  return ground(P, feet);
}

// 회전 5방향(0°,45°,90°,135°,180°) — 나머지는 좌우 반전으로 쓴다
const ROTS = 5;
function rotView(P, k) { return xform(P, rotY(k * Math.PI / 4)); }
