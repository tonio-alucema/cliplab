import * as THREE from 'three'

type SkeletonShape = 'cap' | 'chunky-pill'

/** A flat-color marking mapped onto the skull's curved surface. Its clean edge
 * is sampled directly as a circle/ellipse, rather than cutting through triangles
 * in the sphere mesh. Radial subdivisions keep its depth correct in profile. */
function surfaceMark(radius: number, x: number, y: number, rx: number, ry: number, material: THREE.MeshBasicMaterial, name: string) {
  const segments = 80, rings = 8, offset = .0015
  const zAt = (px: number, py: number) => Math.sqrt(Math.max(0, radius * radius - px * px - py * py)) + offset
  const center = new THREE.Vector3(x, y, zAt(x, y))
  const vertices = [0, 0, 0], indices: number[] = []
  for (let ring = 1; ring <= rings; ring++) for (let i = 0; i < segments; i++) {
    const angle = i / segments * Math.PI * 2
    const px = x + Math.cos(angle) * rx * ring / rings, py = y + Math.sin(angle) * ry * ring / rings
    vertices.push(px - center.x, py - center.y, zAt(px, py) - center.z)
  }
  for (let i = 0; i < segments; i++) indices.push(0, 1 + i, 1 + (i + 1) % segments)
  for (let ring = 1; ring < rings; ring++) for (let i = 0; i < segments; i++) {
    const a = 1 + (ring - 1) * segments + i, b = 1 + (ring - 1) * segments + (i + 1) % segments
    const c = 1 + ring * segments + i, d = 1 + ring * segments + (i + 1) % segments
    indices.push(a, c, d, a, d, b)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices)
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name; mesh.position.copy(center)
  // These remain surface artwork, even though they have a true curved 3D mesh.
  mesh.userData.surfaceOverlay = true
  return mesh
}

/** A perfectly spherical alternate skull with clean two-tone curved markings.
 * The original skull is separate; this style works for end caps and chunky pills. */
export function roundedSkeletonGeometry(shape: SkeletonShape = 'cap'): THREE.Group {
  const group = new THREE.Group(); group.name = 'inner-skeleton'
  const options = { transparent: true, opacity: 1, depthWrite: true, toneMapped: false }
  const bone = new THREE.MeshBasicMaterial({ ...options, color: '#fff5cd' })
  const ink = new THREE.MeshBasicMaterial({ ...options, color: '#b8a979' })
  // Leave breathing room beneath the inner toon silhouette, including in profile.
  const radius = shape === 'chunky-pill' ? .36 : .3132, centerY = shape === 'chunky-pill' ? .21 : .075
  const geometry = new THREE.SphereGeometry(radius, 128, 96)
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  const skull = new THREE.Mesh(geometry, bone)
  skull.name = 'skull'; skull.position.y = centerY; group.add(skull)
  // Match the resting face centers; skull resizing must not widen socket spacing.
  const eyeX = 103 / 512 * .76 * .75
  const eyeY = 59 / 512 * .57 * .75 + (shape === 'chunky-pill' ? .13 : -.025)
  const socketY = eyeY - centerY
  for (const direction of [-1, 1]) skull.add(surfaceMark(radius, direction * eyeX, socketY, radius * .24, radius * .24, ink, direction < 0 ? 'socket-left' : 'socket-right'))
  for (const direction of [-1, 1]) skull.add(surfaceMark(radius, direction * radius * .061, socketY - radius * .27, radius * .043, radius * .047, ink, direction < 0 ? 'nose-left' : 'nose-right'))

  for (const direction of [-1, 1]) for (let row = 0; row < 2; row++) {
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
  return group
}
