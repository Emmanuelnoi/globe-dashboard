// Vitest test setup file
import 'zone.js';
import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { vi } from 'vitest';

// Initialize Angular TestBed only if not already initialized
try {
  const testBed = getTestBed();
  if (!testBed.platform) {
    testBed.initTestEnvironment(
      BrowserDynamicTestingModule,
      platformBrowserDynamicTesting(),
    );
  }
} catch (error) {
  // TestBed already initialized, ignore
  console.debug('TestBed already initialized');
}

// Mock Angular component resource resolution for Vitest
// This handles the issue with external templates and styles
Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  writable: true,
  value: vi.fn(() => ({
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON: vi.fn(),
  })),
});

// Remove complex Lucide mocking - use NO_ERRORS_SCHEMA instead

// Mock global objects that might be used in Angular/Three.js
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock WebGL context for Three.js
const mockWebGLContext = {
  canvas: document.createElement('canvas'),
  getExtension: vi.fn(),
  getParameter: vi.fn(),
  createShader: vi.fn(),
  shaderSource: vi.fn(),
  compileShader: vi.fn(),
  createProgram: vi.fn(),
  attachShader: vi.fn(),
  linkProgram: vi.fn(),
  useProgram: vi.fn(),
  getAttribLocation: vi.fn(),
  getUniformLocation: vi.fn(),
  enableVertexAttribArray: vi.fn(),
  vertexAttribPointer: vi.fn(),
  createBuffer: vi.fn(),
  bindBuffer: vi.fn(),
  bufferData: vi.fn(),
  clear: vi.fn(),
  clearColor: vi.fn(),
  clearDepth: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  depthFunc: vi.fn(),
  viewport: vi.fn(),
  drawElements: vi.fn(),
  drawArrays: vi.fn(),
  VERTEX_SHADER: 35633,
  FRAGMENT_SHADER: 35632,
  ARRAY_BUFFER: 34962,
  ELEMENT_ARRAY_BUFFER: 34963,
  STATIC_DRAW: 35044,
  COLOR_BUFFER_BIT: 16384,
  DEPTH_BUFFER_BIT: 256,
  DEPTH_TEST: 2929,
  LEQUAL: 515,
};

// Mock HTMLCanvasElement.getContext for WebGL
HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((type) => {
  if (type === 'webgl' || type === 'webgl2') {
    return mockWebGLContext;
  }
  return null;
});

// Mock window.devicePixelRatio
Object.defineProperty(window, 'devicePixelRatio', {
  writable: true,
  value: 1,
});

// Mock window.innerWidth and innerHeight
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  value: 1024,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  value: 768,
});

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn().mockImplementation((callback) => {
  return setTimeout(callback, 16);
});

global.cancelAnimationFrame = vi.fn().mockImplementation((id) => {
  clearTimeout(id);
});

// Suppress Three.js warnings in tests
const originalConsoleWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('THREE.') || args[0].includes('WebGL'))
  ) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

// Mock fetch for GeoJSON loading
global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    headers: new Headers({
      'content-type': 'application/json',
    }),
    json: () =>
      Promise.resolve({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { NAME: 'Test Country' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 1],
                  [0, 0],
                ],
              ],
            },
          },
        ],
      }),
  }),
);
