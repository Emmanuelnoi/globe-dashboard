import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Scene,
  Mesh,
  SphereGeometry,
  MeshBasicMaterial,
  WebGLRenderer,
  Group,
  LineSegments,
  BufferGeometry,
  LineBasicMaterial,
} from 'three';
import { MemoryManagementService } from './memory-management.service';

describe('MemoryManagementService', () => {
  let service: MemoryManagementService;
  let mockRenderer: WebGLRenderer;
  let mockScene: Scene;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MemoryManagementService],
    });

    service = TestBed.inject(MemoryManagementService);

    // Create mock renderer
    mockRenderer = {
      getContext: vi.fn().mockReturnValue({
        getExtension: vi.fn().mockReturnValue({
          loseContext: vi.fn(),
        }),
      }),
      dispose: vi.fn(),
      info: {
        memory: { geometries: 5, textures: 3 },
        render: { calls: 10 },
      },
    } as unknown as WebGLRenderer;

    // Create mock scene
    mockScene = new Scene();
  });

  describe('Resource Tracking', () => {
    it('should track disposable resources', () => {
      const mockDisposable = { dispose: vi.fn() };

      const tracked = service.track(mockDisposable);

      expect(tracked).toBe(mockDisposable);

      const stats = service.getMemoryStats();
      expect(stats.trackedDisposables).toBe(1);
    });

    it('should track 3D objects', () => {
      const mesh = new Mesh();

      const tracked = service.track3DObject(mesh);

      expect(tracked).toBe(mesh);

      const stats = service.getMemoryStats();
      expect(stats.tracked3DObjects).toBe(1);
    });
  });

  describe('Material Disposal', () => {
    it('should dispose materials in a mesh', () => {
      const geometry = new SphereGeometry(1, 8, 8);
      const material = new MeshBasicMaterial();
      const mesh = new Mesh(geometry, material);

      const disposeSpy = vi.spyOn(material, 'dispose');

      service.disposeMaterials(mesh);

      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should dispose materials in array', () => {
      const geometry = new SphereGeometry(1, 8, 8);
      const materials = [new MeshBasicMaterial(), new MeshBasicMaterial()];
      const mesh = new Mesh(geometry, materials);

      const disposeSpy1 = vi.spyOn(materials[0], 'dispose');
      const disposeSpy2 = vi.spyOn(materials[1], 'dispose');

      service.disposeMaterials(mesh);

      expect(disposeSpy1).toHaveBeenCalled();
      expect(disposeSpy2).toHaveBeenCalled();
    });

    it('should handle nested groups', () => {
      const group = new Group();
      const childMesh = new Mesh(
        new SphereGeometry(1, 8, 8),
        new MeshBasicMaterial(),
      );
      group.add(childMesh);

      const disposeSpy = vi.spyOn(
        childMesh.material as MeshBasicMaterial,
        'dispose',
      );

      service.disposeMaterials(group);

      expect(disposeSpy).toHaveBeenCalled();
    });
  });

  describe('Geometry Disposal', () => {
    it('should dispose geometries in a mesh', () => {
      const geometry = new SphereGeometry(1, 8, 8);
      const material = new MeshBasicMaterial();
      const mesh = new Mesh(geometry, material);

      const disposeSpy = vi.spyOn(geometry, 'dispose');

      service.disposeGeometries(mesh);

      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should handle LineSegments', () => {
      const geometry = new BufferGeometry();
      const material = new LineBasicMaterial();
      const line = new LineSegments(geometry, material);

      const disposeSpy = vi.spyOn(geometry, 'dispose');

      service.disposeGeometries(line);

      expect(disposeSpy).toHaveBeenCalled();
    });
  });

  describe('Complete Object Disposal', () => {
    it('should dispose entire 3D object hierarchy', () => {
      const group = new Group();
      const childMesh = new Mesh(
        new SphereGeometry(1, 8, 8),
        new MeshBasicMaterial(),
      );
      group.add(childMesh);

      const geometryDisposeSpy = vi.spyOn(childMesh.geometry, 'dispose');
      const materialDisposeSpy = vi.spyOn(
        childMesh.material as MeshBasicMaterial,
        'dispose',
      );

      service.disposeObject3D(group);

      expect(geometryDisposeSpy).toHaveBeenCalled();
      expect(materialDisposeSpy).toHaveBeenCalled();
    });

    it('should remove object from parent', () => {
      const parent = new Group();
      const child = new Mesh();
      parent.add(child);

      service.disposeObject3D(child);

      expect(parent.children.includes(child)).toBe(false);
    });

    it('should handle objects without parents', () => {
      const mesh = new Mesh(
        new SphereGeometry(1, 8, 8),
        new MeshBasicMaterial(),
      );

      expect(() => service.disposeObject3D(mesh)).not.toThrow();
    });
  });

  describe('Renderer Disposal', () => {
    it('should dispose renderer and lose WebGL context', () => {
      service.disposeRenderer(mockRenderer);

      expect(mockRenderer.dispose).toHaveBeenCalled();
      expect(mockRenderer.getContext().getExtension).toHaveBeenCalledWith(
        'WEBGL_lose_context',
      );
    });

    it('should handle renderer without WebGL lose context extension', () => {
      const rendererWithoutExtension = {
        ...mockRenderer,
        getContext: vi.fn().mockReturnValue({
          getExtension: vi.fn().mockReturnValue(null),
        }),
      } as unknown as WebGLRenderer;

      expect(() =>
        service.disposeRenderer(rendererWithoutExtension),
      ).not.toThrow();
      expect(rendererWithoutExtension.dispose).toHaveBeenCalled();
    });
  });

  describe('Scene Disposal', () => {
    it('should dispose entire scene', () => {
      const mesh = new Mesh(
        new SphereGeometry(1, 8, 8),
        new MeshBasicMaterial(),
      );
      mockScene.add(mesh);

      const disposeSpy = vi.spyOn(service, 'disposeObject3D');
      const clearSpy = vi.spyOn(mockScene, 'clear');

      service.disposeScene(mockScene);

      expect(disposeSpy).toHaveBeenCalledWith(mesh);
      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('Memory Statistics', () => {
    it('should return memory statistics', () => {
      service.track({ dispose: vi.fn() });
      service.track3DObject(new Mesh());

      const stats = service.getMemoryStats();

      expect(stats.trackedDisposables).toBe(1);
      expect(stats.tracked3DObjects).toBe(1);
    });

    it('should include WebGL info when renderer provided', () => {
      const stats = service.getMemoryStats(mockRenderer);

      expect(stats.webglInfo).toEqual({
        geometries: 5,
        textures: 3,
        drawCalls: 10,
      });
    });

    it('should work without renderer', () => {
      const stats = service.getMemoryStats();

      expect(stats.webglInfo).toBeUndefined();
    });
  });

  describe('Complete Cleanup', () => {
    it('should dispose all tracked resources', () => {
      const disposable1 = { dispose: vi.fn() };
      const disposable2 = { dispose: vi.fn() };
      const object1 = new Mesh();
      const object2 = new Group();

      service.track(disposable1);
      service.track(disposable2);
      service.track3DObject(object1);
      service.track3DObject(object2);

      const disposeObjectSpy = vi.spyOn(service, 'disposeObject3D');

      service.disposeAll();

      expect(disposable1.dispose).toHaveBeenCalled();
      expect(disposable2.dispose).toHaveBeenCalled();
      expect(disposeObjectSpy).toHaveBeenCalledWith(object1);
      expect(disposeObjectSpy).toHaveBeenCalledWith(object2);

      const stats = service.getMemoryStats();
      expect(stats.trackedDisposables).toBe(0);
      expect(stats.tracked3DObjects).toBe(0);
    });

    it('should handle disposal errors gracefully', () => {
      const faultyDisposable = {
        dispose: vi.fn().mockImplementation(() => {
          throw new Error('Disposal failed');
        }),
      };

      service.track(faultyDisposable);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => service.disposeAll()).not.toThrow();
      // Logger formats the output with timestamp, so just check it was called
      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0];
      expect(callArgs.join(' ')).toContain('Error disposing resource');
      expect(callArgs.join(' ')).toContain('Disposal failed');

      consoleSpy.mockRestore();
    });
  });

  describe('Force Garbage Collection', () => {
    it('should call global gc if available', () => {
      const mockGc = vi.fn();
      (globalThis as { window?: { gc?: () => void } }).window = { gc: mockGc };

      service.forceGarbageCollection();

      expect(mockGc).toHaveBeenCalled();

      delete (globalThis as { window?: unknown }).window;
    });

    it('should not throw if gc is not available', () => {
      expect(() => service.forceGarbageCollection()).not.toThrow();
    });
  });
});
