// "Remind me tomorrow": a calendar file the student's own calendar app opens.
// A static site cannot send notifications tomorrow, but a calendar can.

const pad = (n) => String(n).padStart(2, '0');

// Local time without a zone ("floating"), which calendars read as the device's own time
function stamp(d) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

// Calendar text needs commas, semicolons, backslashes and line breaks escaped
function esc(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => `\\${m}`).replace(/\r\n|\r|\n/g, '\\n');
}

// { title, start: Date, minutes, url, note, repeat }
// repeat: 'daily' or 'weekdays' makes it a standing reminder (the calendar repeats it)
export function buildIcs({ title, start, minutes, url, note, repeat }) {
  const rrule = repeat === 'daily' ? 'RRULE:FREQ=DAILY' : repeat === 'weekdays' ? 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' : null;
  const end = new Date(start.getTime() + minutes * 60000);
  const now = new Date();
  const utc = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sidenote//Study block//EN',
    'BEGIN:VEVENT',
    `UID:${start.getTime()}-${Math.random().toString(36).slice(2, 10)}@sidenote`,
    `DTSTAMP:${utc}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    rrule,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(note ? `${note}\n${url}` : url)}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(title)}`,
    'TRIGGER:-PT5M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).map(fold).join('\r\n') + '\r\n';
}

// Calendar files may not have lines longer than 75 bytes: longer ones continue on
// the next line after a space. Cut between characters, never inside one.
function fold(line) {
  const bytes = (ch) => new TextEncoder().encode(ch).length;
  const out = [];
  let cur = '';
  let size = 0;
  for (const ch of line) {
    const n = bytes(ch);
    if (size + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; size = 0; }
    cur += ch;
    size += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

// Tomorrow at the time this block started, rounded to the quarter hour
export function tomorrowAt(startedAt) {
  const d = new Date(startedAt);
  const t = new Date();
  t.setDate(t.getDate() + 1);
  // rounded down to the quarter hour, so 23:53 stays 23:45 tomorrow and never rolls into the day after
  t.setHours(d.getHours(), Math.floor(d.getMinutes() / 15) * 15, 0, 0);
  return t;
}

export function downloadIcs(text, filename = 'study-block.ics') {
  const blob = new Blob([text], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// The next time the clock shows hh:mm: later today if that is still ahead, otherwise
// tomorrow. For 'weekdays' it also skips Saturday and Sunday.
export function nextAt(hhmm, repeat, now = new Date()) {
  const [hh, mm] = String(hhmm).split(':').map((n) => parseInt(n, 10));
  const d = new Date(now);
  d.setHours(Number.isFinite(hh) ? hh : 19, Number.isFinite(mm) ? mm : 0, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1);
  if (repeat === 'weekdays') while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}
