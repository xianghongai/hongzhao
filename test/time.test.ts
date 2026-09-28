import { describe, expect, it } from 'vitest';

import { formatDateTime, formatUtcOffset } from '@/lib/time';

describe('formatUtcOffset', () => {
  it('formats whole-hour, half-hour and zero offsets', () => {
    expect(formatUtcOffset(-480)).toBe('UTC+8');
    expect(formatUtcOffset(300)).toBe('UTC-5');
    expect(formatUtcOffset(-330)).toBe('UTC+5:30');
    expect(formatUtcOffset(210)).toBe('UTC-3:30');
    expect(formatUtcOffset(-345)).toBe('UTC+5:45');
    expect(formatUtcOffset(0)).toBe('UTC±0');
  });
});

describe('formatDateTime', () => {
  it('pads every field in local time', () => {
    expect(formatDateTime(new Date(2026, 0, 2, 3, 4, 5))).toBe('2026-01-02 03:04:05');
    expect(formatDateTime(new Date(2026, 11, 31, 23, 59, 59))).toBe('2026-12-31 23:59:59');
  });
});
