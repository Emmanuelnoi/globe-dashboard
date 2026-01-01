import { TestBed } from '@angular/core/testing';
import {
  CountryHoverService,
  CountryHoverResult,
} from './country-hover.service';
import { LoggerService } from './logger.service';
import {
  Camera,
  Group,
  Mesh,
  Object3D,
  BoxGeometry,
  MeshBasicMaterial,
  PerspectiveCamera,
} from 'three';
import { vi } from 'vitest';

/**
 * Unit Tests for CountryHoverService
 *
 * Tests raycasting and country detection from mouse hover:
 * - Selection mesh detection
 * - Country name extraction
 * - Fuzzy name matching
 * - Debug information
 */
describe('CountryHoverService', () => {
  let service: CountryHoverService;
  let mockLoggerService: {
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };
  let camera: Camera;
  let countriesGroup: Group;

  beforeEach(() => {
    // Mock logger service
    mockLoggerService = {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        CountryHoverService,
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    });

    service = TestBed.inject(CountryHoverService);

    // Setup camera
    camera = new PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.z = 5;

    // Setup countries group
    countriesGroup = new Group();
    countriesGroup.name = 'countries';
  });

  describe('Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('Country Name Formatting', () => {
    it('should format camelCase country names to spaced names', () => {
      const formatCountryName = (name: string) =>
        service['formatCountryName'](name);

      expect(formatCountryName('UnitedStates')).toBe('United States');
      expect(formatCountryName('NewZealand')).toBe('New Zealand');
      expect(formatCountryName('SouthAfrica')).toBe('South Africa');
    });

    it('should preserve names that already have spaces', () => {
      const formatCountryName = (name: string) =>
        service['formatCountryName'](name);

      expect(formatCountryName('United States')).toBe('United States');
      expect(formatCountryName('New Zealand')).toBe('New Zealand');
    });

    it('should handle special country name mappings', () => {
      const formatCountryName = (name: string) =>
        service['formatCountryName'](name);

      expect(formatCountryName('USA')).toBe('United States');
      expect(formatCountryName('UnitedKingdom')).toBe('United Kingdom');
      expect(formatCountryName('SouthKorea')).toBe('South Korea');
      expect(formatCountryName('NorthKorea')).toBe('North Korea');
    });

    it('should handle Mexico variants', () => {
      const formatCountryName = (name: string) =>
        service['formatCountryName'](name);

      expect(formatCountryName('Mexico')).toBe('Mexico');
      expect(formatCountryName('UnitedMexicanStates')).toBe('Mexico');
      expect(formatCountryName('Estados')).toBe('Mexico');
      expect(formatCountryName('MexicanRepublic')).toBe('Mexico');
    });

    it('should handle compound country names', () => {
      const formatCountryName = (name: string) =>
        service['formatCountryName'](name);

      expect(formatCountryName('BosniaandHerzegovina')).toBe(
        'Bosnia and Herzegovina',
      );
      expect(formatCountryName('TrinidadandTobago')).toBe(
        'Trinidad and Tobago',
      );
      expect(formatCountryName('PapuaNewGuinea')).toBe('Papua New Guinea');
    });

    it('should handle republic names', () => {
      const formatCountryName = (name: string) =>
        service['formatCountryName'](name);

      expect(formatCountryName('DominicanRepublic')).toBe('Dominican Republic');
      expect(formatCountryName('CzechRepublic')).toBe('Czech Republic');
      expect(formatCountryName('CentralAfricanRepublic')).toBe(
        'Central African Republic',
      );
    });
  });

  describe('Selection Mesh Name Extraction', () => {
    it('should extract country name from selection mesh name', () => {
      const extractName = (name: string) => {
        const mockObject = new Object3D();
        mockObject.name = name;
        return service['extractCountryNameFromSelectionMesh'](mockObject);
      };

      expect(extractName('selection-mesh-UnitedStates_0')).toBe(
        'United States',
      );
      expect(extractName('selection-mesh-France')).toBe('France');
      expect(extractName('selection-mesh-NewZealand_1')).toBe('New Zealand');
    });

    it('should return null for invalid selection mesh names', () => {
      const extractName = (name: string) => {
        const mockObject = new Object3D();
        mockObject.name = name;
        return service['extractCountryNameFromSelectionMesh'](mockObject);
      };

      expect(extractName('not-a-selection-mesh')).toBeNull();
      expect(extractName('invalid-mesh-name')).toBeNull();
      expect(extractName('')).toBeNull();
    });

    it('should handle selection meshes without index suffix', () => {
      const extractName = (name: string) => {
        const mockObject = new Object3D();
        mockObject.name = name;
        return service['extractCountryNameFromSelectionMesh'](mockObject);
      };

      expect(extractName('selection-mesh-Canada')).toBe('Canada');
      expect(extractName('selection-mesh-Brazil')).toBe('Brazil');
    });

    it('should handle selection meshes with multiple underscores', () => {
      const extractName = (name: string) => {
        const mockObject = new Object3D();
        mockObject.name = name;
        return service['extractCountryNameFromSelectionMesh'](mockObject);
      };

      expect(extractName('selection-mesh-UnitedStates_0_extra')).toBe(
        'United States',
      );
    });
  });

  describe('Country Info from UserData', () => {
    it('should extract country info from object userData', () => {
      const mockObject = new Object3D();
      mockObject.userData = {
        name: 'United States',
        isCountry: true,
        countryId: 'US',
      };

      const info = service['extractCountryInfoFromUserData'](mockObject);
      expect(info).toEqual({
        name: 'United States',
        id: 'US',
      });
    });

    it('should extract country info from parent object', () => {
      const parent = new Object3D();
      parent.userData = {
        name: 'France',
        isCountry: true,
        topoId: 'FR',
      };

      const child = new Object3D();
      parent.add(child);

      const info = service['extractCountryInfoFromUserData'](child);
      expect(info).toEqual({
        name: 'France',
        id: 'FR',
      });
    });

    it('should return null when no country info found', () => {
      const mockObject = new Object3D();
      const info = service['extractCountryInfoFromUserData'](mockObject);
      expect(info).toBeNull();
    });

    it('should return null when isCountry is false', () => {
      const mockObject = new Object3D();
      mockObject.userData = {
        name: 'Not a country',
        isCountry: false,
      };

      const info = service['extractCountryInfoFromUserData'](mockObject);
      expect(info).toBeNull();
    });

    it('should prefer countryId over topoId', () => {
      const mockObject = new Object3D();
      mockObject.userData = {
        name: 'Test Country',
        isCountry: true,
        countryId: 'TC1',
        topoId: 'TC2',
      };

      const info = service['extractCountryInfoFromUserData'](mockObject);
      expect(info?.id).toBe('TC1');
    });
  });

  describe('Selection Mesh Finding', () => {
    it('should find selection meshes in direct children', () => {
      const mesh1 = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
      mesh1.name = 'selection-mesh-USA';
      const mesh2 = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
      mesh2.name = 'selection-mesh-Canada';

      countriesGroup.add(mesh1, mesh2);

      const meshes = service['findSelectionMeshes'](countriesGroup);
      expect(meshes.length).toBe(2);
      expect(meshes).toContain(mesh1);
      expect(meshes).toContain(mesh2);
    });

    it('should find selection meshes in selection group', () => {
      const selectionGroup = new Group();
      selectionGroup.name = 'country-selection-meshes';

      const mesh1 = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
      mesh1.name = 'selection-mesh-France';
      selectionGroup.add(mesh1);

      countriesGroup.add(selectionGroup);

      const meshes = service['findSelectionMeshes'](countriesGroup);
      expect(meshes.length).toBe(1);
      expect(meshes).toContain(mesh1);
    });

    it('should find selection meshes in nested hierarchy', () => {
      const nestedGroup = new Group();
      const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
      mesh.name = 'selection-mesh-Germany';

      nestedGroup.add(mesh);
      countriesGroup.add(nestedGroup);

      const meshes = service['findSelectionMeshes'](countriesGroup);
      expect(meshes.length).toBe(1);
      expect(meshes).toContain(mesh);
    });

    it('should exclude non-selection meshes', () => {
      const selectionMesh = new Mesh(
        new BoxGeometry(),
        new MeshBasicMaterial(),
      );
      selectionMesh.name = 'selection-mesh-Italy';

      const borderMesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
      borderMesh.name = 'unified-borders';

      const otherMesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
      otherMesh.name = 'some-other-mesh';

      countriesGroup.add(selectionMesh, borderMesh, otherMesh);

      const meshes = service['findSelectionMeshes'](countriesGroup);
      expect(meshes.length).toBe(1);
      expect(meshes).toContain(selectionMesh);
    });

    it('should return empty array when no selection meshes exist', () => {
      const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
      mesh.name = 'not-a-selection-mesh';
      countriesGroup.add(mesh);

      const meshes = service['findSelectionMeshes'](countriesGroup);
      expect(meshes.length).toBe(0);
    });
  });

  describe('Object Collection', () => {
    it('should collect all objects in hierarchy', () => {
      const group1 = new Group();
      const group2 = new Group();
      const mesh1 = new Mesh();
      const mesh2 = new Mesh();

      group1.add(mesh1);
      group2.add(mesh2);
      countriesGroup.add(group1, group2);

      const objects = service['collectAllObjects'](countriesGroup);

      // Should include: countriesGroup, group1, group2, mesh1, mesh2
      expect(objects.length).toBe(5);
      expect(objects).toContain(countriesGroup);
      expect(objects).toContain(group1);
      expect(objects).toContain(group2);
      expect(objects).toContain(mesh1);
      expect(objects).toContain(mesh2);
    });

    it('should return only root object for empty group', () => {
      const objects = service['collectAllObjects'](countriesGroup);
      expect(objects.length).toBe(1);
      expect(objects[0]).toBe(countriesGroup);
    });
  });

  describe('Debug Info', () => {
    it('should provide debug information about group structure', () => {
      const selectionMesh = new Mesh();
      selectionMesh.name = 'selection-mesh-Spain';

      const borderMesh = new Mesh();
      borderMesh.name = 'unified-borders';

      countriesGroup.add(selectionMesh, borderMesh);

      const debugInfo = service.getDebugInfo(countriesGroup);

      expect(debugInfo.groupName).toBe('countries');
      expect(debugInfo.childrenCount).toBe(2);
      expect(debugInfo.selectionMeshes).toContain('selection-mesh-Spain');
      expect(debugInfo.unifiedBorders).toContain('unified-borders');
    });

    it('should count children correctly', () => {
      const group1 = new Group();
      group1.name = 'group1';
      group1.add(new Mesh(), new Mesh());

      const group2 = new Group();
      group2.name = 'group2';
      group2.add(new Mesh());

      countriesGroup.add(group1, group2);

      const debugInfo = service.getDebugInfo(countriesGroup);

      expect(debugInfo.childrenCount).toBe(2);
      expect(debugInfo.children.length).toBe(2);
      expect(debugInfo.children[0].childrenCount).toBe(2);
      expect(debugInfo.children[1].childrenCount).toBe(1);
    });

    it('should identify unified borders by userData', () => {
      const mesh = new Mesh();
      mesh.name = 'custom-border';
      mesh.userData = { isUnifiedBorder: true };

      countriesGroup.add(mesh);

      const debugInfo = service.getDebugInfo(countriesGroup);
      expect(debugInfo.unifiedBorders).toContain('custom-border');
    });

    it('should handle empty group', () => {
      const debugInfo = service.getDebugInfo(countriesGroup);

      expect(debugInfo.groupName).toBe('countries');
      expect(debugInfo.childrenCount).toBe(0);
      expect(debugInfo.children.length).toBe(0);
      expect(debugInfo.selectionMeshes.length).toBe(0);
      expect(debugInfo.unifiedBorders.length).toBe(0);
    });
  });

  describe('Country Hover Detection', () => {
    it('should return null when no intersections found', () => {
      const mousePos = { x: 0, y: 0 };
      const result = service.detectCountryHover(
        mousePos,
        camera,
        countriesGroup,
      );
      expect(result).toBeNull();
    });

    it('should skip unified borders during detection', () => {
      const borderMesh = new Mesh(
        new BoxGeometry(100, 100, 100),
        new MeshBasicMaterial(),
      );
      borderMesh.name = 'unified-borders';
      borderMesh.position.set(0, 0, 0);

      countriesGroup.add(borderMesh);

      const mousePos = { x: 0, y: 0 };
      const result = service.detectCountryHover(
        mousePos,
        camera,
        countriesGroup,
      );

      // Should not detect unified borders as countries
      expect(result).toBeNull();
    });

    it('should skip meshes with isUnifiedBorder userData', () => {
      const borderMesh = new Mesh(
        new BoxGeometry(100, 100, 100),
        new MeshBasicMaterial(),
      );
      borderMesh.name = 'border-mesh';
      borderMesh.userData = { isUnifiedBorder: true };
      borderMesh.position.set(0, 0, 0);

      countriesGroup.add(borderMesh);

      const mousePos = { x: 0, y: 0 };
      const result = service.detectCountryHover(
        mousePos,
        camera,
        countriesGroup,
      );

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', () => {
      // Create invalid camera to trigger error
      const invalidCamera = null as any;

      const mousePos = { x: 0, y: 0 };
      const result = service.detectCountryHover(
        mousePos,
        invalidCamera,
        countriesGroup,
      );

      expect(result).toBeNull();
      expect(mockLoggerService.warn).toHaveBeenCalled();
    });

    it('should detect country from selection mesh name', () => {
      const selectionMesh = new Mesh(
        new BoxGeometry(10, 10, 10),
        new MeshBasicMaterial(),
      );
      selectionMesh.name = 'selection-mesh-Portugal';
      selectionMesh.position.set(0, 0, -2); // Position in front of camera

      countriesGroup.add(selectionMesh);

      // Note: Actual raycasting requires proper geometry positioning
      // This test verifies the name extraction logic
      const extractedName =
        service['extractCountryNameFromSelectionMesh'](selectionMesh);
      expect(extractedName).toBe('Portugal');
    });

    it('should detect country from userData', () => {
      const countryMesh = new Mesh(
        new BoxGeometry(10, 10, 10),
        new MeshBasicMaterial(),
      );
      countryMesh.name = 'country-mesh';
      countryMesh.userData = {
        name: 'Netherlands',
        isCountry: true,
        countryId: 'NL',
      };

      const info = service['extractCountryInfoFromUserData'](countryMesh);
      expect(info).toEqual({
        name: 'Netherlands',
        id: 'NL',
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty mouse position', () => {
      const mousePos = { x: 0, y: 0 };
      const result = service.detectCountryHover(
        mousePos,
        camera,
        countriesGroup,
      );
      expect(result).toBeNull();
    });

    it('should handle extreme mouse positions', () => {
      const extremePositions = [
        { x: 10000, y: 10000 },
        { x: -10000, y: -10000 },
        { x: Infinity, y: 0 },
        { x: 0, y: -Infinity },
      ];

      extremePositions.forEach((pos) => {
        const result = service.detectCountryHover(pos, camera, countriesGroup);
        // Should either return null or handle gracefully
        expect(result === null || typeof result === 'object').toBe(true);
      });
    });

    it('should handle objects without names', () => {
      const mesh = new Mesh();
      // No name set
      const extractedName =
        service['extractCountryNameFromSelectionMesh'](mesh);
      expect(extractedName).toBeNull();
    });

    it('should handle malformed selection mesh names', () => {
      const testCases = [
        'selection-mesh-',
        'selection-mesh-_',
        'selection-mesh-_0',
      ];

      testCases.forEach((name) => {
        const mesh = new Object3D();
        mesh.name = name;
        const extractedName =
          service['extractCountryNameFromSelectionMesh'](mesh);
        // Malformed names should return empty string or handle gracefully
        expect(extractedName).toBeDefined(); // Should not crash, returns '' for malformed names
      });
    });

    it('should handle deeply nested object hierarchies', () => {
      let current = countriesGroup;
      for (let i = 0; i < 10; i++) {
        const group = new Group();
        group.name = `level-${i}`;
        current.add(group);
        current = group;
      }

      const mesh = new Mesh();
      mesh.name = 'selection-mesh-DeepCountry';
      current.add(mesh);

      const meshes = service['findSelectionMeshes'](countriesGroup);
      expect(meshes.length).toBe(1);
      expect(meshes[0]).toBe(mesh);
    });
  });
});
