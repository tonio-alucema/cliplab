import * as THREE from 'three'

type Face = { vertices: [number, number, number]; side: 1 | -1 }
const edgeKey = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`
// Saved-character thumbnails share the two skull templates, but each renderer
// receives its own disposable/deformable geometry rather than a shared instance.
const templates = new Map<string, THREE.BufferGeometry>()

// The dome stays spherical; the lower half compresses into a rounded underside.
export function skullSurface(radius: number, x: number, y: number) {
  const sphereY = y >= 0 ? y : -radius * Math.asin(Math.min(1, Math.max(0, -y / (radius * .6)))) * 2 / Math.PI
  return Math.sqrt(Math.max(0, radius * radius - x * x - sphereY * sphereY))
}

const outlinePoint = (radius: number, angle: number) => {
  const y = Math.sin(angle)
  return new THREE.Vector3(Math.cos(angle) * radius, (y < 0 ? -.6 * Math.sin(-y * Math.PI / 2) : y) * radius, 0)
}

/** A conforming shell with genuinely open sockets. Refinement is measured on
 * the curved 3D surface, since uniform XY subdivisions leave long, inward-folded
 * facets near the silhouette. Both halves share every curved silhouette edge;
 * opening edges remain linear so the separately constructed recesses fit them. */
export function craniumGeometry(radius: number, openings: THREE.Vector2[][]) {
  const templateKey = JSON.stringify([radius, openings.map(loop => loop.map(point => [point.x, point.y]))])
  const template = templates.get(templateKey)
  if (template) {
    templates.delete(templateKey); templates.set(templateKey, template)
    return template.clone()
  }
  const outline = Array.from({ length: 128 }, (_, i) => outlinePoint(radius, i * Math.PI / 64))
  const points = [...outline], angles = new Map(outline.map((_, i) => [i, i * Math.PI / 64]))
  let silhouette = new Set(outline.map((_, i) => edgeKey(i, (i + 1) % outline.length)))
  let openingEdges = new Set<string>()
  const loops = [outline.map(p => new THREE.Vector2(p.x, p.y)), ...openings]
  for (const loop of openings) {
    const base = points.length
    points.push(...loop.map(p => new THREE.Vector3(p.x, p.y, skullSurface(radius, p.x, p.y))))
    for (let i = 0; i < loop.length; i++) openingEdges.add(edgeKey(base + i, base + (i + 1) % loop.length))
  }
  let faces: Face[] = [
    ...THREE.ShapeUtils.triangulateShape(loops[0]!, openings).map(vertices => ({ vertices: vertices as [number, number, number], side: 1 as const })),
    ...THREE.ShapeUtils.triangulateShape(loops[0]!, []).map(vertices => ({ vertices: vertices as [number, number, number], side: -1 as const })),
  ]
  const projectedMidpoint = (a: number, b: number, side: 1 | -1) => {
    const key = edgeKey(a, b), point = points[a]!.clone().add(points[b]!).multiplyScalar(.5)
    if (silhouette.has(key)) {
      const aa = angles.get(a)!, ab = angles.get(b)!
      return outlinePoint(radius, Math.atan2(Math.sin(aa) + Math.sin(ab), Math.cos(aa) + Math.cos(ab)))
    }
    if (!openingEdges.has(key)) {
      if (points[a]!.z === 0 && points[b]!.z === 0) point.z = skullSurface(radius, point.x, point.y) * side
      else {
        const uncompress = (p: THREE.Vector3) => new THREE.Vector3(p.x, p.y >= 0 ? p.y : -radius * Math.asin(Math.min(1, -p.y / (radius * .6))) * 2 / Math.PI, p.z)
        point.copy(uncompress(points[a]!).add(uncompress(points[b]!)).normalize().multiplyScalar(radius))
        if (point.y < 0) point.y = -radius * .6 * Math.sin(-point.y / radius * Math.PI / 2)
      }
    }
    return point
  }
  // A side tag keeps initial front/back diagonals between outline vertices from
  // incorrectly sharing a midpoint on only one hemisphere.
  const cacheKey = (a: number, b: number, side: 1 | -1) => `${silhouette.has(edgeKey(a, b)) ? 0 : side}:${edgeKey(a, b)}`
  const maxEdgeSquared = (radius * .075) ** 2, maxSagSquared = (radius * .0008) ** 2
  for (let pass = 0; pass < 18; pass++) {
    const marked = new Map<string, { a: number; b: number; point: THREE.Vector3 }>()
    for (const { vertices: [a, b, c], side } of faces) for (const [u, v] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      const key = cacheKey(u, v, side)
      if (marked.has(key)) continue
      const midpoint = projectedMidpoint(u, v, side)
      const chord = points[u]!.clone().add(points[v]!).multiplyScalar(.5)
      if (points[u]!.distanceToSquared(points[v]!) > maxEdgeSquared || midpoint.distanceToSquared(chord) > maxSagSquared) marked.set(key, { a: u, b: v, point: midpoint })
    }
    if (!marked.size) break
    const midpointIndices = new Map<string, number>(), nextSilhouette = new Set(silhouette), nextOpeningEdges = new Set(openingEdges)
    for (const [key, { a, b, point }] of marked) {
      const i = points.push(point) - 1, rawKey = edgeKey(a, b)
      midpointIndices.set(key, i)
      if (silhouette.has(rawKey)) {
        angles.set(i, Math.atan2(Math.sin(angles.get(a)!) + Math.sin(angles.get(b)!), Math.cos(angles.get(a)!) + Math.cos(angles.get(b)!)))
        nextSilhouette.delete(rawKey); nextSilhouette.add(edgeKey(a, i)); nextSilhouette.add(edgeKey(i, b))
      }
      if (openingEdges.has(rawKey)) {
        nextOpeningEdges.delete(rawKey); nextOpeningEdges.add(edgeKey(a, i)); nextOpeningEdges.add(edgeKey(i, b))
      }
    }
    const nextFaces: Face[] = []
    for (const { vertices: [a, b, c], side } of faces) {
      const ab = midpointIndices.get(cacheKey(a, b, side)), bc = midpointIndices.get(cacheKey(b, c, side)), ca = midpointIndices.get(cacheKey(c, a, side))
      const add = (...vertices: [number, number, number][]) => nextFaces.push(...vertices.map(vertices => ({ vertices, side })))
      if (ab !== undefined && bc !== undefined && ca !== undefined) add([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca])
      else if (ab !== undefined && bc !== undefined) add([b, bc, ab], [a, ab, c], [ab, bc, c])
      else if (bc !== undefined && ca !== undefined) add([c, ca, bc], [b, bc, a], [bc, ca, a])
      else if (ca !== undefined && ab !== undefined) add([a, ab, ca], [c, ca, b], [ca, ab, b])
      else if (ab !== undefined) add([a, ab, c], [ab, b, c])
      else if (bc !== undefined) add([b, bc, a], [bc, c, a])
      else if (ca !== undefined) add([c, ca, b], [ca, a, b])
      else add([a, b, c])
    }
    faces = nextFaces; silhouette = nextSilhouette; openingEdges = nextOpeningEdges
  }
  const indices: number[] = []
  for (const { vertices: [a, b, c] } of faces) {
    const pa = points[a]!, pb = points[b]!, pc = points[c]!
    const normal = pb.clone().sub(pa).cross(pc.clone().sub(pa))
    const center = pa.clone().add(pb).add(pc).divideScalar(3)
    const outward = normal.dot(center) > 0
    indices.push(a, outward ? b : c, outward ? c : b)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(point => point.toArray()), 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  templates.set(templateKey, geometry)
  if (templates.size > 2) {
    const oldest = templates.keys().next().value!
    templates.get(oldest)!.dispose(); templates.delete(oldest)
  }
  return geometry.clone()
}
