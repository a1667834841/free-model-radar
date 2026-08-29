import { describe, expect, it } from 'vitest';
import {
  COUNT_UP_DURATION_MS,
  easeOutCubic,
  formatCount,
  countUpValueAt,
} from '../src/lib/count-up';

describe('formatCount', () => {
  it('rounds and renders without padding by default', () => {
    expect(formatCount(1013.4)).toBe('1013');
    expect(formatCount(1013.6)).toBe('1014');
  });

  it('zero-pads to requested width', () => {
    expect(formatCount(7, 3)).toBe('007');
    expect(formatCount(735, 3)).toBe('735');
  });
});

describe('easeOutCubic', () => {
  it('maps endpoints', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('cubic ease-out at midpoint', () => {
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875);
  });
});

describe('countUpValueAt', () => {
  it('starts at 0', () => {
    expect(countUpValueAt(1013, 0)).toBe(0);
  });

  it('reaches target at or after duration', () => {
    expect(countUpValueAt(1013, COUNT_UP_DURATION_MS)).toBe(1013);
    expect(countUpValueAt(1013, COUNT_UP_DURATION_MS + 500)).toBe(1013);
  });

  it('is eased in between (ahead of linear)', () => {
    const mid = countUpValueAt(1000, COUNT_UP_DURATION_MS / 2);
    expect(mid).toBeGreaterThan(500);
    expect(mid).toBeLessThanOrEqual(1000);
  });
});
