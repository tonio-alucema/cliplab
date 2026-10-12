import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import * as THREE from 'three'

/** Inflate a closed 2D silhouette into a softly rounded solid. Both sides meet
 * at the boundary, with shared smooth normals so thin fur tufts have no hard cap. */
export function softVolume(shape: THREE.Shape, depth: number) {
  const flat = new THREE.ShapeGeometry(shape, 12), attribute = flat.getAttribute('position'), index = flat.index!
  const boundary = shape.getPoints(12)
  const positions: number[] = []
  const half = depth / 2 + .025, shoulder = .075
  const surface = (v: THREE.Vector3, side: number) => {
    let distance = Infinity
    for (let i = 0; i < boundary.length - 1; i++) {
      const a = boundary[i]!, b = boundary[i + 1]!, ex = b.x - a.x, ey = b.y - a.y
      const t = THREE.MathUtils.clamp(((v.x - a.x) * ex + (v.y - a.y) * ey) / (ex * ex + ey * ey || 1), 0, 1)
      const x = v.x - a.x - ex * t, y = v.y - a.y - ey * t, d = Math.hypot(x, y)
      distance = Math.min(distance, d)
    }
    const t = Math.min(1, distance / shoulder)
    const height = half * Math.sqrt(Math.max(0, 1 - (1 - t) ** 2))
    positions.push(v.x, v.y, side * height)
  }
  for (let f = 0; f < index.count; f += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(attribute, index.getX(f)), b = new THREE.Vector3().fromBufferAttribute(attribute, index.getX(f + 1)), c = new THREE.Vector3().fromBufferAttribute(attribute, index.getX(f + 2))
    const at = (i: number, j: number) => a.clone().addScaledVector(b.clone().sub(a), i / 6).addScaledVector(c.clone().sub(a), j / 6)
    const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => { surface(a, 1); surface(b, 1); surface(c, 1); surface(c, -1); surface(b, -1); surface(a, -1) }
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6 - i; j++) {
      triangle(at(i, j), at(i + 1, j), at(i, j + 1))
      if (i + j < 5) triangle(at(i + 1, j), at(i + 1, j + 1), at(i, j + 1))
    }
  }
  flat.dispose()
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  const rounded = mergeVertices(geometry, 1e-5); rounded.computeVertexNormals(); geometry.dispose()
  return rounded
}
