import * as THREE from 'three'

// A restrained superellipse provides continuous curvature at the straight-side
// joins, unlike circular capsule caps. This is an Apple-style approximation,
// not an implementation of Apple's unpublished continuous-corner outline.
const CURVE_POWER = 2.4

/** Radius of the same surface of revolution used by continuousPillGeometry. */
export function continuousPillRadius(y: number, radius: number, straightLength: number): number {
  const capY = Math.max(0, Math.abs(y) - straightLength / 2)
  if (capY >= radius) return 0
  return radius * Math.pow(1 - Math.pow(capY / radius, CURVE_POWER), 1 / CURVE_POWER)
}

export function continuousPillGeometry(radius: number, straightLength: number): THREE.BufferGeometry {
  const points: THREE.Vector2[] = [], steps = 40, power = 2 / CURVE_POWER
  // Angular sampling resolves both the pole and the straight-side joins without
  // tiny, stretched rings near either end of the continuous cap.
  for (let i = 0; i <= steps; i++) {
    const angle = i / steps * Math.PI / 2
    const x = i === 0 ? 0 : radius * Math.pow(Math.sin(angle), power)
    const y = i === steps ? -straightLength / 2 : -straightLength / 2 - radius * Math.pow(Math.cos(angle), power)
    points.push(new THREE.Vector2(x, y))
  }
  for (let i = 0; i <= steps; i++) {
    const angle = i / steps * Math.PI / 2
    const x = i === steps ? 0 : radius * Math.pow(Math.cos(angle), power)
    const y = i === 0 ? straightLength / 2 : straightLength / 2 + radius * Math.pow(Math.sin(angle), power)
    points.push(new THREE.Vector2(x, y))
  }
  const geometry = new THREE.LatheGeometry(points, 80)
  const positions = geometry.attributes.position!, normals = geometry.attributes.normal!
  const normal = new THREE.Vector3()
  // Close the longitude seam exactly instead of leaving sin(2π) roundoff; a
  // quarter-turned face ray can otherwise pass through that numerical sliver.
  for (let row = 0; row < points.length; row++) positions.setXYZ(80 * points.length + row, positions.getX(row), positions.getY(row), positions.getZ(row))
  // Analytic normals keep the straight side, shoulder and top tangent even at
  // a sampling boundary, including the duplicated longitude seam.
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i), radial = Math.hypot(x, z)
    const capY = Math.max(0, Math.abs(y) - straightLength / 2)
    const outward = Math.pow(radial / radius, CURVE_POWER - 1)
    normal.set(radial ? x / radial * outward : 0, Math.sign(y) * Math.pow(capY / radius, CURVE_POWER - 1), radial ? z / radial * outward : 0).normalize()
    normals.setXYZ(i, normal.x, normal.y, normal.z)
  }
  return geometry
}
