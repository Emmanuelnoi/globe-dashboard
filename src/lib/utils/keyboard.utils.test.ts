import { describe, it, expect } from 'vitest';
import { isNavKey, nextIndex, type NavKey } from './keyboard.utils';

describe('Keyboard Utils', () => {
  describe('isNavKey', () => {
    it('should identify navigation keys correctly', () => {
      expect(isNavKey('ArrowUp')).toBe(true);
      expect(isNavKey('ArrowDown')).toBe(true);
      expect(isNavKey('Home')).toBe(true);
      expect(isNavKey('End')).toBe(true);
      expect(isNavKey('Enter')).toBe(true);
      expect(isNavKey(' ')).toBe(true); // Space key
    });

    it('should reject non-navigation keys', () => {
      expect(isNavKey('Escape')).toBe(false);
      expect(isNavKey('Tab')).toBe(false);
      expect(isNavKey('a')).toBe(false);
      expect(isNavKey('1')).toBe(false);
      expect(isNavKey('ArrowLeft')).toBe(false); // Not in the NavKey type
      expect(isNavKey('ArrowRight')).toBe(false); // Not in the NavKey type
    });

    it('should handle edge cases', () => {
      expect(isNavKey('')).toBe(false);
      expect(isNavKey('  ')).toBe(false); // Multiple spaces
      expect(isNavKey('enter')).toBe(false); // Case sensitive
    });
  });

  describe('nextIndex', () => {
    it('should handle ArrowDown navigation', () => {
      expect(nextIndex(0, 'ArrowDown', 5)).toBe(1);
      expect(nextIndex(3, 'ArrowDown', 5)).toBe(4);
      expect(nextIndex(4, 'ArrowDown', 5)).toBe(0); // Wrap around
    });

    it('should handle ArrowUp navigation', () => {
      expect(nextIndex(1, 'ArrowUp', 5)).toBe(0);
      expect(nextIndex(4, 'ArrowUp', 5)).toBe(3);
      expect(nextIndex(0, 'ArrowUp', 5)).toBe(4); // Wrap around
    });

    it('should handle Home navigation', () => {
      expect(nextIndex(0, 'Home', 5)).toBe(0);
      expect(nextIndex(3, 'Home', 5)).toBe(0);
      expect(nextIndex(4, 'Home', 5)).toBe(0);
    });

    it('should handle End navigation', () => {
      expect(nextIndex(0, 'End', 5)).toBe(4);
      expect(nextIndex(2, 'End', 5)).toBe(4);
      expect(nextIndex(4, 'End', 5)).toBe(4);
    });

    it('should return current index for non-navigation keys', () => {
      expect(nextIndex(2, 'Enter', 5)).toBe(2);
      expect(nextIndex(2, ' ', 5)).toBe(2); // Space
      expect(nextIndex(2, 'Tab', 5)).toBe(2);
      expect(nextIndex(2, 'a', 5)).toBe(2);
    });

    it('should handle edge cases with length', () => {
      expect(nextIndex(0, 'ArrowDown', 0)).toBe(-1); // Empty list
      expect(nextIndex(0, 'ArrowDown', -1)).toBe(-1); // Invalid length
      expect(nextIndex(0, 'ArrowDown', 1)).toBe(0); // Single item wraps to itself
    });

    it('should handle single item list', () => {
      expect(nextIndex(0, 'ArrowDown', 1)).toBe(0);
      expect(nextIndex(0, 'ArrowUp', 1)).toBe(0);
      expect(nextIndex(0, 'Home', 1)).toBe(0);
      expect(nextIndex(0, 'End', 1)).toBe(0);
    });

    it('should work with different list sizes', () => {
      // 2-item list
      expect(nextIndex(0, 'ArrowDown', 2)).toBe(1);
      expect(nextIndex(1, 'ArrowDown', 2)).toBe(0);
      expect(nextIndex(1, 'ArrowUp', 2)).toBe(0);
      expect(nextIndex(0, 'ArrowUp', 2)).toBe(1);

      // 10-item list
      expect(nextIndex(8, 'ArrowDown', 10)).toBe(9);
      expect(nextIndex(9, 'ArrowDown', 10)).toBe(0);
      expect(nextIndex(0, 'ArrowUp', 10)).toBe(9);
      expect(nextIndex(9, 'End', 10)).toBe(9);
    });
  });

  describe('Integration tests', () => {
    it('should work together for navigation scenarios', () => {
      const keys: string[] = ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter'];

      keys.forEach((key) => {
        expect(isNavKey(key)).toBe(true);
      });

      // Simulate navigation in a 3-item list
      let currentIndex = 0;
      currentIndex = nextIndex(currentIndex, 'ArrowDown', 3); // 0 -> 1
      expect(currentIndex).toBe(1);

      currentIndex = nextIndex(currentIndex, 'ArrowDown', 3); // 1 -> 2
      expect(currentIndex).toBe(2);

      currentIndex = nextIndex(currentIndex, 'ArrowDown', 3); // 2 -> 0 (wrap)
      expect(currentIndex).toBe(0);

      currentIndex = nextIndex(currentIndex, 'End', 3); // 0 -> 2 (end)
      expect(currentIndex).toBe(2);

      currentIndex = nextIndex(currentIndex, 'Home', 3); // 2 -> 0 (home)
      expect(currentIndex).toBe(0);
    });
  });
});
