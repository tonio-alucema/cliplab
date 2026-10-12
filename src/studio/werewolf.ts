import { softVolume } from './soft-volume'
import { softLightMaterial } from './soft-lighting'
import * as THREE from 'three'
import type { Character, Pose } from './model'

export const hasWolfSkin = (character: Character) => character.shape === 'sphere' && !!character.werewolf
export const wolfFaceShell = (character: Character) => hasWolfSkin(character) ? 1.035 : 1.003

/** Sculpted, closed ears and fur; a curved facial mask follows the sphere.
 * All parts share the body's transform and use two flat toon colors. */
export function werewolfGeometry(smooth = false) {
  const group = new THREE.Group(); group.name = 'Shaggy wolf'
  const material = (tone: string) => {
    const m = new THREE.MeshBasicMaterial({ color: 'white', transparent: true, depthWrite: true })
    m.name = tone; softLightMaterial(m, smooth); return m
  }
  const fur = material('fur'), shade = material('shade'), light = material('mask'), inner = material('inner-ear')
  const solid = (name: string, shape: THREE.Shape, depth: number, x: number, y: number, z: number, scale = 1, rotation = 0, face = fur) => {
    const geometry = smooth ? softVolume(shape, depth) : new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: .025, bevelThickness: .025, curveSegments: 10 })
    if (!smooth) geometry.translate(0, 0, -depth / 2)
    const mesh = new THREE.Mesh(geometry, smooth ? face : [face, shade]); mesh.name = name
    mesh.position.set(x, y, z); mesh.scale.setScalar(scale); mesh.rotation.z = rotation; mesh.renderOrder = 2
    group.add(mesh); return mesh
  }
  const ear = new THREE.Shape()
  ear.moveTo(-.12, -.08); ear.bezierCurveTo(-.13, .02, -.1, .23, -.065, .25)
  ear.bezierCurveTo(-.025, .27, .13, .06, .13, -.04); ear.quadraticCurveTo(.03, -.13, -.12, -.08)
  for (const side of [-1, 1]) {
    solid(`ear-${side}`, ear, .13, side * .32, .40, .015, 1, -side * .23)
    solid(`inner-ear-${side}`, ear, .015, side * .32, .425, .105, .58, -side * .23, inner)
  }
  const tuft = new THREE.Shape()
  tuft.moveTo(-.12, -.075); tuft.bezierCurveTo(-.09, -.015, .025, .09, .15, .115)
  tuft.bezierCurveTo(.20, .12, .07, -.105, -.035, -.12); tuft.quadraticCurveTo(-.10, -.14, -.12, -.075)
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const mesh = solid(`cheek-${side}-${i}`, tuft, .08, side * (.40 - i * .018), .06 - i * .115, smooth ? .315 : .285, (smooth ? .87 : .75) - i * .08, side * (smooth ? .10 - i * .12 : -.55 - i * .15))
    if (side < 0) mesh.scale.x *= -1
  }
  const fringe = new THREE.Shape()
  fringe.moveTo(-.12, -.14); fringe.bezierCurveTo(-.15, -.02, -.08, .14, .10, .14)
  fringe.bezierCurveTo(.19, .15, .12, -.05, -.12, -.14)
  for (let i = 0; i < 3; i++) solid(`forehead-${i}`, smooth ? fringe : tuft, smooth ? .11 : .075, -.14 + i * .12, .34 - i * (smooth ? .045 : .023), (smooth ? .39 : .33) + i * .016, (smooth ? 1.05 : .85) - i * .1, -.30)

  const mask = new THREE.Shape()
  mask.moveTo(0, .20); mask.bezierCurveTo(-.11, .36, -.32, .24, -.34, .07)
  mask.bezierCurveTo(-.37, -.16, -.20, -.32, 0, -.34)
  mask.bezierCurveTo(.20, -.32, .37, -.16, .34, .07)
  mask.bezierCurveTo(.32, .24, .11, .36, 0, .20)
  const flat = new THREE.ShapeGeometry(mask, 16), position = flat.getAttribute('position'), index = flat.index!
  const points: number[] = []
  const project = (v: THREE.Vector3) => points.push(v.x, v.y, Math.sqrt(Math.max(.001, .507 ** 2 - v.x ** 2 - v.y ** 2)))
  // Subdivide the fill before lifting it so the mask hugs the spherical body.
  for (let f = 0; f < index.count; f += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(position, index.getX(f)), b = new THREE.Vector3().fromBufferAttribute(position, index.getX(f + 1)), c = new THREE.Vector3().fromBufferAttribute(position, index.getX(f + 2))
    const at = (i: number, j: number) => a.clone().addScaledVector(b.clone().sub(a), i / 8).addScaledVector(c.clone().sub(a), j / 8)
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8 - i; j++) {
      project(at(i, j)); project(at(i + 1, j)); project(at(i, j + 1))
      if (i + j < 7) { project(at(i + 1, j)); project(at(i + 1, j + 1)); project(at(i, j + 1)) }
    }
  }
  flat.dispose()
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); geometry.computeVertexNormals()
  if (smooth) {
    const normals = geometry.getAttribute('normal'), positions = geometry.getAttribute('position')
    for (let i = 0; i < positions.count; i++) {
      const n = new THREE.Vector3().fromBufferAttribute(positions, i).normalize(); normals.setXYZ(i, n.x, n.y, n.z)
    }
  }
  const face = new THREE.Mesh(geometry, light); face.name = 'facial-mask'; face.renderOrder = 2; group.add(face)
  if (smooth) {
    const muzzle = new THREE.Group(); muzzle.name = 'muzzle'; group.add(muzzle)
    for (const side of [-1, 1]) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), material('muzzle'))
      mesh.name = `muzzle-${side}`; mesh.position.set(side * .038, 0, 0); mesh.scale.set(.065, .045, .041); mesh.renderOrder = 2; muzzle.add(mesh)
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material('nose'))
    nose.name = 'nose'; nose.position.set(0, .026, .037); nose.scale.set(.032, .023, .021); nose.renderOrder = 2; muzzle.add(nose)
  }
  return group
}

/** Place the sculpted muzzle using the same texture-to-body coordinates as the face. */
export function positionWolfMuzzle(group: THREE.Group, pose: Pose, character: Character, gaze: { x: number; y: number }, visible: boolean) {
  const muzzle = group.getObjectByName('muzzle')
  if (!muzzle) return
  muzzle.visible = visible
  const gx = character.iris ? 0 : (pose.gazeX + gaze.x) * 20
  const gy = character.iris ? 0 : -(pose.gazeY + gaze.y) * 15
  const scale = pose.faceScale
  const x = gx * .25 / 512 * .76 * scale
  const y = (.5 - (293 + gy * .25 - 31) / 512) * .57 * scale + pose.faceY
  muzzle.position.set(x, y, Math.sqrt(Math.max(.001, .512 ** 2 - x * x - y * y)))
  muzzle.scale.setScalar(scale)
}

export function colorWerewolf(group: THREE.Group, character: Character) {
  const key = `${character.color}/${character.color2}/${character.gradient}/${character.toon}/${character.shading3d}/${character.eyeColor}`
  if (group.userData.palette === key) return
  group.userData.palette = key
  const base = new THREE.Color(character.color)
  if (character.gradient) base.lerp(new THREE.Color(character.color2), .5)
  const colors: Record<string, THREE.Color> = {
    fur: base.clone().lerp(new THREE.Color('#68717d'), .32),
    shade: base.clone().multiplyScalar(character.toon ? .65 : .85),
    mask: base.clone().lerp(new THREE.Color(character.shading3d ? '#e3e5ea' : '#f1eee7'), character.shading3d ? .52 : .65),
    muzzle: new THREE.Color('#e2e1df'),
    nose: new THREE.Color(character.eyeColor),
    'inner-ear': base.clone().lerp(new THREE.Color('#292631'), .65),
  }
  group.traverse(object => {
    if (object instanceof THREE.Mesh) for (const m of Array.isArray(object.material) ? object.material : [object.material]) (m as THREE.MeshBasicMaterial).color.copy(colors[m.name]!)
  })
}
