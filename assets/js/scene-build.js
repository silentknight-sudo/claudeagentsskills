// 3D "plot to possession" scene: a stilt + 4 builder floor that assembles itself as you scroll.
import * as THREE from 'three';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = THREE.MathUtils.lerp;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const win = (p, a, b) => clamp01((p - a) / (b - a));

// deterministic random so the neighbourhood looks the same on every load
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

// Building dimensions (metres-ish)
const W = 10, D = 14, H = 3.2, LEVELS = 5, PLINTH = 0.4, SLAB = 0.3, T = 0.23;
const XS = [-W / 2, 0, W / 2];
const ZS = [-D / 2, -D / 6, D / 6, D / 2];
const base = (f) => PLINTH + f * H;
const TOP = base(LEVELS);

export function createBuildScene(canvas, { reducedMotion = false } = {}) {
  const mobile = matchMedia('(max-width: 760px)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x6f5a55, 50, 150);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 500);

  // ---------- sky ----------
  const sky = {
    top: new THREE.Color(), bottom: new THREE.Color(),
    dayTop: new THREE.Color(0x2c3b5a), dayBottom: new THREE.Color(0xf0a865),
    nightTop: new THREE.Color(0x04060c), nightBottom: new THREE.Color(0x1b2140),
  };
  const skyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(300, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: sky.top }, bottom: { value: sky.bottom } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = smoothstep(-0.02, 0.55, vP.y); gl_FragColor = vec4(mix(bottom, top, h), 1.0);\n#include <colorspace_fragment>\n}',
    }),
  );
  scene.add(skyMesh);

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xffe2c4, 0x1a1c22, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffc48a, 2.4);
  sun.position.set(-28, 26, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 100 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const porch = new THREE.PointLight(0xffb873, 0, 40, 2);
  porch.position.set(0, 2.2, D / 2 + 2.5);
  scene.add(porch);

  // ---------- materials ----------
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...o });
  const M = {
    ground: std(0x24252a, { roughness: 1 }),
    road: std(0x18191c, { roughness: 1 }),
    path: std(0x4a4742),
    soil: std(0x5d4a3a, { roughness: 1 }),
    concrete: std(0x9a9893),
    steel: std(0x5a6068, { metalness: 0.7, roughness: 0.4 }),
    wall: std(0xa4553a, { roughness: 0.95 }),
    fin: std(0x3a2a20, { roughness: 0.55 }),
    crane: std(0xf5a524, { roughness: 0.5, metalness: 0.3 }),
    amber: std(0xf5a524, { roughness: 0.6, emissive: 0xf5a524, emissiveIntensity: 0.25 }),
    wood: std(0x8a6a44),
    rail: new THREE.MeshStandardMaterial({ color: 0xbfd6e6, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.35 }),
    leaf: std(0x2f4a32, { flatShading: true }),
    trunk: std(0x3b2b20),
    marking: new THREE.MeshBasicMaterial({ color: 0xd8d2c0 }),
  };
  const glass = Array.from({ length: LEVELS }, () =>
    new THREE.MeshStandardMaterial({ color: 0x1e2a36, roughness: 0.12, metalness: 0.3, emissive: 0xffc27a, emissiveIntensity: 0, transparent: true, opacity: 0.88 }));
  const colors = {
    brick: new THREE.Color(0xa4553a), plaster: new THREE.Color(0xe6e0d4),
    raw: new THREE.Color(0x9a9893), finished: new THREE.Color(0xd2cdc3),
  };

  const box = (w, h, d, mat, x = 0, y = 0, z = 0, parent = scene) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // Every animated piece registers a [start, end] window on the scroll progress.
  const anims = [];
  const anim = (a, b, fn, e = easeInOut) => anims.push({ a, b, fn, e });
  const showScale = (obj, axis, from = 0.0001) => (k) => { obj.visible = k > 0; obj.scale[axis] = lerp(from, 1, k); };

  // ---------- site & street ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), M.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(600, 8), M.road);
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, D / 2 + 9); road.receiveShadow = true;
  scene.add(road);
  for (let x = -120; x <= 120; x += 6) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.18), M.marking);
    dash.rotation.x = -Math.PI / 2; dash.position.set(x, 0.02, D / 2 + 9);
    scene.add(dash);
  }
  box(600, 0.18, 2.2, M.path, 0, 0.09, D / 2 + 4);

  const soil = new THREE.Mesh(new THREE.PlaneGeometry(W + 3, D + 3), M.soil);
  soil.rotation.x = -Math.PI / 2; soil.position.y = 0.02; soil.receiveShadow = true;
  scene.add(soil);

  // plot boundary pegs & tape (stage 1)
  const PW = W + 1.4, PD = D + 1.4;
  [[0, -PD / 2, PW, 'x'], [0, PD / 2, PW, 'x'], [-PW / 2, 0, PD, 'z'], [PW / 2, 0, PD, 'z']].forEach(([x, z, len, ax], i) => {
    const tape = box(ax === 'x' ? len : 0.07, 0.07, ax === 'x' ? 0.07 : len, M.amber, x, 0.6, z);
    tape.castShadow = false;
    anim(0.03 + i * 0.015, 0.08 + i * 0.015, showScale(tape, ax));
  });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => {
    const peg = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 8), M.amber);
    peg.position.set(sx * PW / 2, 0.55, sz * PD / 2);
    scene.add(peg);
    anim(0.02 + i * 0.012, 0.06 + i * 0.012, (k) => { peg.visible = k > 0; peg.scale.setScalar(Math.max(0.0001, k)); }, easeOutBack);
  });

  // plinth
  const plinth = box(W + 0.6, PLINTH, D + 0.6, M.concrete, 0, 0, 0);
  plinth.geometry.translate(0, PLINTH / 2, 0);
  anim(0.11, 0.17, showScale(plinth, 'y'));

  // ---------- structure: columns + slabs ----------
  const colGeo = new THREE.CylinderGeometry(0.2, 0.2, 1, 14);
  colGeo.translate(0, 0.5, 0);
  for (let f = 0; f < LEVELS; f++) {
    const s = 0.18 + f * 0.056;
    XS.forEach((x, i) => ZS.forEach((z, j) => {
      const col = new THREE.Mesh(colGeo, M.concrete);
      col.position.set(x, base(f), z);
      col.castShadow = col.receiveShadow = true;
      scene.add(col);
      const d = (i + j) * 0.0025;
      anim(s + d, s + 0.026 + d, (k) => { col.visible = k > 0; col.scale.y = Math.max(0.0001, k * (H - SLAB)); });
    }));
    const slab = box(W + 0.8, SLAB, D + 0.8, M.concrete, 0, base(f + 1) - SLAB / 2, 0);
    const y0 = slab.position.y;
    anim(s + 0.026, s + 0.056, (k) => { slab.visible = k > 0; slab.position.y = y0 + (1 - k) * 7; }, easeOut);
  }

  // ---------- walls (levels 1+; level 0 is open stilt parking) ----------
  const wallH = H - SLAB;
  function bay(x1, z1, x2, z2, f, kind) {
    const L = Math.hypot(x2 - x1, z2 - z1) - 0.4;
    const g = new THREE.Group();
    g.position.set((x1 + x2) / 2, base(f), (z1 + z2) / 2);
    if (z1 !== z2) g.rotation.y = Math.PI / 2;
    scene.add(g);
    if (kind === 'solid') {
      box(L, wallH, T, M.wall, 0, wallH / 2, 0, g);
    } else {
      box(L, 0.9, T, M.wall, 0, 0.45, 0, g);
      box(L, 0.6, T, M.wall, 0, wallH - 0.3, 0, g);
      const pane = box(L, wallH - 1.5, 0.06, glass[f], 0, 0.9 + (wallH - 1.5) / 2, 0, g);
      pane.castShadow = false;
      anim(0.68 + (f - 1) * 0.02, 0.73 + (f - 1) * 0.02, showScale(pane, 'x'));
    }
    g.children.filter((c) => c.material === M.wall).forEach((c) => (c.userData.wall = true));
    return g;
  }
  for (let f = 1; f < LEVELS; f++) {
    const bays = [];
    for (let i = 0; i < 2; i++) {
      bays.push(bay(XS[i], D / 2, XS[i + 1], D / 2, f, 'window'));  // front
      bays.push(bay(XS[i], -D / 2, XS[i + 1], -D / 2, f, 'solid')); // back
    }
    for (let j = 0; j < 3; j++) {
      const kind = j === 1 ? 'window' : 'solid';
      bays.push(bay(-W / 2, ZS[j], -W / 2, ZS[j + 1], f, kind));
      bays.push(bay(W / 2, ZS[j], W / 2, ZS[j + 1], f, kind));
    }
    const s = 0.46 + (f - 1) * 0.045;
    bays.forEach((g, i) => {
      const walls = g.children.filter((c) => c.userData.wall);
      anim(s + i * 0.002, s + 0.05 + i * 0.002, (k) => walls.forEach((w) => { w.visible = k > 0; w.scale.y = Math.max(0.0001, k); }));
    });
  }
  // stilt level: rear wall only
  for (let i = 0; i < 2; i++) {
    const g = bay(XS[i], -D / 2, XS[i + 1], -D / 2, 0, 'solid');
    const w = g.children[0];
    anim(0.455, 0.49, (k) => { w.visible = k > 0; w.scale.y = Math.max(0.0001, k); });
  }

  // ---------- facade ----------
  // fluted louvers over the left third of the front elevation
  const finH = TOP - base(1);
  for (let i = 0; i < 9; i++) {
    const fin = box(0.09, finH, 0.42, M.fin, -W / 2 - 0.3 + i * 0.36, base(1), D / 2 + 0.45);
    fin.geometry.translate(0, finH / 2, 0);
    anim(0.7 + i * 0.008, 0.76 + i * 0.008, showScale(fin, 'y'));
  }
  // balconies with glass railings
  for (let f = 1; f < LEVELS; f++) {
    const bal = box(W - 2.2, 0.2, 1.5, M.concrete, 1.1, base(f) - 0.1, D / 2 + 0.95);
    const rail = box(W - 2.2, 1.0, 0.05, M.rail, 1.1, base(f) + 0.5, D / 2 + 1.65);
    rail.castShadow = false;
    const s = 0.72 + (f - 1) * 0.015;
    anim(s, s + 0.04, showScale(bal, 'x'));
    anim(s + 0.02, s + 0.06, showScale(rail, 'x'));
  }
  // roof parapet + stair headroom
  [[0, D / 2, W + 0.8, 0.2], [0, -D / 2, W + 0.8, 0.2], [-W / 2, 0, 0.2, D + 0.8], [W / 2, 0, 0.2, D + 0.8]].forEach(([x, z, w, d]) => {
    const p = box(w, 1, d, M.wall, x, TOP, z);
    p.geometry.translate(0, 0.5, 0);
    anim(0.76, 0.82, showScale(p, 'y'));
  });
  const mumty = box(3.4, 2.7, 3.8, M.wall, 2.6, TOP, -D / 2 + 2.2);
  mumty.geometry.translate(0, 1.35, 0);
  anim(0.78, 0.85, showScale(mumty, 'y'));

  // ---------- tower crane ----------
  const MAST = 25;
  const crane = new THREE.Group();
  crane.position.set(-10.5, 0, -5.5);
  scene.add(crane);
  box(3, 1, 3, M.concrete, 0, 0.5, 0, crane);
  [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].forEach(([x, z]) => box(0.14, MAST, 0.14, M.crane, x, MAST / 2, z, crane));
  {
    const n = Math.floor(MAST / 1.5);
    const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.08, 0.08), M.crane, n * 4);
    const diag = new THREE.InstancedMesh(new THREE.BoxGeometry(Math.hypot(1, 1.5), 0.06, 0.06), M.crane, n * 4);
    const m = new THREE.Object3D();
    let k = 0;
    for (let i = 0; i < n; i++) {
      for (let side = 0; side < 4; side++) {
        const rot = side * Math.PI / 2;
        const ox = Math.sin(rot) * 0.5, oz = Math.cos(rot) * 0.5;
        m.position.set(ox, 1 + i * 1.5, oz); m.rotation.set(0, rot, 0); m.updateMatrix();
        ties.setMatrixAt(k, m.matrix);
        m.position.set(ox, 1.75 + i * 1.5, oz); m.rotation.set(0, rot, 0); m.rotateZ(Math.atan2(1.5, 1) * (i % 2 ? 1 : -1)); m.updateMatrix();
        diag.setMatrixAt(k, m.matrix);
        k++;
      }
    }
    ties.castShadow = diag.castShadow = true;
    crane.add(ties, diag);
  }
  const slew = new THREE.Group();
  slew.position.y = MAST;
  crane.add(slew);
  box(1.3, 1.3, 1.5, M.crane, 1.1, 0.4, 0, slew);                  // cab
  box(0.16, 3.2, 0.16, M.crane, 0, 1.6, 0, slew);                  // A-frame top
  const JIB = 19;
  box(JIB, 0.12, 0.12, M.crane, JIB / 2, 0.15, 0.35, slew);
  box(JIB, 0.12, 0.12, M.crane, JIB / 2, 0.15, -0.35, slew);
  box(JIB, 0.12, 0.12, M.crane, JIB / 2, 1.0, 0, slew);
  {
    const web = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), M.crane, JIB * 2);
    const m = new THREE.Object3D();
    for (let i = 0; i < JIB; i++) {
      [-1, 1].forEach((s, j) => {
        m.position.set(i + 0.5, 0.58, s * 0.18); m.rotation.set(s * 0.33, 0, (i % 2 ? 1 : -1) * 0.45); m.updateMatrix();
        web.setMatrixAt(i * 2 + j, m.matrix);
      });
    }
    web.castShadow = true;
    slew.add(web);
  }
  box(7, 0.35, 0.9, M.crane, -3.5, 0.2, 0, slew);                  // counter-jib
  box(1.4, 1.8, 1.3, M.concrete, -6.2, -0.4, 0, slew);             // counterweight
  {
    const pts = [new THREE.Vector3(0, 3.2, 0), new THREE.Vector3(JIB * 0.7, 1.05, 0), new THREE.Vector3(0, 3.2, 0), new THREE.Vector3(-6.4, 0.5, 0)];
    slew.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x8a8f96 })));
  }
  const trolley = box(0.7, 0.3, 0.8, M.steel, 12, -0.05, 0, slew);
  const cableGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 6);
  cableGeo.translate(0, -0.5, 0);
  const cable = new THREE.Mesh(cableGeo, M.steel);
  trolley.add(cable);
  const hook = new THREE.Group();
  trolley.add(hook);
  box(0.45, 0.6, 0.3, M.amber, 0, -0.3, 0, hook);
  const load = box(2.6, 0.16, 1.3, M.wood, 0, -1.4, 0, hook);      // shuttering plate
  box(0.04, 0.9, 0.04, M.steel, 0, -0.9, 0, hook);
  load.castShadow = true;

  // ---------- neighbourhood ----------
  const rand = rng(7);
  const winTex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 128, 256);
    for (let y = 10; y < 250; y += 26) for (let x = 8; x < 124; x += 20) {
      if (rand() < 0.5) { g.fillStyle = `hsl(${28 + rand() * 18}, 90%, ${50 + rand() * 25}%)`; g.fillRect(x, y, 11, 13); }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const nbMat = new THREE.MeshStandardMaterial({ color: 0x34363d, roughness: 0.95, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.05 });
  const nbMat2 = nbMat.clone(); nbMat2.color.set(0x4a4540);
  // plots next door are old 1–2 storey houses (the kind owners rebuild); taller blocks further out
  const neighbour = (x, z, w, d) => {
    const near = Math.abs(x) < 36 && z > -D - 10;
    const h = near ? 3.4 + Math.floor(rand() * 2) * H : 8 + Math.floor(rand() * 4) * H;
    const b = box(w, h, d, rand() < 0.5 ? nbMat : nbMat2, x, h / 2, z);
    b.castShadow = !mobile;
  };
  for (let x = -70; x <= 70; x += 12.5) if (Math.abs(x) > 12) neighbour(x, 0, 10.5, D);
  for (let x = -75; x <= 75; x += 12.5) neighbour(x + rand() * 2, -D - 6, 10.5, D);
  // street trees
  const leafGeo = new THREE.IcosahedronGeometry(1.5, 0);
  for (let x = -60; x <= 60; x += 8) {
    if (Math.abs(x) < 8) continue;
    const tree = new THREE.Group();
    tree.position.set(x + rand() * 2, 0, D / 2 + 3.7);
    box(0.22, 2.2, 0.22, M.trunk, 0, 1.1, 0, tree);
    const leaf = new THREE.Mesh(leafGeo, M.leaf);
    leaf.position.y = 3.2; leaf.scale.setScalar(0.8 + rand() * 0.5); leaf.rotation.y = rand() * 3;
    leaf.castShadow = true;
    tree.add(leaf);
    scene.add(tree);
  }

  // ---------- frame update ----------
  let progress = 0, smooth = 0, mx = 0, my = 0, tmx = 0, tmy = 0;
  const fogDay = new THREE.Color(0x6f5a55), fogNight = new THREE.Color(0x0b0e16);
  const target = new THREE.Vector3();

  function apply(p, t) {
    for (const a of anims) a.fn(a.e(win(p, a.a, a.b)));

    // finishes: brick -> plaster, raw concrete -> painted
    const paint = easeInOut(win(p, 0.66, 0.78));
    M.wall.color.copy(colors.brick).lerp(colors.plaster, paint);
    M.concrete.color.copy(colors.raw).lerp(colors.finished, paint);

    // day -> night, lights on floor by floor
    const night = easeInOut(win(p, 0.84, 0.97));
    sky.top.copy(sky.dayTop).lerp(sky.nightTop, night);
    sky.bottom.copy(sky.dayBottom).lerp(sky.nightBottom, night);
    scene.fog.color.copy(fogDay).lerp(fogNight, night);
    sun.intensity = lerp(2.4, 0.12, night);
    hemi.intensity = lerp(0.9, 0.18, night);
    nbMat.emissiveIntensity = nbMat2.emissiveIntensity = lerp(0.05, 1.1, night);
    for (let f = 1; f < LEVELS; f++) glass[f].emissiveIntensity = 1.5 * easeOut(win(p, 0.88 + (f - 1) * 0.022, 0.92 + (f - 1) * 0.022));
    porch.intensity = 40 * easeOut(win(p, 0.9, 0.97));

    // crane works over the rising building, then leaves the site
    const builtTo = p < 0.18 ? 0 : p < 0.46 ? base(Math.floor((p - 0.18) / 0.056) + 1) : TOP;
    // -0.48 rad points the jib at the middle of the plot
    slew.rotation.y = -0.48 + Math.sin(p * 7) * 0.45 + (reducedMotion ? 0 : Math.sin(t * 0.15) * 0.12);
    trolley.position.x = 11 + Math.sin(p * 9 + (reducedMotion ? 0 : t * 0.25)) * 3.5;
    const drop = Math.max(2, MAST - builtTo - 3.5 + Math.sin(p * 14) * 1.5);
    cable.scale.y = drop;
    hook.position.y = -drop;
    load.visible = p < 0.66;
    crane.position.y = -MAST * 1.15 * easeInOut(win(p, 0.86, 0.95));
    crane.visible = p < 0.95;

    // camera orbit
    const aspect = camera.aspect;
    const fit = aspect < 1 ? Math.min(2.1, 1.05 / aspect) : 1;
    const th = lerp(0.78, -0.62, easeInOut(p)) + mx * 0.08;
    const r = (40 - 7 * Math.sin(p * Math.PI) + 10 * easeInOut(win(p, 0.86, 1))) * fit;
    const h = 13 + 5 * Math.sin(p * Math.PI) + my * 1.5 + 4 * win(p, 0.86, 1);
    target.set(0, lerp(3, 8, easeInOut(win(p, 0.12, 0.75))), 0);
    camera.position.set(target.x + Math.sin(th) * r, h, target.z + Math.cos(th) * r);
    camera.lookAt(target);
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // push the building to the right on wide screens (copy sits left), down on phones (copy sits on top)
    if (w > 1000) camera.setViewOffset(w, h, -w * 0.17, 0, w, h);
    else if (w > 760) camera.setViewOffset(w, h, -w * 0.08, -h * 0.04, w, h);
    else camera.setViewOffset(w, h, 0, -h * 0.17, w, h);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  if (!reducedMotion) {
    window.addEventListener('pointermove', (e) => {
      tmx = (e.clientX / innerWidth) * 2 - 1;
      tmy = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
  }

  let running = false, raf = 0;
  const clock = new THREE.Clock();
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    // frame-rate independent easing towards the scroll position
    smooth += (progress - smooth) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 5));
    if (Math.abs(progress - smooth) < 0.0005) smooth = progress;
    mx += (tmx - mx) * (1 - Math.exp(-dt * 2.5)); my += (tmy - my) * (1 - Math.exp(-dt * 2.5));
    apply(smooth, t);
    renderer.render(scene, camera);
  }

  apply(0, 0);
  renderer.render(scene, camera);

  return {
    setProgress(p) { progress = clamp01(p); },
    setActive(on) {
      if (on === running) return;
      running = on;
      if (on) { clock.getDelta(); frame(); } else cancelAnimationFrame(raf);
    },
  };
}
