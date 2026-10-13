// Page behaviour: scroll-driven build scene, interiors configurator, cost estimator, WhatsApp lead capture.

// Edit business details and indicative rates here.
const CONFIG = {
  whatsapp: '919717863476',        // single WhatsApp Business line for all leads
  coverage: 0.75,                  // assumed built-up area per floor as a share of plot
  stiltFactor: 0.6,                // stilt level costs roughly 60% of a full floor
  rates: {                         // ₹ per sq ft, construction only (indicative)
    essential: [1800, 2100],
    premium: [2300, 2800],
    luxury: [3200, 4200],
  },
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const waLink = (text) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}
const webgl = hasWebGL();
if (!webgl) document.documentElement.classList.add('no-webgl');

// ---------- nav ----------
const nav = $('#nav');
const toggle = $('#nav-toggle');
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  nav.classList.toggle('is-open', open);
  document.body.style.overflow = open ? 'hidden' : '';
});
$$('#nav-links a').forEach((a) => a.addEventListener('click', () => {
  if (toggle.getAttribute('aria-expanded') === 'true') toggle.click();
}));

// ---------- build journey ----------
const buildSection = $('#build');
const panels = $$('.stage-panel', buildSection);
const ticks = $$('.build__progress li', buildSection);
const bar = $('#build-bar');
const STAGES = [0, 0.06, 0.18, 0.46, 0.66, 0.86]; // must match the windows in scene-build.js
let buildScene = null;
let currentStage = -1;

function buildProgress() {
  const r = buildSection.getBoundingClientRect();
  const total = r.height - innerHeight;
  return Math.min(1, Math.max(0, -r.top / total));
}

function onScroll() {
  const p = buildProgress();
  nav.classList.toggle('is-scrolled', scrollY > 40);
  buildSection.classList.toggle('is-started', p > 0.01);
  bar.style.width = `${p * 100}%`;
  let stage = 0;
  STAGES.forEach((s, i) => { if (p >= s) stage = i; });
  if (stage !== currentStage) {
    currentStage = stage;
    panels.forEach((el) => el.classList.toggle('is-active', +el.dataset.stage === stage));
    ticks.forEach((el) => {
      const s = +el.dataset.stage;
      el.classList.toggle('is-done', s < stage);
      el.classList.toggle('is-current', s === stage);
    });
  }
  buildScene?.setProgress(p);
}
let ticking = false;
addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { ticking = false; onScroll(); });
}, { passive: true });
addEventListener('resize', onScroll);
onScroll();

const whenVisible = (el, cb, margin = '0px') => new IntersectionObserver(
  (entries) => entries.forEach((e) => cb(e.isIntersecting)), { rootMargin: margin },
).observe(el);

if (webgl) {
  import('./scene-build.js').then(({ createBuildScene }) => {
    buildScene = createBuildScene($('#build-canvas'), { reducedMotion });
    buildScene.setProgress(buildProgress());
    whenVisible(buildSection, (on) => buildScene.setActive(on));
  }).catch((err) => {
    console.error(err);
    document.documentElement.classList.add('no-webgl');
  });
}

// ---------- interiors configurator ----------
const room = $('#room-canvas');
let roomScene = null;
const roomState = { finish: 'walnut', led: 'warm' };
if (webgl) {
  let requested = false;
  whenVisible(room, (on) => {
    if (on && !requested) {
      requested = true;
      import('./scene-interior.js').then(({ createInteriorScene }) => {
        roomScene = createInteriorScene(room, { reducedMotion });
        roomScene.setFinish(roomState.finish);
        roomScene.setLed(roomState.led);
        whenVisible(room, (vis) => roomScene.setActive(vis));
      }).catch((err) => {
        console.error(err);
        document.documentElement.classList.add('no-webgl');
      });
    }
  }, '300px');
}
$$('.config__opts').forEach((group) => {
  group.addEventListener('click', (e) => {
    const btn = e.target.closest('.swatch');
    if (!btn) return;
    $$('.swatch', group).forEach((b) => { b.classList.toggle('is-on', b === btn); b.setAttribute('aria-pressed', String(b === btn)); });
    roomState[group.dataset.group] = btn.dataset.value;
    if (group.dataset.group === 'finish') roomScene?.setFinish(btn.dataset.value);
    else roomScene?.setLed(btn.dataset.value);
    updatePanelLink();
  });
  $$('.swatch', group).forEach((b) => b.setAttribute('aria-pressed', String(b.classList.contains('is-on'))));
});
function updatePanelLink() {
  const finish = $('.config__opts[data-group="finish"] .is-on').textContent;
  const led = $('.config__opts[data-group="led"] .is-on').textContent;
  $('#panel-wa').href = waLink(`Hi The Interior Affairs, I'd like prices for a ${finish} feature wall with a ${led.toLowerCase()} LED ceiling.`);
  $('#panel-wa').target = '_blank';
  $('#panel-wa').rel = 'noopener';
}
updatePanelLink();

// ---------- cost estimator ----------
const calc = $('#calc');
const inr = (n) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : `₹${(n / 1e5).toFixed(1)} L`);
function updateCalc() {
  const fd = new FormData(calc);
  const plot = Math.max(0, Number(fd.get('plot')) || 0);
  const sqft = fd.get('unit') === 'yd' ? plot * 9 : plot;
  const floors = Number(fd.get('floors'));
  const stilt = fd.get('stilt') === 'on';
  const tier = fd.get('tier');
  const [lo, hi] = CONFIG.rates[tier];
  const perFloor = sqft * CONFIG.coverage;
  const area = perFloor * (floors + (stilt ? CONFIG.stiltFactor : 0));
  const floorsLabel = stilt ? `Stilt + ${floors}` : `G + ${floors - 1}`;
  $('#floors-out').textContent = floorsLabel;

  if (!plot) {
    $('#calc-range').textContent = '₹—';
    $('#calc-detail').textContent = 'Enter your plot size to see a range.';
  } else {
    $('#calc-range').textContent = `${inr(area * lo)} – ${inr(area * hi)}`;
    $('#calc-detail').textContent = `≈ ${Math.round(perFloor).toLocaleString('en-IN')} sq ft per floor · ${floorsLabel} · ₹${lo.toLocaleString('en-IN')}–${hi.toLocaleString('en-IN')}/sq ft`;
  }
  const tierName = tier[0].toUpperCase() + tier.slice(1);
  const msg = [
    'Hi RK Constructions, I used the cost estimator on your website.',
    `Plot: ${plot} ${fd.get('unit') === 'yd' ? 'sq yd' : 'sq ft'} in ${fd.get('locality')}`,
    `Floors: ${floorsLabel}`,
    `Finish: ${tierName}`,
    fd.get('interiors') === 'on' ? 'I also want interiors & panels.' : '',
    'Please share an exact quote and a site visit slot.',
  ].filter(Boolean).join('\n');
  $('#calc-wa').href = waLink(msg);
}
calc.addEventListener('input', updateCalc);
calc.addEventListener('submit', (e) => e.preventDefault());
updateCalc();

// ---------- lead form -> WhatsApp ----------
const form = $('#lead-form');
const note = $('#form-note');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const name = String(fd.get('name')).trim();
  const phone = String(fd.get('phone')).trim();
  if (!name || !/^[0-9+\s-]{10,15}$/.test(phone)) {
    note.textContent = 'Please add your name and a valid phone number.';
    note.classList.add('is-error');
    (!name ? form.elements.name : form.elements.phone).focus();
    return;
  }
  note.classList.remove('is-error');
  const msg = [
    'Hi RK Constructions, I would like to book a free site visit.',
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Service: ${fd.get('service')}`,
    fd.get('area') ? `Locality: ${fd.get('area')}` : '',
    fd.get('msg') ? `Details: ${fd.get('msg')}` : '',
  ].filter(Boolean).join('\n');
  window.open(waLink(msg), '_blank', 'noopener');
  note.textContent = 'Opening WhatsApp… If nothing happens, call +91 97178 63476.';
});

$('#wa-float').href = waLink('Hi RK Constructions, I have a question about a construction / interiors project.');
$('#year').textContent = new Date().getFullYear();

// ---------- reveal on scroll + count-up ----------
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (!e.isIntersecting) return;
  e.target.classList.add('is-in');
  io.unobserve(e.target);
  $$('[data-count]', e.target).forEach((el) => {
    const end = +el.dataset.count;
    if (reducedMotion) { el.textContent = `${end}+`; return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 1400);
      el.textContent = `${Math.round(end * (1 - Math.pow(1 - k, 3)))}${k === 1 ? '+' : ''}`;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}), { threshold: 0.15 });
$$('.reveal').forEach((el) => io.observe(el));

// ---------- 3D tilt on service cards ----------
if (!reducedMotion && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  $$('.tilt').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.transform = `rotateY(${(x - 0.5) * 12}deg) rotateX(${(0.5 - y) * 10}deg) translateZ(0)`;
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
}
