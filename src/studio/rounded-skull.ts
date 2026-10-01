import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

type SkeletonShape = 'cap' | 'chunky-pill'
const SEGMENTS = 80
const edgeKey = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`

// The top retains its spherical dome. A shallow superellipse rounds off the
// lower corners while keeping the underside short and almost horizontal.
function skullSurface(radius: number, x: number, y: number) {
  const sphereY = y >= 0 ? y : -radius * Math.asin(Math.min(1, Math.max(0, -y / (radius * .6)))) * 2 / Math.PI
  return Math.sqrt(Math.max(0, radius * radius - x * x - sphereY * sphereY))
}

/** Triangulate the curved front with genuine openings. Shared subdivisions keep
 * a watertight seam with the back and the cavity rims, without CSG artifacts. */
function craniumGeometry(radius: number, openings: THREE.Vector2[][]) {
  const outline = Array.from({ length: 128 }, (_, i) => {
    const angle = i / 128 * Math.PI * 2, y = Math.sin(angle)
    return new THREE.Vector2(Math.cos(angle) * radius, (y < 0 ? -.6 * Math.sin(-y * Math.PI / 2) : y) * radius)
  })
  const positions: number[] = [], indices: number[] = []
  for (const sign of [1, -1]) {
    const loops = [outline, ...(sign === 1 ? openings : [])]
    const flat = loops.flat(), points = flat.map((p, i) => new THREE.Vector3(p.x, p.y, i < outline.length ? 0 : skullSurface(radius, p.x, p.y) * sign))
    let faces = THREE.ShapeUtils.triangulateShape(outline, loops.slice(1))
    let boundary = new Set<string>(), offset = 0
    for (const loop of loops) {
      loop.forEach((_, i) => boundary.add(edgeKey(offset + i, offset + (i + 1) % loop.length)))
      offset += loop.length
    }
    // Keep hole and silhouette edges linear between their densely sampled
    // endpoints so independently built rims share the exact same boundary.
    for (let level = 0; level < (sign === 1 ? 3 : 4); level++) {
      const cache = new Map<string, number>(), nextBoundary = new Set<string>()
      const midpoint = (a: number, b: number) => {
        const key = edgeKey(a, b), cached = cache.get(key)
        if (cached !== undefined) return cached
        const point = points[a]!.clone().add(points[b]!).multiplyScalar(.5)
        if (!boundary.has(key)) point.z = skullSurface(radius, point.x, point.y) * sign
        const index = points.push(point) - 1; cache.set(key, index)
        if (boundary.has(key)) { nextBoundary.add(edgeKey(a, index)); nextBoundary.add(edgeKey(index, b)) }
        return index
      }
      faces = faces.flatMap(([a, b, c]) => {
        const ab = midpoint(a!, b!), bc = midpoint(b!, c!), ca = midpoint(c!, a!)
        return [[a!, ab, ca], [ab, b!, bc], [ca, bc, c!], [ab, bc, ca]]
      })
      boundary = nextBoundary
    }
    const base = positions.length / 3
    for (const point of points) positions.push(point.x, point.y, point.z)
    for (const [a, b, c] of faces) {
      const pa = points[a!]!, pb = points[b!]!, pc = points[c!]!
      const winding = (pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x)
      indices.push(base + a!, base + (winding * sign > 0 ? b! : c!), base + (winding * sign > 0 ? c! : b!))
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices)
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return geometry
}

type Opening = { name: string; center: THREE.Vector2; points: THREE.Vector2[] }
function opening(name: string, x: number, y: number, rx: number, ry: number, nose = false): Opening {
  return { name, center: new THREE.Vector2(x, y), points: Array.from({ length: SEGMENTS }, (_, i) => {
    const angle = i / SEGMENTS * Math.PI * 2
    // A soft teardrop: narrow at the top, broad rounded base.
    return new THREE.Vector2(x + Math.cos(angle) * rx * (nose ? .74 - .26 * Math.sin(angle) : 1), y + Math.sin(angle) * ry)
  }) }
}

/** A beveled lip leads into a closed, concave bowl. Both are actual depth-tested
 * surfaces, not decals. Discrete colors carry the same toon bands into SVG. */
function recessedOpening(radius: number, aperture: Opening, palette: THREE.MeshBasicMaterial[]) {
  const { center, points, name } = aperture, isNose = name === 'nose'
  const centerZ = skullSurface(radius, center.x, center.y)
  const depth = radius * (isNose ? .10 : .16), inset = isNose ? .80 : .87
  const ringPoint = (index: number, scale: number, depression: number) => {
    const point = points[index]!.clone().sub(center).multiplyScalar(scale).add(center)
    return new THREE.Vector3(point.x - center.x, point.y - center.y, skullSurface(radius, point.x, point.y) - centerZ - depression)
  }
  const build = (rim: boolean) => {
    const positions: number[] = [], bands: number[][] = [[], [], []]
    const rings = rim ? 3 : 8
    for (let ring = 0; ring <= rings; ring++) {
      const t = ring / rings, scale = rim ? 1 - (1 - inset) * t : inset * (1 - t)
      const depression = rim ? depth * .32 * t : depth * (.32 + .68 * Math.sin(t * Math.PI / 2))
      for (let i = 0; i < SEGMENTS; i++) positions.push(...ringPoint(i, scale, depression).toArray())
    }
    for (let ring = 0; ring < rings; ring++) for (let i = 0; i < SEGMENTS; i++) {
      const a = ring * SEGMENTS + i, b = ring * SEGMENTS + (i + 1) % SEGMENTS
      const c = a + SEGMENTS, d = b + SEGMENTS
      // The upper/right rim falls into shade; the lower/left lip catches light.
      const angle = (i + .5) / SEGMENTS * Math.PI * 2
      const light = -Math.cos(angle) * .45 - Math.sin(angle) * .8
      const band = rim ? light > .1 ? 0 : 1 : 2
      bands[band]!.push(a, b, d, a, d, c)
    }
    const geometry = new THREE.BufferGeometry(), indices: number[] = []
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    for (const [index, band] of bands.entries()) { geometry.addGroup(indices.length, band.length, index); indices.push(...band) }
    geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere()
    const mesh = new THREE.Mesh(geometry, palette)
    mesh.name = rim ? `${name}-rim` : name
    mesh.position.set(center.x, center.y, centerZ)
    mesh.userData.skullLayer = rim ? 1 : 0
    return mesh
  }
  return [build(false), build(true)]
}

/** Rounded dome, shortened underside, and two front teeth. The classic skull
 * remains separate; this alternate style serves end caps and chunky pills. */
export function roundedSkeletonGeometry(shape: SkeletonShape = 'cap'): THREE.Group {
  const group = new THREE.Group(); group.name = 'inner-skeleton'
  const options = { transparent: true, opacity: 1, depthWrite: true, toneMapped: false }
  const bone = new THREE.MeshBasicMaterial({ ...options, color: '#fff5cd' })
  const rimShade = new THREE.MeshBasicMaterial({ ...options, color: '#c9b984' })
  const cavity = new THREE.MeshBasicMaterial({ ...options, color: '#74674f' })
  const palette = [bone, rimShade, cavity]
  const radius = shape === 'chunky-pill' ? .36 : .3132, centerY = shape === 'chunky-pill' ? .21 : .075
  // Preserve the alignment between the face's resting eyes and the sockets.
  const eyeX = 103 / 512 * .76 * .75
  const eyeY = 59 / 512 * .57 * .75 + (shape === 'chunky-pill' ? .13 : -.025)
  const socketY = eyeY - centerY
  const holes = [-1, 1].map(direction => opening(direction < 0 ? 'socket-left' : 'socket-right', direction * eyeX, socketY, radius * .28, radius * .29))
  holes.push(opening('nose', 0, socketY - radius * .29, radius * .09, radius * .10, true))
  const skull = new THREE.Mesh(craniumGeometry(radius, holes.map(hole => hole.points)), bone)
  skull.name = 'skull'; skull.position.y = centerY; skull.userData.recessedSkull = true
  group.add(skull)
  for (const hole of holes) skull.add(...recessedOpening(radius, hole, palette))
  for (const direction of [-1, 1]) {
    const tooth = new THREE.Mesh(new RoundedBoxGeometry(radius * .25, radius * .32, radius * .32, 4, radius * .07), bone)
    tooth.name = direction < 0 ? 'tooth-left' : 'tooth-right'
    tooth.position.set(direction * radius * .15, -radius * .635, radius * .38)
    skull.add(tooth)
  }

  for (const direction of [-1, 1]) for (let row = 0; row < (shape === 'chunky-pill' ? 3 : 2); row++) {
    const top = shape === 'chunky-pill' ? -.19 - row * .15 : -.21 - row * .122
    const width = shape === 'chunky-pill' ? 1.12 : 1
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(direction * .065, top - .039, .13),
      new THREE.Vector3(direction * .15 * width, top - .055, .16),
      new THREE.Vector3(direction * .255 * width, top - .047, .11),
      new THREE.Vector3(direction * (.32 - row * .025) * width, top + .006, .035),
    )
    // Halve centerline length while leaving tube/end-cap thickness untouched.
    // Bring the center of each shortened rib 20% closer to the body's midline.
    const center = curve.getPoint(.5)
    const target = center.clone(); target.x *= .8
    // Halve the visible gap between the left/right pairs. Measuring from the
    // round inner end preserves bone thickness and avoids merging the ribs.
    const innerEdge = Math.abs((curve.v0.x - center.x) * .5 + target.x) - .032
    target.x -= direction * innerEdge * .5
    // Keep a visible neck gap after lowering the end-cap skull.
    if (shape === 'cap') target.y -= row === 0 ? .05 : .025
    for (const point of [curve.v0, curve.v1, curve.v2, curve.v3]) point.sub(center).multiplyScalar(.5).add(target)
    const rounded = new THREE.Group(); rounded.name = `rib-${direction < 0 ? 'left' : 'right'}-${row + 1}`
    const rib = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, .032, 12, false), bone)
    rib.name = rounded.name; rounded.add(rib)
    for (const t of [0, 1]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(.032, 16, 12), bone)
      cap.position.copy(curve.getPoint(t)); cap.name = 'rib-end'; rounded.add(cap)
    }
    group.add(rounded)
  }
  if (shape === 'chunky-pill') {
    // Halve the visible gaps rather than the bone thickness: six chunky ribs
    // stay separate. The existing row-by-row shortening gently tapers the cage.
    for (const direction of [-1, 1]) {
      let previousBottom = 0, previousOriginalBottom = 0
      for (let row = 1; row <= 3; row++) {
        const rib = group.getObjectByName(`rib-${direction < 0 ? 'left' : 'right'}-${row}`)!
        const bounds = new THREE.Box3().setFromObject(rib)
        const innerGap = direction < 0 ? -bounds.max.x : bounds.min.x
        rib.position.x -= direction * innerGap * .5
        if (row > 1) {
          const originalGap = previousOriginalBottom - bounds.max.y
          rib.position.y = previousBottom - originalGap * .5 - bounds.max.y
        }
        previousOriginalBottom = bounds.min.y
        previousBottom = bounds.min.y + rib.position.y
      }
    }
  }
  return group
}
