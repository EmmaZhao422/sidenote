// "Remind me tomorrow": a calendar file the student's own calendar app opens.
// A static site cannot send notifications tomorrow, but a calendar can.

const pad = (n) => String(n).padStart(2, '0');

// Local time without a zone ("floating"), which calendars read as the device's own time
function stamp(d) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

// Calendar text needs commas, semicolons, backslashes and line breaks escaped
function esc(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => `\\${m}`).replace(/\r?\n/g, '\\n');
}

// { title, start: Date, minutes, url, note }
export function buildIcs({ title, start, minutes, url, note }) {
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
    '',
  ].join('\r\n');
}

// Tomorrow at the time this block started, rounded to the quarter hour
export function tomorrowAt(startedAt) {
  const d = new Date(startedAt);
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setHours(d.getHours(), Math.round(d.getMinutes() / 15) * 15, 0, 0);
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
