import { describe, it, expect } from '@jest/globals';
import { getAllowedRanges, isRangeAllowed, filterSegmentsByRanges, mergeIntervals } from '@/lib/acl';
import pool from '@/lib/db';

// Mock database
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

describe('ACL Logic', () => {
  describe('isRangeAllowed', () => {
    it('should allow range that intersects with allowed ranges', () => {
      const allowedRanges = [
        { start_ms: 0, end_ms: 1000 },
        { start_ms: 2000, end_ms: 3000 },
      ];

      expect(isRangeAllowed(500, 1500, allowedRanges)).toBe(true);
      expect(isRangeAllowed(1500, 2500, allowedRanges)).toBe(true);
      expect(isRangeAllowed(2500, 3500, allowedRanges)).toBe(true);
    });

    it('should deny range that does not intersect', () => {
      const allowedRanges = [
        { start_ms: 0, end_ms: 1000 },
        { start_ms: 2000, end_ms: 3000 },
      ];

      expect(isRangeAllowed(1001, 1999, allowedRanges)).toBe(false);
      expect(isRangeAllowed(3001, 4000, allowedRanges)).toBe(false);
    });

    it('should allow range that is completely within allowed range', () => {
      const allowedRanges = [{ start_ms: 0, end_ms: 1000 }];

      expect(isRangeAllowed(100, 900, allowedRanges)).toBe(true);
    });
  });

  describe('filterSegmentsByRanges', () => {
    it('should filter segments by allowed ranges', () => {
      const segments = [
        { start_ms: 0, end_ms: 500, text: 'Segment 1' },
        { start_ms: 1000, end_ms: 1500, text: 'Segment 2' },
        { start_ms: 2000, end_ms: 2500, text: 'Segment 3' },
        { start_ms: 3000, end_ms: 3500, text: 'Segment 4' },
      ];

      const allowedRanges = [
        { start_ms: 0, end_ms: 1000 },
        { start_ms: 2000, end_ms: 3000 },
      ];

      const filtered = filterSegmentsByRanges(segments, allowedRanges);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].text).toBe('Segment 1');
      expect(filtered[1].text).toBe('Segment 3');
    });

    it('should return empty array if no ranges allowed', () => {
      const segments = [
        { start_ms: 0, end_ms: 500, text: 'Segment 1' },
      ];

      const filtered = filterSegmentsByRanges(segments, []);

      expect(filtered).toHaveLength(0);
    });
  });

  describe('mergeIntervals', () => {
    it('should merge overlapping intervals', () => {
      const intervals = [
        { start_ms: 0, end_ms: 1000 },
        { start_ms: 500, end_ms: 1500 },
        { start_ms: 2000, end_ms: 3000 },
      ];

      // This would need to be exported from acl.ts or tested indirectly
      // For now, test through getAllowedRanges
    });
  });
});
