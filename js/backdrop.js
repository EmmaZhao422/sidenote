// The moving picture behind a focus session: rain streaks, embers, stars...
// One small particle system with a preset per scene. It is deliberately slow
// and dim: it is there to set a mood, not to be watched.

const PRESETS = {
  rain:   { count: 90, color: '190,210,255', vx: -0.6, vy: 9,    len: 14, size: 1,   alpha: 0.28, twinkle: 0 },
  embers: { count: 40, color: '255,170,90',  vx: 0.15, vy: -0.7, len: 0,  size: 1.8, alpha: 0.7,  twinkle: 0.6, bottom: true },
  leaves: { count: 30, color: '200,235,190', vx: 0.7,  vy: 0.35, len: 0,  size: 2.2, alpha: 0.3,  twinkle: 0.2 },
  stars:  { count: 110, color: '235,235,255', vx: 0,   vy: 0,    len: 0,  size: 1.3, alpha: 0.8,  twinkle: 1 },
  rails:  { count: 14, color: '255,225,170', vx: -7,   vy: 0,    len: 46, size: 2,   alpha: 0.25, twinkle: 0, band: [0.58, 0.72] },
  dust:   { count: 36, color: '255,240,210', vx: 0.08, vy: -0.05, len: 0, size: 1.6, alpha: 0.28, twinkle: 0.4 },
  drift:  { count: 22, color: '255,255,255', vx: 0.12, vy: 0.04, len: 0,  size: 2.4, alpha: 0.14, twinkle: 0.3 },
  waves:  { count: 0 },
  none:   { count: 0 },
};

export function createBackdrop(canvas) {
  const g = canvas.getContext('2d');
  const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let preset = PRESETS.none;
  let kind = 'none';
  let parts = [];
  let raf = 0;
  let w = 0, h = 0, t = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawn(anywhere) {
    const p = preset;
    const y0 = p.band ? p.band[0] * h : 0;
    const y1 = p.band ? p.band[1] * h : h;
    return {
      x: Math.random() * w,
      y: p.bottom && !anywhere ? h + 4 : y0 + Math.random() * (y1 - y0),
      s: 0.5 + Math.random(),            // personal speed and size multiplier
      phase: Math.random() * Math.PI * 2,
    };
  }

  function drawWaves() {
    for (let i = 0; i < 4; i++) {
      const base = h * (0.62 + i * 0.09);
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w; x += 12) {
        const y = base + Math.sin(x * 0.006 + t * (0.25 + i * 0.07) + i * 1.7) * (10 + i * 3);
        g.lineTo(x, y);
      }
      g.lineTo(w, h);
      g.closePath();
      g.fillStyle = `rgba(190,235,240,${0.05 + i * 0.03})`;
      g.fill();
    }
  }

  // One quiet fixed element per scene, so each place is recognisable at a glance
  function drawSetting() {
    if (kind === 'embers') {
      // the glow of the hearth, flickering
      const flicker = 0.5 + 0.12 * Math.sin(t * 7.3) + 0.08 * Math.sin(t * 12.1 + 1);
      const glow = g.createRadialGradient(w / 2, h * 1.05, 0, w / 2, h * 1.05, Math.max(w, h) * 0.55);
      glow.addColorStop(0, `rgba(255,150,60,${0.55 * flicker})`);
      glow.addColorStop(1, 'rgba(255,150,60,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);
    } else if (kind === 'stars') {
      // a moon
      const x = w * 0.84, y = h * 0.2, r = Math.min(w, h) * 0.045;
      const halo = g.createRadialGradient(x, y, r * 0.5, x, y, r * 5);
      halo.addColorStop(0, 'rgba(220,225,255,0.22)');
      halo.addColorStop(1, 'rgba(220,225,255,0)');
      g.fillStyle = halo;
      g.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
      g.fillStyle = 'rgba(240,242,255,0.9)';
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    } else if (kind === 'leaves') {
      // a line of treetops, swaying very slightly
      g.fillStyle = 'rgba(8,22,18,0.55)';
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) {
        const y = h * 0.88 - Math.abs(Math.sin(x * 0.013)) * h * 0.07
          - Math.abs(Math.sin(x * 0.031 + 2)) * h * 0.035 - Math.sin(x * 0.004 + t * 0.15) * 3;
        g.lineTo(x, y);
      }
      g.lineTo(w, h);
      g.closePath();
      g.fill();
    } else if (kind === 'dust') {
      // light from a reading lamp
      const lamp = g.createRadialGradient(w * 0.2, -h * 0.1, 0, w * 0.2, -h * 0.1, h * 1.1);
      lamp.addColorStop(0, 'rgba(255,214,150,0.28)');
      lamp.addColorStop(1, 'rgba(255,214,150,0)');
      g.fillStyle = lamp;
      g.fillRect(0, 0, w, h);
    } else if (kind === 'rails') {
      // the top and bottom edge of the carriage window
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(0, h * 0.56, w, 2);
      g.fillRect(0, h * 0.74, w, 2);
    }
  }

  function frame() {
    t += 0.016;
    g.clearRect(0, 0, w, h);
    drawSetting();
    if (kind === 'waves') drawWaves();
    const p = preset;
    for (const part of parts) {
      part.x += p.vx * part.s;
      part.y += p.vy * part.s;
      if (kind === 'embers' || kind === 'dust' || kind === 'leaves') part.x += Math.sin(t + part.phase) * 0.3;
      if (part.x < -60 || part.x > w + 60 || part.y < -20 || part.y > h + 20) {
        Object.assign(part, spawn(false));
        if (p.vx < -1) part.x = w + 50;
        else if (p.vy > 1) part.y = -10;
      }
      const flicker = p.twinkle ? 1 - p.twinkle * (0.5 + 0.5 * Math.sin(t * 1.3 * part.s + part.phase)) : 1;
      const a = p.alpha * flicker;
      if (p.len) {
        g.strokeStyle = `rgba(${p.color},${a})`;
        g.lineWidth = p.size;
        g.beginPath();
        g.moveTo(part.x, part.y);
        const mag = Math.hypot(p.vx, p.vy) || 1;
        g.lineTo(part.x - (p.vx / mag) * p.len * part.s, part.y - (p.vy / mag) * p.len * part.s);
        g.stroke();
      } else {
        g.fillStyle = `rgba(${p.color},${a})`;
        g.beginPath();
        g.arc(part.x, part.y, p.size * part.s, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (!still && !document.hidden) raf = requestAnimationFrame(frame);
    else raf = 0;
  }

  function start() {
    cancelAnimationFrame(raf);
    raf = 0;
    resize();
    parts = Array.from({ length: preset.count || 0 }, () => spawn(true));
    frame(); // with reduced motion this draws one still frame and stops
  }

  const onVisible = () => { if (!document.hidden && !raf && !still) raf = requestAnimationFrame(frame); };
  const onResize = () => start();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('resize', onResize);

  return {
    setScene(scene) {
      kind = scene.visual in PRESETS ? scene.visual : 'none';
      preset = PRESETS[kind];
      canvas.parentElement.style.setProperty('--sky-a', scene.sky[0]);
      canvas.parentElement.style.setProperty('--sky-b', scene.sky[1]);
      start();
    },
    destroy() {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('resize', onResize);
    },
  };
}
