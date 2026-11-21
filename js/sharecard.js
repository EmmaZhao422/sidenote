// A picture of the week to share: focus time, blocks, thoughts parked, the scene
// you focus best with. It holds numbers only. Nothing the student typed (goals,
// thoughts) ever goes on it, so it is safe to post.

import { h, toast, minutesText, dayLabel } from './ui.js';
import { t, getLang } from './i18n.js';
import { CONFIG } from './config.js';
import { getScene, sceneName } from './scenes.js';

const W = 1080;
const H = 1350;
const INK = '#18213D';
const INK2 = '#485272';
const PAPER = '#F5F7FC';
const MARGIN = '#E2466B';
const HL = '#FFE566';
const RULE = '#D5DDF0';

// stats: from aggregate(); rec: from recommendScene(); rangeLabel: "7 days"
export async function drawShareCard(stats, rec, rangeLabel) {
  const lang = getLang();
  const display = '"Bricolage Grotesque", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif';
  const body = 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
  try { await document.fonts.load(`800 100px ${display}`); } catch { /* falls back to the system font */ }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');

  // ruled notebook paper with the pink margin line
  g.fillStyle = PAPER;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = RULE;
  g.lineWidth = 2;
  for (let y = 250; y < H - 120; y += 68) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.fillStyle = MARGIN;
  g.fillRect(96, 0, 5, H);

  const left = 150;
  g.textBaseline = 'alphabetic';

  // brand mark and title
  g.fillStyle = HL;
  g.fillRect(left, 92, 26, 36);
  g.fillStyle = MARGIN;
  g.fillRect(left, 92, 5, 36);
  g.fillStyle = INK;
  g.font = `800 40px ${display}`;
  g.fillText(lang === 'zh' ? CONFIG.siteNameZh : CONFIG.siteName, left + 42, 124);
  g.fillStyle = INK2;
  g.font = `500 34px ${body}`;
  g.fillText(t('share.heading', { range: rangeLabel }), left, 196);

  // the headline number, on a strip of highlighter
  const big = minutesText(stats.focusMin);
  g.font = `800 150px ${display}`;
  const bigW = g.measureText(big).width;
  g.fillStyle = HL;
  g.fillRect(left - 10, 330, Math.min(bigW + 20, W - left - 60), 62);
  g.fillStyle = INK;
  g.fillText(big, left, 380, W - left - 70);
  g.fillStyle = INK2;
  g.font = `500 38px ${body}`;
  g.fillText(t('share.focus'), left, 448);

  // three facts
  const facts = [
    [String(stats.sessionCount), t('share.blocks')],
    [stats.avgScore === null ? '–' : String(stats.avgScore), t('share.score')],
    [String(stats.thoughtCount), t('share.parked')],
  ];
  facts.forEach(([value, label], i) => {
    const x = left + i * 290;
    g.fillStyle = INK;
    g.font = `800 92px ${display}`;
    g.fillText(value, x, 640);
    g.fillStyle = INK2;
    g.font = `500 30px ${body}`;
    wrapText(g, label, x, 690, 250, 38);
  });

  // minutes per day
  const days = stats.byDay.slice(-7);
  if (days.length > 1) {
    const peak = Math.max(25, ...days.map((d) => d.minutes));
    const baseY = 1010;
    const colW = (W - left - 110) / days.length;
    days.forEach((d, i) => {
      const hgt = d.minutes ? Math.max(10, (d.minutes / peak) * 190) : 0;
      const x = left + i * colW;
      g.fillStyle = d.minutes === Math.max(...days.map((q) => q.minutes)) ? MARGIN : INK;
      if (hgt) roundRect(g, x, baseY - hgt, colW - 26, hgt, 8);
      g.fillStyle = INK2;
      g.font = `500 26px ${body}`;
      g.fillText(dayLabel(d.day), x, baseY + 42);
    });
    g.fillStyle = INK;
    g.fillRect(left, baseY, W - left - 110, 3);
  }

  // the scene, if there is a favourite
  if (rec && rec.status === 'ready') {
    g.fillStyle = INK;
    g.font = `600 40px ${display}`;
    g.fillText(t('share.scene', { scene: sceneName(getScene(rec.best.id), lang) }), left, 1150, W - left - 70);
  }

  // where it came from
  g.fillStyle = INK2;
  g.font = `500 30px ${body}`;
  g.fillText(CONFIG.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''), left, H - 70);
  return canvas;
}

function roundRect(g, x, y, w, hgt, r) {
  g.beginPath();
  g.moveTo(x, y + hgt);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + hgt);
  g.closePath();
  g.fill();
}

// Breaks a label over lines that fit `maxWidth` (word by word, or character by character for Chinese)
function wrapText(g, text, x, y, maxWidth, lineHeight) {
  const parts = /\s/.test(text) ? text.split(/\s+/).map((w) => `${w} `) : [...text];
  let line = '';
  let yy = y;
  parts.forEach((part) => {
    if (line && g.measureText(line + part).width > maxWidth) {
      g.fillText(line.trimEnd(), x, yy);
      line = '';
      yy += lineHeight;
    }
    line += part;
  });
  if (line.trim()) g.fillText(line.trimEnd(), x, yy);
}

// A button that makes the picture, then shares it (phones) or saves it (computers)
export function shareCardButton(getData) {
  const btn = h('button', {
    type: 'button', class: 'btn btn-quiet',
    onclick: async () => {
      btn.disabled = true;
      try {
        const { stats, rec, rangeLabel } = getData();
        const canvas = await drawShareCard(stats, rec, rangeLabel);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        const file = new File([blob], 'sidenote-week.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          try { await navigator.share({ files: [file], title: t('share.title') }); } catch { /* the student closed the share sheet */ }
        } else {
          const a = h('a', { href: URL.createObjectURL(blob), download: 'sidenote-week.png' });
          document.body.append(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          toast(t('share.saved'));
        }
      } catch {
        toast(t('share.failed'));
      }
      btn.disabled = false;
    },
  }, t('share.button'));
  return btn;
}
