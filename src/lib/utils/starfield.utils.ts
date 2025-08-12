import * as THREE from 'three';

interface StarfieldOptions {
  numStars?: number;
  sprite?: THREE.Texture;
}

/**
 * Generate a starfield with randomly positioned points in 3D space
 * @param options Configuration options for the starfield
 * @returns THREE.Points object representing the starfield
 */
export default function getStarfield({
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
    let x = radius * Math.sin(phi) * Math.cos(theta);
    let y = radius * Math.sin(phi) * Math.sin(theta);
    let z = radius * Math.cos(phi);

    return {
      pos: new THREE.Vector3(x, y, z),
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
    let p = randomSpherePoint();
    const { pos, hue } = p;
    positions.push(p);
    col = new THREE.Color().setHSL(hue, 0.2, Math.random());
    verts.push(pos.x, pos.y, pos.z);
    colors.push(col.r, col.g, col.b);
  }

  // Create geometry
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  // Create material
  const mat = new THREE.PointsMaterial({
    size: 0.2,
    vertexColors: true,
    fog: false,
    // map: sprite,
  });

  // Create points
  const points = new THREE.Points(geo, mat);
  return points;
}
