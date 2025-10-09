/**
 * Easing Functions Utility
 * Collection of easing functions for smooth animations
 *
 * @module easing.util
 * @description Mathematical easing functions for camera animations and transitions
 * @see https://easings.net/
 */

import { EasingFunction } from '../models/tour.types';

/**
 * Easing function type (takes t from 0-1, returns eased value 0-1)
 */
export type EasingFn = (t: number) => number;

/**
 * Clamps a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear easing (no easing)
 */
export function linear(t: number): number {
  return clamp(t, 0, 1);
}

/**
 * Quadratic ease-in
 */
export function easeInQuad(t: number): number {
  t = clamp(t, 0, 1);
  return t * t;
}

/**
 * Quadratic ease-out
 */
export function easeOutQuad(t: number): number {
  t = clamp(t, 0, 1);
  return t * (2 - t);
}

/**
 * Quadratic ease-in-out
 */
export function easeInOutQuad(t: number): number {
  t = clamp(t, 0, 1);
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/**
 * Cubic ease-in
 */
export function easeInCubic(t: number): number {
  t = clamp(t, 0, 1);
  return t * t * t;
}

/**
 * Cubic ease-out
 */
export function easeOutCubic(t: number): number {
  t = clamp(t, 0, 1);
  const t1 = t - 1;
  return t1 * t1 * t1 + 1;
}

/**
 * Cubic ease-in-out
 */
export function easeInOutCubic(t: number): number {
  t = clamp(t, 0, 1);
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

/**
 * Quartic ease-in
 */
export function easeInQuart(t: number): number {
  t = clamp(t, 0, 1);
  return t * t * t * t;
}

/**
 * Quartic ease-out
 */
export function easeOutQuart(t: number): number {
  t = clamp(t, 0, 1);
  const t1 = t - 1;
  return 1 - t1 * t1 * t1 * t1;
}

/**
 * Quartic ease-in-out
 */
export function easeInOutQuart(t: number): number {
  t = clamp(t, 0, 1);
  return t < 0.5
    ? 8 * t * t * t * t
    : 1 - 8 * (t - 1) * (t - 1) * (t - 1) * (t - 1);
}

/**
 * Quintic ease-in
 */
export function easeInQuint(t: number): number {
  t = clamp(t, 0, 1);
  return t * t * t * t * t;
}

/**
 * Quintic ease-out
 */
export function easeOutQuint(t: number): number {
  t = clamp(t, 0, 1);
  const t1 = t - 1;
  return 1 + t1 * t1 * t1 * t1 * t1;
}

/**
 * Quintic ease-in-out
 */
export function easeInOutQuint(t: number): number {
  t = clamp(t, 0, 1);
  return t < 0.5
    ? 16 * t * t * t * t * t
    : 1 + 16 * (t - 1) * (t - 1) * (t - 1) * (t - 1) * (t - 1);
}

/**
 * Sinusoidal ease-in
 */
export function easeInSine(t: number): number {
  t = clamp(t, 0, 1);
  return 1 - Math.cos((t * Math.PI) / 2);
}

/**
 * Sinusoidal ease-out
 */
export function easeOutSine(t: number): number {
  t = clamp(t, 0, 1);
  return Math.sin((t * Math.PI) / 2);
}

/**
 * Sinusoidal ease-in-out
 */
export function easeInOutSine(t: number): number {
  t = clamp(t, 0, 1);
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/**
 * Exponential ease-in
 */
export function easeInExpo(t: number): number {
  t = clamp(t, 0, 1);
  return t === 0 ? 0 : Math.pow(2, 10 * (t - 1));
}

/**
 * Exponential ease-out
 */
export function easeOutExpo(t: number): number {
  t = clamp(t, 0, 1);
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Exponential ease-in-out
 */
export function easeInOutExpo(t: number): number {
  t = clamp(t, 0, 1);
  if (t === 0 || t === 1) return t;

  return t < 0.5
    ? Math.pow(2, 20 * t - 10) / 2
    : (2 - Math.pow(2, -20 * t + 10)) / 2;
}

/**
 * Circular ease-in
 */
export function easeInCirc(t: number): number {
  t = clamp(t, 0, 1);
  return 1 - Math.sqrt(1 - t * t);
}

/**
 * Circular ease-out
 */
export function easeOutCirc(t: number): number {
  t = clamp(t, 0, 1);
  const t1 = t - 1;
  return Math.sqrt(1 - t1 * t1);
}

/**
 * Circular ease-in-out
 */
export function easeInOutCirc(t: number): number {
  t = clamp(t, 0, 1);
  return t < 0.5
    ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
    : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;
}

/**
 * Elastic ease-in (bouncy)
 */
export function easeInElastic(t: number): number {
  t = clamp(t, 0, 1);
  if (t === 0 || t === 1) return t;

  const c4 = (2 * Math.PI) / 3;
  return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
}

/**
 * Elastic ease-out (bouncy)
 */
export function easeOutElastic(t: number): number {
  t = clamp(t, 0, 1);
  if (t === 0 || t === 1) return t;

  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

/**
 * Back ease-in (overshoots then returns)
 */
export function easeInBack(t: number): number {
  t = clamp(t, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return c3 * t * t * t - c1 * t * t;
}

/**
 * Back ease-out (overshoots then settles)
 */
export function easeOutBack(t: number): number {
  t = clamp(t, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * Bounce ease-out (bouncy landing)
 */
export function easeOutBounce(t: number): number {
  t = clamp(t, 0, 1);
  const n1 = 7.5625;
  const d1 = 2.75;

  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    return n1 * (t -= 1.5 / d1) * t + 0.75;
  } else if (t < 2.5 / d1) {
    return n1 * (t -= 2.25 / d1) * t + 0.9375;
  } else {
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
}

/**
 * Cubic Bezier curve evaluation (for custom easing)
 * @param t - Progress (0-1)
 * @param p0 - Control point 0
 * @param p1 - Control point 1
 * @param p2 - Control point 2
 * @param p3 - Control point 3
 */
export function cubicBezier(
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number,
): number {
  t = clamp(t, 0, 1);
  const u = 1 - t;
  return (
    u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
  );
}

/**
 * Creates a cubic bezier easing function
 * @param x1 - First control point X (0-1)
 * @param y1 - First control point Y (0-1)
 * @param x2 - Second control point X (0-1)
 * @param y2 - Second control point Y (0-1)
 */
export function createCubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): EasingFn {
  return (t: number) => {
    // Binary search to find t value that gives desired x
    let start = 0;
    let end = 1;
    let mid = 0.5;

    for (let i = 0; i < 20; i++) {
      const x = cubicBezier(mid, 0, x1, x2, 1);
      if (Math.abs(x - t) < 0.001) break;

      if (x < t) {
        start = mid;
      } else {
        end = mid;
      }
      mid = (start + end) / 2;
    }

    return cubicBezier(mid, 0, y1, y2, 1);
  };
}

/**
 * Gets easing function by name
 */
export function getEasingFunction(easing: EasingFunction): EasingFn {
  switch (easing) {
    case 'linear':
      return linear;
    case 'easeInQuad':
      return easeInQuad;
    case 'easeOutQuad':
      return easeOutQuad;
    case 'easeInOutQuad':
      return easeInOutQuad;
    case 'easeInCubic':
      return easeInCubic;
    case 'easeOutCubic':
      return easeOutCubic;
    case 'easeInOutCubic':
      return easeInOutCubic;
    case 'easeInQuart':
      return easeInQuart;
    case 'easeOutQuart':
      return easeOutQuart;
    case 'easeInOutQuart':
      return easeInOutQuart;
    case 'easeInQuint':
      return easeInQuint;
    case 'easeOutQuint':
      return easeOutQuint;
    case 'easeInOutQuint':
      return easeInOutQuint;
    case 'easeInSine':
      return easeInSine;
    case 'easeOutSine':
      return easeOutSine;
    case 'easeInOutSine':
      return easeInOutSine;
    case 'easeInExpo':
      return easeInExpo;
    case 'easeOutExpo':
      return easeOutExpo;
    case 'easeInOutExpo':
      return easeInOutExpo;
    case 'easeInCirc':
      return easeInCirc;
    case 'easeOutCirc':
      return easeOutCirc;
    case 'easeInOutCirc':
      return easeInOutCirc;
    case 'custom':
    default:
      return linear;
  }
}

/**
 * Interpolates between two values using easing
 */
export function interpolate(
  start: number,
  end: number,
  t: number,
  easing: EasingFunction = 'linear',
): number {
  const easingFn = getEasingFunction(easing);
  const easedT = easingFn(t);
  return start + (end - start) * easedT;
}

/**
 * Smoothstep interpolation (smooth S-curve)
 */
export function smoothstep(t: number): number {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Smootherstep interpolation (smoother S-curve)
 */
export function smootherstep(t: number): number {
  t = clamp(t, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Spring-like interpolation
 * @param t - Progress (0-1)
 * @param tension - Spring tension (higher = more bouncy)
 * @param friction - Spring friction (higher = less bouncy)
 */
export function spring(t: number, tension = 0.8, friction = 0.2): number {
  t = clamp(t, 0, 1);
  const omega = tension;
  const zeta = friction;
  const beta = Math.sqrt(1 - zeta * zeta);

  return 1 - Math.exp(-t * omega * zeta) * Math.cos(omega * beta * t);
}
