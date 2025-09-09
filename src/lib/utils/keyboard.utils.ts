export type NavKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End' | 'Enter' | ' ';

export function isNavKey(key: string): key is NavKey {
  return ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(key);
}

/**
 * Compute next index given current, delta or special keys (wraps around)
 */
export function nextIndex(
  current: number,
  key: string,
  length: number,
): number {
  if (length <= 0) return -1;
  switch (key) {
    case 'ArrowDown':
      return current + 1 > length - 1 ? 0 : current + 1;
    case 'ArrowUp':
      return current - 1 < 0 ? length - 1 : current - 1;
    case 'Home':
      return 0;
    case 'End':
      return length - 1;
    default:
      return current;
  }
}
