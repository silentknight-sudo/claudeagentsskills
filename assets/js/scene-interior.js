// 3D room preview for The Interior Affairs: fluted feature wall, PVC panels and an LED cove ceiling.
import * as THREE from 'three';

const FINISHES = {
  walnut: { color: 0x5b3a26, roughness: 0.5 },
  oak: { color: 0xb08a5f, roughness: 0.55 },
  charcoal: { color: 0x2a2a2d, roughness: 0.85 },
  marble: null, // flat PVC marble sheet instead of flutes
};
const LEDS = { warm: 0xffb46b, cool: 0xcfe3ff, off: 0x000000 };

function marbleTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#ece8e1'; g.fillRect(0, 0, 512, 512);
  let seed = 3; const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(${120 + r() * 40}, ${110 + r() * 30}, ${100 + r() * 30}, ${0.08 + r() * 0.25})`;
    g.lineWidth = 0.5 + r() * 2.5;
    g.beginPath();
    let x = r() * 512, y = 0;
    g.moveTo(x, y);
    while (y < 512) { x += (r() - 0.5) * 60; y += 20 + r() * 40; g.lineTo(x, y); }
    g.stroke();
  }
  // panel joints every 1/4
  g.fillStyle = 'rgba(0,0,0,.18)';
  for (let x = 128; x < 512; x += 128) g.fillRect(x - 1, 0, 2, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function plankTexture(base, line) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  g.fillStyle = line;
  for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 256, 1.5);
  for (let y = 0; y < 256; y += 32) g.fillRect(((y / 32) * 97) % 256, y, 1.5, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function createInteriorScene(canvas, { reducedMotion = false } = {}) {
  const mobile = matchMedia('(max-width: 760px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0d0b);
  scene.fog = new THREE.Fog(0x0e0d0b, 10, 22);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 60);

  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  // Room: back wall at z=-3, left wall at x=-4, open towards the camera.
  const RH = 3.2;
  const floorTex = plankTexture('#7a5a40', 'rgba(0,0,0,.25)'); floorTex.repeat.set(3, 6);
  const floor = add(new THREE.PlaneGeometry(14, 14), std(0xffffff, { map: floorTex, roughness: 0.45 }), 1, 0, 1);
  floor.rotation.x = -Math.PI / 2;
  const paint = std(0xd9d3c8, { roughness: 0.95 });
  add(new THREE.PlaneGeometry(10, RH), paint, 1, RH / 2, -3);
  const pvcTex = plankTexture('#d6d0c6', 'rgba(0,0,0,.12)'); pvcTex.rotation = Math.PI / 2; pvcTex.repeat.set(3, 2);
  const left = add(new THREE.PlaneGeometry(8, RH), std(0xffffff, { map: pvcTex, roughness: 0.6 }), -4, RH / 2, 1);
  left.rotation.y = Math.PI / 2;

  // Ceiling: recessed coffer with an LED cove around it
  const ceilMat = std(0xe9e4dc, { roughness: 0.9 });
  const ceil = add(new THREE.PlaneGeometry(10, 8), ceilMat, 1, RH + 0.25, 1);
  ceil.rotation.x = Math.PI / 2;
  const bulk = std(0xf1ede6, { roughness: 0.85 });
  const CX0 = -2.6, CX1 = 3.2, CZ0 = -1.8, CZ1 = 2.6, BY = RH - 0.05, BT = 0.3;
  add(new THREE.BoxGeometry(10, BT, CZ0 + 3), bulk, 1, BY, (CZ0 - 3) / 2);
  add(new THREE.BoxGeometry(10, BT, 5 - CZ1), bulk, 1, BY, (CZ1 + 5) / 2);
  add(new THREE.BoxGeometry(CX0 + 4, BT, CZ1 - CZ0), bulk, (CX0 - 4) / 2, BY, (CZ0 + CZ1) / 2);
  add(new THREE.BoxGeometry(6 - CX1, BT, CZ1 - CZ0), bulk, (CX1 + 6) / 2, BY, (CZ0 + CZ1) / 2);
  const ledMat = new THREE.MeshBasicMaterial({ color: LEDS.warm });
  // strips sit on the inner lip of the bulkhead so they read as a glowing line from below
  const ledY = BY + BT / 2 - 0.03, IN = 0.03;
  [[CX1 - CX0, (CX0 + CX1) / 2, CZ0 + IN, 'x'], [CX1 - CX0, (CX0 + CX1) / 2, CZ1 - IN, 'x'], [CZ1 - CZ0, CX0 + IN, (CZ0 + CZ1) / 2, 'z'], [CZ1 - CZ0, CX1 - IN, (CZ0 + CZ1) / 2, 'z']]
    .forEach(([len, x, z, ax]) => add(new THREE.BoxGeometry(ax === 'x' ? len : 0.05, 0.04, ax === 'x' ? 0.05 : len), ledMat, x, ledY, z));
  const coveLights = [[CX0 + 0.6, CZ0 + 0.6], [CX1 - 0.6, CZ0 + 0.6], [CX0 + 0.6, CZ1 - 0.6], [CX1 - 0.6, CZ1 - 0.6]].map(([x, z]) => {
    const l = new THREE.PointLight(LEDS.warm, 3.5, 7, 2); l.position.set(x, RH + 0.1, z); scene.add(l); return l;
  });

  // Feature wall: half-round flutes or a flat marble sheet
  const FW = 6, FX0 = -4, FH = RH - 0.05;
  const fluteGeo = new THREE.CylinderGeometry(0.06, 0.06, FH, 12, 1, false, -Math.PI / 2, Math.PI);
  const fluteMat = std(FINISHES.walnut.color, { roughness: FINISHES.walnut.roughness });
  const COUNT = Math.floor(FW / 0.125);
  const flutes = new THREE.InstancedMesh(fluteGeo, fluteMat, COUNT);
  {
    const m = new THREE.Object3D();
    for (let i = 0; i < COUNT; i++) { m.position.set(FX0 + 0.0625 + i * 0.125, FH / 2, -2.97); m.updateMatrix(); flutes.setMatrixAt(i, m.matrix); }
  }
  scene.add(flutes);
  const fluteBack = add(new THREE.PlaneGeometry(FW, FH), std(0x1c140e), FX0 + FW / 2, FH / 2, -2.985);
  const marble = add(new THREE.PlaneGeometry(FW, FH), std(0xffffff, { map: marbleTexture(), roughness: 0.25 }), FX0 + FW / 2, FH / 2, -2.96);
  marble.visible = false;
  // wall-washers graze the flutes so the grooves read
  [-3, -1, 1].forEach((x) => {
    const s = new THREE.SpotLight(0xfff0dc, 14, 0, 0.55, 0.85, 2);
    s.position.set(x, RH - 0.2, -2.4); s.target.position.set(x, 0, -3);
    scene.add(s, s.target);
  });

  // Furniture
  const fabric = std(0xcfc2ab, { roughness: 1 });
  const sofa = new THREE.Group(); sofa.position.set(-0.8, 0, -1.9); scene.add(sofa);
  add(new THREE.BoxGeometry(2.8, 0.42, 0.95), fabric, 0, 0.33, 0, sofa);
  add(new THREE.BoxGeometry(2.8, 0.55, 0.25), fabric, 0, 0.8, -0.38, sofa);
  add(new THREE.BoxGeometry(0.22, 0.6, 0.95), fabric, -1.4, 0.42, 0, sofa);
  add(new THREE.BoxGeometry(0.22, 0.6, 0.95), fabric, 1.4, 0.42, 0, sofa);
  add(new THREE.BoxGeometry(2.7, 0.1, 0.85), std(0x2a2420), 0, 0.07, 0, sofa);
  const rug = add(new THREE.PlaneGeometry(3.4, 2.4), std(0x4a4038, { roughness: 1 }), -0.8, 0.01, 0);
  rug.rotation.x = -Math.PI / 2;
  const brass = std(0xc9a26b, { metalness: 0.8, roughness: 0.3 });
  add(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 40), std(0x1e1c1a, { roughness: 0.3 }), -0.8, 0.42, 0.1);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 12), brass, -0.8, 0.2, 0.1);
  // plant
  add(new THREE.CylinderGeometry(0.22, 0.17, 0.5, 20), std(0xb9b2a6), -3.3, 0.25, -2.4);
  const leaves = add(new THREE.IcosahedronGeometry(0.5, 1), std(0x35553a, { flatShading: true }), -3.3, 0.95, -2.4);
  leaves.scale.set(1, 1.4, 1);
  // floor lamp
  add(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 8), brass, 1.1, 0.8, -2.3);
  add(new THREE.SphereGeometry(0.16, 20, 12), new THREE.MeshBasicMaterial({ color: 0xffe2b8 }), 1.1, 1.65, -2.3);
  const lamp = new THREE.PointLight(0xffc98f, 1.5, 4, 2); lamp.position.set(1.1, 1.65, -2.2); scene.add(lamp);
  // console with a TV on the plain wall
  add(new THREE.BoxGeometry(2.2, 0.4, 0.4), std(0x2a2420, { roughness: 0.5 }), 3.7, 0.35, -2.75);
  add(new THREE.BoxGeometry(1.7, 0.95, 0.05), std(0x0b0b0c, { roughness: 0.2, metalness: 0.4 }), 3.7, 1.55, -2.95);

  scene.add(new THREE.HemisphereLight(0xfff3e2, 0x2a2018, 0.45));
  const key = new THREE.DirectionalLight(0xfff1de, 0.6); key.position.set(4, 5, 6); scene.add(key);

  // ---------- controls: horizontal drag orbits, vertical scroll still scrolls ----------
  const target = new THREE.Vector3(-0.4, 1.35, -1.2);
  let theta = 0.62, tTheta = 0.62, dragging = false, lastX = 0, idle = 0;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    tTheta = Math.min(1.1, Math.max(0.15, tTheta - (e.clientX - lastX) * 0.004));
    lastX = e.clientX; idle = 0;
  });
  const end = () => { dragging = false; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 56 : 46;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  let running = false, raf = 0;
  const clock = new THREE.Clock();
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    idle += dt;
    if (!reducedMotion && !dragging && idle > 2.5) tTheta = 0.62 + Math.sin(clock.elapsedTime * 0.25) * 0.28;
    theta += (tTheta - theta) * 0.06;
    const r = 5.6;
    camera.position.set(target.x + Math.sin(theta) * r, 1.75, target.z + Math.cos(theta) * r);
    camera.lookAt(target);
    renderer.render(scene, camera);
  }
  function render() { camera.position.set(target.x + Math.sin(theta) * 5.6, 1.75, target.z + Math.cos(theta) * 5.6); camera.lookAt(target); renderer.render(scene, camera); }
  render();

  return {
    setFinish(name) {
      const f = FINISHES[name];
      const isMarble = !f;
      marble.visible = isMarble;
      flutes.visible = fluteBack.visible = !isMarble;
      if (f) { fluteMat.color.set(f.color); fluteMat.roughness = f.roughness; }
      if (!running) render();
    },
    setLed(name) {
      const c = LEDS[name] ?? LEDS.warm;
      ledMat.color.set(name === 'off' ? 0x3a3936 : c);
      coveLights.forEach((l) => { l.color.set(c); l.intensity = name === 'off' ? 0 : 3.5; });
      if (!running) render();
    },
    setActive(on) {
      if (on === running) return;
      running = on;
      if (on) { clock.getDelta(); frame(); } else cancelAnimationFrame(raf);
    },
  };
}
