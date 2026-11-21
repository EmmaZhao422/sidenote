import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, tomorrowAt } from '../js/ics.js';

test('the calendar file is a valid single event with a reminder', () => {
  const start = new Date(2026, 10, 22, 9, 30);
  const ics = buildIcs({ title: 'Study: stats, problem set 6; part 2', start, minutes: 25, url: 'https://example.com/', note: 'Step one\nStep two' });
  const lines = ics.split('\r\n');
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  assert.ok(lines.includes('DTSTART:20261122T093000'));
  assert.ok(lines.includes('DTEND:20261122T095500'));
  assert.ok(lines.includes('SUMMARY:Study: stats\\, problem set 6\\; part 2'));
  assert.ok(lines.some((l) => l === 'DESCRIPTION:Step one\\nStep two\\nhttps://example.com/'));
  assert.ok(lines.includes('TRIGGER:-PT5M'));
  assert.equal(lines.filter((l) => l === 'BEGIN:VEVENT').length, 1);
});

test('"tomorrow at the same time" lands on the next day, on a quarter hour', () => {
  const started = new Date(2026, 10, 21, 16, 52).getTime();
  const when = tomorrowAt(started);
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  assert.equal(when.getDate(), tomorrow.getDate());
  assert.equal(when.getHours(), 16);
  assert.equal(when.getMinutes(), 45);
});
