/**
 * WebGL Test Setup for Three.js Components
 * Provides headless WebGL context for testing 3D components
 */

import { vi } from 'vitest';

// Create a mock WebGL context for testing
function createMockWebGLContext(): Partial<WebGLRenderingContext> {
  return {
    canvas: document.createElement('canvas'),
    drawingBufferWidth: 1024,
    drawingBufferHeight: 768,
    viewport: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    depthFunc: vi.fn(),
    blendFunc: vi.fn(),
    cullFace: vi.fn(),
    frontFace: vi.fn(),
    useProgram: vi.fn(),
    createProgram: vi.fn().mockReturnValue({}),
    createShader: vi.fn().mockReturnValue({}),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getShaderParameter: vi.fn().mockReturnValue(true),
    getProgramParameter: vi.fn().mockReturnValue(true),
    getUniformLocation: vi.fn().mockReturnValue({}),
    getAttribLocation: vi.fn().mockReturnValue(0),
    uniformMatrix4fv: vi.fn(),
    uniform1f: vi.fn(),
    uniform1i: vi.fn(),
    uniform3fv: vi.fn(),
    createBuffer: vi.fn().mockReturnValue({}),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    createTexture: vi.fn().mockReturnValue({}),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    generateMipmap: vi.fn(),
    drawElements: vi.fn(),
    drawArrays: vi.fn(),
    deleteBuffer: vi.fn(),
    deleteTexture: vi.fn(),
    deleteProgram: vi.fn(),
    deleteShader: vi.fn(),
    getError: vi.fn().mockReturnValue(0),
    getExtension: vi.fn().mockReturnValue(null),
    getParameter: vi.fn((param) => {
      // Return appropriate values for common WebGL parameters
      switch (param) {
        case 0x8b4c: // MAX_VERTEX_ATTRIBS
          return 16;
        case 0x8dfb: // MAX_TEXTURE_SIZE
          return 4096;
        case 0x84e8: // MAX_TEXTURE_IMAGE_UNITS
          return 16;
        default:
          return null;
      }
    }),
    // WebGL constants
    TRIANGLES: 0x0004,
    UNSIGNED_SHORT: 0x1403,
    FLOAT: 0x1406,
    DEPTH_TEST: 0x0b71,
    BLEND: 0x0be2,
    CULL_FACE: 0x0b44,
    BACK: 0x0405,
    CCW: 0x0901,
    SRC_ALPHA: 0x0302,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    COLOR_BUFFER_BIT: 0x00004000,
    DEPTH_BUFFER_BIT: 0x00000100,
    ARRAY_BUFFER: 0x8892,
    ELEMENT_ARRAY_BUFFER: 0x8893,
    STATIC_DRAW: 0x88e4,
    TEXTURE_2D: 0x0de1,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_MIN_FILTER: 0x2801,
    LINEAR: 0x2601,
  } as Partial<WebGLRenderingContext>;
}

// Mock HTMLCanvasElement.getContext to return our mock WebGL context
const originalGetContext = HTMLCanvasElement.prototype.getContext;

HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation(function (
  this: HTMLCanvasElement,
  contextType: string,
  contextAttributes?: WebGLContextAttributes | CanvasRenderingContext2DSettings,
) {
  if (
    contextType === 'webgl' ||
    contextType === 'webgl2' ||
    contextType === 'experimental-webgl'
  ) {
    return createMockWebGLContext();
  }
  return (originalGetContext as Function).call(
    this,
    contextType,
    contextAttributes,
  );
});

// Define WebGL contexts for the test environment
(global as Record<string, unknown>)['WebGLRenderingContext'] =
  class MockWebGLRenderingContext {};
(global as Record<string, unknown>)['WebGL2RenderingContext'] =
  class MockWebGL2RenderingContext {};

// Ensure document.createElement('canvas') returns a properly mocked canvas
const originalCreateElement = document.createElement;
document.createElement = vi.fn().mockImplementation(function (
  this: Document,
  tagName: string,
) {
  if (tagName.toLowerCase() === 'canvas') {
    const canvas = originalCreateElement.call(
      this,
      tagName,
    ) as HTMLCanvasElement;
    canvas.width = 1024;
    canvas.height = 768;
    canvas.getContext = HTMLCanvasElement.prototype.getContext;
    return canvas;
  }
  return originalCreateElement.call(this, tagName);
});

// Mock requestAnimationFrame for Three.js animation loops
global.requestAnimationFrame = vi
  .fn()
  .mockImplementation((callback: FrameRequestCallback) => {
    return setTimeout(() => callback(Date.now()), 16); // ~60fps
  });

global.cancelAnimationFrame = vi.fn().mockImplementation((id: number) => {
  clearTimeout(id);
});

// Export for use in tests
export { createMockWebGLContext };
