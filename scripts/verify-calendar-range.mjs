import assert from 'node:assert/strict';
import { calendarRange, weekStart } from '../anime-dashboard/calendar-range.js';
for (const [day, expected] of [['2026-10-15', '2026-10-11'], ['2026-10-11', '2026-10-11'], ['2026-10-17', '2026-10-11'], ['2026-01-01', '2025-12-28'], ['2026-03-08', '2026-03-08'], ['2026-11-01', '2026-11-01']]) {
  assert.equal(weekStart(day), expected);
  const [from, to] = calendarRange(day, 'week');
  assert.equal(from, expected);
  assert.equal(new Date(from + 'T12:00:00').getDay(), 0);
  assert.equal(new Date(to + 'T12:00:00').getDay(), 0);
}
assert.deepEqual(calendarRange('2026-10-15', 'week'), ['2026-10-11', '2026-10-18']);
assert.deepEqual(calendarRange('2026-10-15', 'month'), ['2026-09-27', '2026-11-08']);
assert.deepEqual(calendarRange('2026-10-15', 'day'), ['2026-10-15', '2026-10-16']);
console.log('PASS: Sunday-first calendar ranges, month/year boundaries, DST weeks and exclusive end dates');
