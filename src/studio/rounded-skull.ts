import * as THREE from 'three'
import { craniumGeometry, skullSurface } from './skull-cranium'

type SkeletonShape = 'cap' | 'chunky-pill'
const SEGMENTS = 80
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
function recessedOpening(radius: number, aperture: Opening, shade: THREE.MeshBasicMaterial) {
  const { center, points, name } = aperture, isNose = name === 'nose'
  const centerZ = skullSurface(radius, center.x, center.y)
  const depth = radius * (isNose ? .10 : .16), inset = isNose ? .80 : .87
  const ringPoint = (index: number, scale: number, depression: number) => {
    const point = points[index]!.clone().sub(center).multiplyScalar(scale).add(center)
    return new THREE.Vector3(point.x - center.x, point.y - center.y, skullSurface(radius, point.x, point.y) - centerZ - depression)
  }
  const build = (rim: boolean) => {
    const positions: number[] = [], indices: number[] = []
    const rings = rim ? 3 : 8
    for (let ring = 0; ring <= rings; ring++) {
      const t = ring / rings, scale = rim ? 1 - (1 - inset) * t : inset * (1 - t)
      const depression = rim ? depth * .32 * t : depth * (.32 + .68 * Math.sin(t * Math.PI / 2))
      for (let i = 0; i < SEGMENTS; i++) positions.push(...ringPoint(i, scale, depression).toArray())
    }
    for (let ring = 0; ring < rings; ring++) for (let i = 0; i < SEGMENTS; i++) {
      const a = ring * SEGMENTS + i, b = ring * SEGMENTS + (i + 1) % SEGMENTS
      const c = a + SEGMENTS, d = b + SEGMENTS
      // Every wall and backing surface uses the socket shade, including the
      // complete beveled lip. No highlighted arc can break the filled opening.
      indices.push(a, b, d, a, d, c)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere()
    const mesh = new THREE.Mesh(geometry, shade)
    mesh.name = rim ? `${name}-rim` : name
    mesh.position.set(center.x, center.y, centerZ)
    mesh.userData.skullLayer = rim ? 1 : 0
    return mesh
  }
  return [build(false), build(true)]
}

/** Rounded dome with three gently scalloped front tooth lobes. The classic skull
 * remains separate; this alternate style serves end caps and chunky pills. */
export function roundedSkeletonGeometry(shape: SkeletonShape = 'cap'): THREE.Group {
  const group = new THREE.Group(); group.name = 'inner-skeleton'
  const options = { transparent: true, opacity: 1, depthWrite: true, toneMapped: false }
  const bone = new THREE.MeshBasicMaterial({ ...options, color: '#fff5cd' })
  const cavity = new THREE.MeshBasicMaterial({ ...options, color: '#74674f' })
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
  for (const hole of holes) skull.add(...recessedOpening(radius, hole, cavity))
  // Displace the existing underside continuously instead of intersecting box
  // teeth with it. The shoulders blend into the skull, with shallow valleys
  // between three small forward lobes and no separate join line. The depth
  // falloff finishes before the nose aperture, preserving its matching seam.
  const teeth = [-.32 * 1.15, 0, .32 * 1.15]
  const smooth = (value: number) => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * t * (10 + t * (-15 + 6 * t)) }
  const positions = skull.geometry.attributes.position!
  const toothLift = (x: number, y: number, z: number) => {
    const lobes = teeth.reduce((sum, center) => sum + Math.exp(-.5 * ((x / radius - center) / .105) ** 2), 0)
    const front = smooth(z / radius / .18) * (1 - smooth((z / radius - .48) / .14)) * Math.exp(-.5 * ((z / radius - .40) / .20) ** 2)
    return radius * .13 * 1.15 * lobes * front * smooth((-y / radius - .32) / .25)
  }
  for (let i = 0; i < positions.count; i++) positions.setY(i, positions.getY(i) - toothLift(positions.getX(i), positions.getY(i), positions.getZ(i)))
  positions.needsUpdate = true
  skull.geometry.computeVertexNormals(); skull.geometry.computeBoundingBox(); skull.geometry.computeBoundingSphere()
  teeth.forEach((x, index) => {
    // Semantic anchors keep exported/runtime tooling able to locate each lobe.
    const anchor = new THREE.Object3D(); anchor.name = ['tooth-left', 'tooth-center', 'tooth-right'][index]!
    const z = radius * .40, y = -radius * .6 * Math.sin(Math.sqrt(1 - x * x - .40 ** 2) * Math.PI / 2)
    anchor.position.set(x * radius, y - toothLift(x * radius, y, z), z)
    skull.add(anchor)
  })

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
  const ribs = group.children.filter(child => child.name.startsWith('rib-'))
  const skullBottom = new THREE.Box3().setFromObject(skull).min.y
  const ribTop = Math.max(...ribs.map(rib => new THREE.Box3().setFromObject(rib).max.y))
  const lift = Math.max(0, skullBottom - ribTop) * .5
  for (const rib of ribs) rib.position.y += lift
  group.userData.ribLift = lift
  return group
}
