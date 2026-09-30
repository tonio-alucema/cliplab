import * as THREE from 'three'

const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

function sockets(x: number, y: number) {
  return Math.min(Math.hypot((x - .115) / .077, (y - .024) / .074), Math.hypot((x + .115) / .077, (y - .024) / .074))
}

function nose(x: number, y: number) {
  // A wider lower opening and narrow bridge suggest a nasal cavity, without a
  // sharp triangular cut or additional artwork pasted onto the bone surface.
  const width = .020 + .009 * smooth((-.025 - y) / .04)
  return Math.hypot(x / width, (y + .047) / .032)
}

function craniumGeometry() {
  const geometry = new THREE.SphereGeometry(1, 128, 112)
  const position = geometry.attributes.position!
  for (let i = 0; i < position.count; i++) {
    let x = position.getX(i) * .29
    const y = position.getY(i) * .255 + .14
    let z = position.getZ(i) * .23
    // Gently narrow the cheeks into the lower jaw, preserving a full rear dome.
    x *= 1 - .13 * smooth((-.015 - y) / .10)
    if (z > 0) {
      const eyeDepth = .086 * (1 - smooth((sockets(x, y) - .32) / .68))
      const noseDepth = .067 * (1 - smooth((nose(x, y) - .18) / .82))
      z -= Math.max(eyeDepth, noseDepth)
    }
    position.setXYZ(i, x, y, z)
  }
  // Geometry creates the recesses; a darker bone material helps their inner
  // walls remain legible through the character's translucent gradient.
  const indices = geometry.index!
  geometry.clearGroups()
  const batches: [number[], number[]] = [[], []]
  for (let i = 0; i < indices.count; i += 3) {
    const a = indices.getX(i), b = indices.getX(i + 1), c = indices.getX(i + 2)
    const x = (position.getX(a) + position.getX(b) + position.getX(c)) / 3
    const y = (position.getY(a) + position.getY(b) + position.getY(c)) / 3
    const z = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3
    const material = z > 0 && (sockets(x, y) < .75 || nose(x, y) < .70) ? 1 : 0
    batches[material].push(a, b, c)
  }
  // Two contiguous material batches mean two draw calls instead of one per UV
  // row/patch. Only triangle order changes; vertices and winding stay intact.
  geometry.setIndex([...batches[0], ...batches[1]])
  geometry.addGroup(0, batches[0].length, 0)
  geometry.addGroup(batches[0].length, batches[1].length, 1)
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return geometry
}

/** Rounded anatomical variant. Every part is a volumetric mesh, including the
 * recessed eye sockets, nasal cavity, jaw, tooth lobes and four curved ribs. */
export function roundedSkeletonGeometry(): THREE.Group {
  const group = new THREE.Group(); group.name = 'inner-skeleton'
  const options = { transparent: true, opacity: 1, depthWrite: true, toneMapped: false }
  const bone = new THREE.MeshBasicMaterial({ ...options, color: '#fff5cd' })
  const cavity = new THREE.MeshBasicMaterial({ ...options, color: '#ddcf9f' })
  const skull = new THREE.Mesh(craniumGeometry(), [bone, cavity]); skull.name = 'skull'; group.add(skull)

  const jawCurve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(-.145, -.065, .095), new THREE.Vector3(-.115, -.155, .185),
    new THREE.Vector3(.115, -.155, .185), new THREE.Vector3(.145, -.065, .095),
  )
  const jaw = new THREE.Mesh(new THREE.TubeGeometry(jawCurve, 40, .025, 12, false), bone)
  jaw.name = 'rounded-jaw'; skull.add(jaw)
  for (const x of [-.05, 0, .05]) {
    const tooth = new THREE.Mesh(new THREE.CapsuleGeometry(.022, .028, 8, 16), bone)
    tooth.name = 'tooth'; tooth.position.set(x, -.133, .153)
    tooth.scale.set(1.08, 1, .76); skull.add(tooth)
  }

  for (const direction of [-1, 1]) for (let row = 0; row < 2; row++) {
    const top = -.21 - row * .122
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(direction * .065, top - .039, .13),
      new THREE.Vector3(direction * .15, top - .055, .16),
      new THREE.Vector3(direction * .255, top - .047, .11),
      new THREE.Vector3(direction * (.32 - row * .025), top + .006, .035),
    )
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
