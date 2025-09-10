import { describe, it, expect, beforeEach } from 'vitest';
import {
  isArrowKey,
  isNavigationKey,
  isActionKey,
  getKeyboardDirection,
  type KeyboardDirection,
} from './keyboard.utils';

describe('Keyboard Utils', () => {
  describe('isArrowKey', () => {
    it('should identify arrow keys correctly', () => {
      expect(isArrowKey('ArrowUp')).toBe(true);
      expect(isArrowKey('ArrowDown')).toBe(true);
      expect(isArrowKey('ArrowLeft')).toBe(true);
      expect(isArrowKey('ArrowRight')).toBe(true);
    });

    it('should reject non-arrow keys', () => {
      expect(isArrowKey('Enter')).toBe(false);
      expect(isArrowKey('Space')).toBe(false);
      expect(isArrowKey('Escape')).toBe(false);
      expect(isArrowKey('a')).toBe(false);
      expect(isArrowKey('Tab')).toBe(false);
      expect(isArrowKey('')).toBe(false);
    });

    it('should handle case sensitivity', () => {
      expect(isArrowKey('arrowup')).toBe(false);
      expect(isArrowKey('ARROWUP')).toBe(false);
      expect(isArrowKey('ArrowUP')).toBe(false);
    });
  });

  describe('isNavigationKey', () => {
    it('should identify navigation keys correctly', () => {
      expect(isNavigationKey('Home')).toBe(true);
      expect(isNavigationKey('End')).toBe(true);
      expect(isNavigationKey('PageUp')).toBe(true);
      expect(isNavigationKey('PageDown')).toBe(true);
      expect(isNavigationKey('ArrowUp')).toBe(true);
      expect(isNavigationKey('ArrowDown')).toBe(true);
      expect(isNavigationKey('ArrowLeft')).toBe(true);
      expect(isNavigationKey('ArrowRight')).toBe(true);
    });

    it('should reject non-navigation keys', () => {
      expect(isNavigationKey('Enter')).toBe(false);
      expect(isNavigationKey('Space')).toBe(false);
      expect(isNavigationKey('Escape')).toBe(false);
      expect(isNavigationKey('a')).toBe(false);
      expect(isNavigationKey('Tab')).toBe(false);
    });
  });

  describe('isActionKey', () => {
    it('should identify action keys correctly', () => {
      expect(isActionKey('Enter')).toBe(true);
      expect(isActionKey(' ')).toBe(true); // Space character
      expect(isActionKey('Space')).toBe(true); // Space key name
    });

    it('should reject non-action keys', () => {
      expect(isActionKey('ArrowUp')).toBe(false);
      expect(isActionKey('Home')).toBe(false);
      expect(isActionKey('Escape')).toBe(false);
      expect(isActionKey('a')).toBe(false);
      expect(isActionKey('Tab')).toBe(false);
      expect(isActionKey('')).toBe(false);
    });
  });

  describe('getKeyboardDirection', () => {
    it('should return correct directions for arrow keys', () => {
      expect(getKeyboardDirection('ArrowUp')).toBe('up');
      expect(getKeyboardDirection('ArrowDown')).toBe('down');
      expect(getKeyboardDirection('ArrowLeft')).toBe('left');
      expect(getKeyboardDirection('ArrowRight')).toBe('right');
    });

    it('should return correct directions for navigation keys', () => {
      expect(getKeyboardDirection('Home')).toBe('home');
      expect(getKeyboardDirection('End')).toBe('end');
      expect(getKeyboardDirection('PageUp')).toBe('pageUp');
      expect(getKeyboardDirection('PageDown')).toBe('pageDown');
    });

    it('should return null for non-navigation keys', () => {
      expect(getKeyboardDirection('Enter')).toBe(null);
      expect(getKeyboardDirection('Space')).toBe(null);
      expect(getKeyboardDirection('Escape')).toBe(null);
      expect(getKeyboardDirection('a')).toBe(null);
      expect(getKeyboardDirection('Tab')).toBe(null);
      expect(getKeyboardDirection('')).toBe(null);
    });

    it('should handle edge cases', () => {
      expect(getKeyboardDirection(undefined as unknown as string)).toBe(null);
      expect(getKeyboardDirection(null as unknown as string)).toBe(null);
      expect(getKeyboardDirection(123 as unknown as string)).toBe(null);
    });

    it('should return proper KeyboardDirection type', () => {
      const direction: KeyboardDirection | null =
        getKeyboardDirection('ArrowUp');
      expect(direction).toBe('up');

      const validDirections: KeyboardDirection[] = [
        'up',
        'down',
        'left',
        'right',
        'home',
        'end',
        'pageUp',
        'pageDown',
      ];

      for (const key of [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Home',
        'End',
        'PageUp',
        'PageDown',
      ]) {
        const result = getKeyboardDirection(key);
        expect(validDirections.includes(result as KeyboardDirection)).toBe(
          true,
        );
      }
    });
  });

  describe('Integration tests', () => {
    it('should work together for keyboard event handling', () => {
      const testKey = 'ArrowUp';

      expect(isArrowKey(testKey)).toBe(true);
      expect(isNavigationKey(testKey)).toBe(true);
      expect(isActionKey(testKey)).toBe(false);
      expect(getKeyboardDirection(testKey)).toBe('up');
    });

    it('should handle Space key consistently', () => {
      expect(isActionKey(' ')).toBe(true);
      expect(isActionKey('Space')).toBe(true);
      expect(isNavigationKey(' ')).toBe(false);
      expect(isNavigationKey('Space')).toBe(false);
      expect(getKeyboardDirection(' ')).toBe(null);
      expect(getKeyboardDirection('Space')).toBe(null);
    });

    it('should provide comprehensive key categorization', () => {
      const testKeys = [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Home',
        'End',
        'PageUp',
        'PageDown',
        'Enter',
        ' ',
        'Space',
        'Escape',
        'Tab',
        'a',
        'A',
        '1',
      ];

      testKeys.forEach((key) => {
        const isArrow = isArrowKey(key);
        const isNav = isNavigationKey(key);
        const isAction = isActionKey(key);
        const direction = getKeyboardDirection(key);

        // Each key should have at most one category
        const categories = [isArrow, isNav, isAction].filter(Boolean).length;
        expect(categories).toBeLessThanOrEqual(1);

        // Direction should match navigation status
        if (direction) {
          expect(isNav).toBe(true);
        }
      });
    });
  });
});
