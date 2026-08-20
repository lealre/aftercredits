import { describe, expect, it } from 'vitest';
import { toDateInputValue } from './dates';

describe('toDateInputValue', () => {
  it('takes the calendar date out of an RFC 3339 timestamp', () => {
    expect(toDateInputValue('2026-01-21T00:00:00Z')).toBe('2026-01-21');
  });

  it('passes a bare date through unchanged', () => {
    expect(toDateInputValue('2026-01-21')).toBe('2026-01-21');
  });

  it('keeps the date the server sent regardless of the local timezone', () => {
    // Midnight UTC parsed through `Date` and read with local getters lands on
    // the previous day for anyone west of UTC. Truncation cannot drift, so this
    // holds whatever TZ the test host is in — which is the whole point.
    expect(toDateInputValue('2026-01-01T00:00:00Z')).toBe('2026-01-01');
    expect(toDateInputValue('2026-12-31T23:59:59Z')).toBe('2026-12-31');
  });

  it('handles a timestamp with an offset rather than Z', () => {
    expect(toDateInputValue('2026-03-05T00:00:00+00:00')).toBe('2026-03-05');
  });

  it('yields empty for nothing to show', () => {
    expect(toDateInputValue('')).toBe('');
    expect(toDateInputValue(undefined)).toBe('');
    expect(toDateInputValue(null)).toBe('');
  });

  it('yields empty rather than handing an input a value it would refuse', () => {
    expect(toDateInputValue('not a date')).toBe('');
    expect(toDateInputValue('21/01/2026')).toBe('');
    expect(toDateInputValue('2026-1-1')).toBe('');
  });
});
