// The study blocks as a spreadsheet file (CSV), for students who keep their own
// records in Excel, Numbers or Google Sheets.

import { getScene } from './scenes.js';

// A cell is quoted when it holds a comma, a quote or a line break. A cell that a
// spreadsheet would read as a formula (= + - @) gets a leading apostrophe, so
// text typed as a goal can never run as one.
export function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const pad = (n) => String(n).padStart(2, '0');

export function sessionsToCsv(sessions) {
  const head = ['date', 'start', 'goal', 'planned_minutes', 'focus_minutes', 'focus_score', 'own_rating_1_to_5', 'finished_plan', 'scene', 'pauses', 'thoughts_parked'];
  const rows = [...sessions].sort((a, b) => a.startedAt - b.startedAt).map((s) => {
    const d = new Date(s.startedAt);
    return [
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      s.goal || '',
      s.plannedMin ?? '',
      Math.round((s.focusSec || 0) / 60),
      s.score ?? '',
      s.rating ?? '',
      s.finished || '',
      getScene(s.scene)?.en || s.scene || '',
      s.pauses ?? 0,
      s.parkedCount ?? 0,
    ];
  });
  // The first character (a byte-order mark) tells Excel the file is UTF-8, so Chinese goals show correctly
  return `﻿${[head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
