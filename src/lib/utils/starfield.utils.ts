import {
  Vector3,
  Color,
  BufferGeometry,
  Float32BufferAttribute,
  PointsMaterial,
  Points,
  Texture,
} from 'three';

interface StarfieldOptions {
  numStars?: number;
  sprite?: Texture;
}

/**
 * Generate a starfield with randomly positioned points in 3D space
 * @param options Configuration options for the starfield
 * @returns THREE.Points object representing the starfield
 */
export function getStarfield({
  numStars = 500,
  sprite,
}: StarfieldOptions = {}) {
  /**
   * Generate a random point on a sphere surface
   * @returns Object containing position, hue, and minimum distance
   */
  function randomSpherePoint() {
    const radius = Math.random() * 25 + 25;
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    return {
      pos: new Vector3(x, y, z),
      hue: 0.6, // radius * 0.02 + 0.5
      minDist: radius,
    };
  }

  const verts = [];
  const colors = [];
  const positions = [];
  let col;

  // Generate stars
  for (let i = 0; i < numStars; i += 1) {
    const p = randomSpherePoint();
    const { pos, hue } = p;
    positions.push(p);
    col = new Color().setHSL(hue, 0.2, Math.random());
    verts.push(pos.x, pos.y, pos.z);
    colors.push(col.r, col.g, col.b);
  }

  // Create geometry
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));

  // Create material
  const mat = new PointsMaterial({
    size: 0.2,
    vertexColors: true,
    transparent: true,
    fog: false,
    // map: sprite,
  });

  // Create points
  const points = new Points(geo, mat);
  return points;
}
