import * as THREE from 'three'
import type { BodyModification, Character, Shape } from './model'

export const bodyHeight = (shape: Shape) => shape === 'capsule' ? 2 : shape === 'chunky-pill' ? 1.5 : 1
export const isPill = (shape: Shape) => shape === 'capsule' || shape === 'chunky-pill'
export const bodyModification = (character: Pick<Character, 'shape' | 'bodyModification'>): BodyModification => character.shape === 'cap' ? character.bodyModification ?? 'none' : 'none'
export const faceOffset = (shape: Shape) => isPill(shape) ? -.14 * (bodyHeight(shape) - 1) : -.025

export function radiusAt(shape: Shape, y: number, modification: BodyModification = 'none'): number {
  if (shape === 'sphere') return Math.sqrt(Math.max(0, .25 - y * y))
  if (isPill(shape)) { const dy = Math.max(Math.abs(y) - (bodyHeight(shape) - 1) / 2, 0); return Math.sqrt(Math.max(0, .25 - dy * dy)) }
  if (modification === 'upside-down') y = -y
  if (y >= 0) return Math.sqrt(Math.max(0, .25 - y * y))
  if (y >= -.43) return .5
  return .43 + Math.sqrt(Math.max(0, .07 ** 2 - (y + .43) ** 2))
}

export function bodyGeometry(shape: Shape, squareBottom = false, modification: BodyModification = 'none', inset = false): THREE.BufferGeometry {
  if (shape === 'sphere') return new THREE.SphereGeometry(.5, 80, 64)
  if (isPill(shape)) return new THREE.CapsuleGeometry(inset ? .42 : .5, (bodyHeight(shape) - 1) * (inset ? .94 : 1), 24, 80)
  const ghost = modification === 'ghost'
  // Radial rings let the draped underside deform smoothly from every camera angle.
  const corner = squareBottom && !ghost ? 0 : .07
  const points = [new THREE.Vector2(0, -.5)]
  for (let i = 1; i <= (ghost ? 12 : 1); i++) points.push(new THREE.Vector2((.5 - corner) * i / (ghost ? 12 : 1), -.5))
  for (let i = 1; corner && i <= 12; i++) { const a = -Math.PI / 2 + i / 12 * Math.PI / 2; points.push(new THREE.Vector2(.43 + corner * Math.cos(a), -.43 + corner * Math.sin(a))) }
  for (let i = 1; ghost && i <= 10; i++) points.push(new THREE.Vector2(.5, -.43 + i / 10 * .43))
  if (!ghost) points.push(new THREE.Vector2(.5, 0))
  for (let i = 1; i <= 32; i++) { const a = i / 32 * Math.PI / 2; points.push(new THREE.Vector2(.5 * Math.cos(a), .5 * Math.sin(a))) }
  const geometry = new THREE.LatheGeometry(points, 80)
  if (modification === 'upside-down') geometry.rotateZ(Math.PI)
  if (ghost) {
    geometry.userData.ghostBase = (geometry.attributes.position!.array as Float32Array).slice()
    animateGhostGeometry(geometry, 0)
  }
  return geometry
}

/** A closed, travelling wave: bounded and periodic, without per-frame mesh allocations. */
export function animateGhostGeometry(geometry: THREE.BufferGeometry, phase: number) {
  const base = geometry.userData.ghostBase as Float32Array | undefined
  if (!base) return
  const position = geometry.attributes.position!
  const turn = (phase % 1) * Math.PI * 2
  for (let i = 0; i < position.count; i++) {
    const x = base[i * 3]!, y = base[i * 3 + 1]!
    const t = Math.max(0, Math.min(1, (-y - .27) / .23)), weight = t * t * (3 - 2 * t)
    // Matching the front/back wave prevents their projected lower envelopes
    // crossing into a sharp cusp while retaining a closed, volumetric underside.
    const lift = .032 + .029 * Math.cos(x * Math.PI * 6 + turn)
    position.setY(i, y + lift * weight)
  }
  position.needsUpdate = true
  // The gradient material is unlit. Bounds, however, must follow the CPU-visible
  // geometry for safe thumbnail framing and faithful SVG snapshots.
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
}

export const SKELETON_BODY_OPACITY = .48
export const SKELETON_INSET_OPACITY = .35
export const SKELETON_BACK_OPACITY = .72

/** A compact, volumetric skull with real socket/nose openings and four curved ribs. */
export function skeletonGeometry(): THREE.Group {
  const group = new THREE.Group(); group.name = 'inner-skeleton'
  // Keep opaque-looking bones in the transparent render pass, between the rear
  // and front shell surfaces; depth writes preserve their real 3D occlusion.
  const bone = new THREE.MeshBasicMaterial({ color: '#fff5cd', toneMapped: false, transparent: true, opacity: 1, depthWrite: true })
  const side = new THREE.MeshBasicMaterial({ color: '#ddcf9f', toneMapped: false, transparent: true, opacity: 1, depthWrite: true })
  const skull = new THREE.Shape()
  skull.moveTo(-.12, -.06)
  skull.bezierCurveTo(-.28, -.05, -.31, .025, -.31, .145)
  skull.bezierCurveTo(-.31, .30, -.18, .395, 0, .395)
  skull.bezierCurveTo(.18, .395, .31, .30, .31, .145)
  skull.bezierCurveTo(.31, .025, .28, -.05, .12, -.06)
  skull.lineTo(.12, -.085)
  skull.bezierCurveTo(.12, -.145, .043, -.145, .04, -.095)
  skull.bezierCurveTo(.04, -.153, -.04, -.153, -.04, -.095)
  skull.bezierCurveTo(-.043, -.145, -.12, -.145, -.12, -.085)
  skull.closePath()
  for (const x of [-.115, .115]) {
    const socket = new THREE.Path(); socket.absellipse(x, .024, .073, .072, 0, Math.PI * 2, true); skull.holes.push(socket)
  }
  const nose = new THREE.Path(); nose.moveTo(0, -.012); nose.bezierCurveTo(-.008, -.012, -.024, -.04, -.023, -.052); nose.quadraticCurveTo(-.016, -.064, 0, -.055); nose.quadraticCurveTo(.016, -.064, .023, -.052); nose.bezierCurveTo(.024, -.04, .008, -.012, 0, -.012); skull.holes.push(nose)
  const skullGeometry = new THREE.ExtrudeGeometry(skull, { depth: .20, bevelEnabled: true, bevelSegments: 5, steps: 1, bevelSize: .014, bevelThickness: .024, curveSegments: 28 })
  skullGeometry.translate(0, 0, -.1)
  const head = new THREE.Mesh(skullGeometry, [bone, side]); head.name = 'skull'; group.add(head)
  for (const direction of [-1, 1]) for (let row = 0; row < 2; row++) {
    const top = -.19 - row * .115
    const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(direction * .06, top - .04, .115), new THREE.Vector3(direction * .135, top - .055, .14), new THREE.Vector3(direction * .23, top - .045, .10), new THREE.Vector3(direction * (.285 - row * .022), top + .006, .025))
    const rib = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, .026, 12, false), bone); rib.name = `rib-${direction < 0 ? 'left' : 'right'}-${row + 1}`
    const rounded = new THREE.Group(); rounded.name = rib.name
    rounded.add(rib)
    for (const t of [0, 1]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(.026, 12, 8), bone); cap.position.copy(curve.getPoint(t)); rounded.add(cap) }
    group.add(rounded)
  }
  return group
}

export function disposeSkeleton(group: THREE.Group) {
  const materials = new Set<THREE.Material>()
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.dispose()
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
  })
  materials.forEach(material => material.dispose())
}
