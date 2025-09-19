export { getStarfield } from './starfield.utils';
export { getFresnelMat } from './getFresnelMat.utils';
export {
  createCountrySelectionMaterial,
  type CountrySelectionMaterialConfig,
} from './country-selection-material.utils';
export {
  CountrySelectionService,
  type SelectionGesture,
  type CountrySelectionEvent,
  type SelectionUpdate,
} from './country-selection.utils';
export {
  latLonToVector3,
  createPolygonGeometry,
  createFilledPolygonGeometry,
  loadGeoJSON,
  createCountryBoundaries,
  createInteractiveCountries,
  createCountryMesh,
  COUNTRY_MATERIALS,
  // TopoJSON exports
  loadTopoJSON,
  lonLatToSphere,
  createUnifiedBorderGeometry,
  createCountrySelectionMeshes,
  createInteractiveCountriesFromTopo,
  disposeTopoJSONMeshes,
  // Types
  type GeoJSONFeature,
  type GeoJSONFeatureCollection,
  type TopoJSONTopology,
  type TopoJSONRenderOptions,
  type UnifiedBorderResult,
} from './geojson.utils';
