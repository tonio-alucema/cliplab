import { afterAll, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { craniumGeometry } from './skull-cranium'

const opening = (x: number, y: number, rx: number, ry: number, nose = false) => Array.from({ length: 80 }, (_, i) => {
  const angle = i / 80 * Math.PI * 2
  return new THREE.Vector2(x + Math.cos(angle) * rx * (nose ? .74 - .26 * Math.sin(angle) : 1), y + Math.sin(angle) * ry)
})
function inside(point: THREE.Vector3, polygon: THREE.Vector2[]) {
  let result = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result
  }
  return result
}

for (const shape of ['cap', 'chunky-pill'] as const) describe(`${shape} cranium surface`, () => {
  const radius = shape === 'cap' ? .3132 : .36
  const eyeX = 103 / 512 * .76 * .75
  const eyeY = 59 / 512 * .57 * .75 + (shape === 'chunky-pill' ? .13 - .21 : -.025 - .075)
  const holes = [-1, 1].map(direction => opening(direction * eyeX, eyeY, radius * .28, radius * .29))
  holes.push(opening(0, eyeY - radius * .29, radius * .09, radius * .10, true))
  const geometry = craniumGeometry(radius, holes)
  afterAll(() => geometry.dispose())

  it('isolates cached templates from per-character deformation and disposal', () => {
    const first = craniumGeometry(radius, holes), original = first.attributes.position!.getX(0)
    first.attributes.position!.setX(0, 123)
    first.dispose()
    const second = craniumGeometry(radius, holes)
    try {
      expect(second.attributes.position!.getX(0)).toBe(original)
      expect(second.attributes.position!.array).not.toBe(first.attributes.position!.array)
    } finally { second.dispose() }
  })

  it('keeps a watertight front/back seam, with only the three intended socket openings', () => {
    const index = geometry.index!, edges = new Map<string, number>()
    for (let i = 0; i < index.count; i += 3) for (let j = 0; j < 3; j++) {
      const a = index.getX(i + j), b = index.getX(i + (j + 1) % 3)
      const key = a < b ? `${a}:${b}` : `${b}:${a}`
      edges.set(key, (edges.get(key) ?? 0) + 1)
    }
    expect([...edges.values()].filter(count => count === 1)).toHaveLength(240)
    expect([...edges.values()].every(count => count === 1 || count === 2)).toBe(true)
    const position = geometry.attributes.position!
    const points = holes.flat()
    for (const [edge, count] of edges) if (count === 1) for (const id of edge.split(':').map(Number)) {
      const point = new THREE.Vector3().fromBufferAttribute(position, id)
      expect(points.some(aperture => Math.abs(aperture.x - point.x) < 1e-7 && Math.abs(aperture.y - point.y) < 1e-7)).toBe(true)
    }
  })

  it('bounds facet depth and edge length near the dome silhouette without excessive tessellation', () => {
    const index = geometry.index!, position = geometry.attributes.position!
    let longest = 0, deepest = 0, minimumNormal = Infinity
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(position, index.getX(i)); b.fromBufferAttribute(position, index.getX(i + 1)); c.fromBufferAttribute(position, index.getX(i + 2))
      longest = Math.max(longest, a.distanceTo(b), b.distanceTo(c), c.distanceTo(a))
      const center = a.clone().add(b).add(c).divideScalar(3)
      if (a.y < 0 || b.y < 0 || c.y < 0) continue
      deepest = Math.max(deepest, radius - center.length())
      minimumNormal = Math.min(minimumNormal, b.clone().sub(a).cross(c.clone().sub(a)).dot(center))
    }
    expect(longest).toBeLessThan(radius * .076)
    expect(deepest).toBeLessThan(radius * .001)
    expect(minimumNormal).toBeGreaterThan(0)
    expect(index.count / 3).toBeLessThan(60000)
  })

  it('covers the upper dome at grazing camera angles instead of showing missing chunks', () => {
    const material = new THREE.MeshBasicMaterial(), mesh = new THREE.Mesh(geometry, material)
    mesh.updateMatrixWorld(true)
    let checked = 0
    try {
      for (const yaw of [-150, -110, -70, -30, 10, 50, 90, 130, 170]) for (const pitch of [-25, 0, 25, 50]) {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch * Math.PI / 180, yaw * Math.PI / 180, 0))
        const view = new THREE.Vector3(0, 0, 1).applyQuaternion(q), right = new THREE.Vector3(1, 0, 0).applyQuaternion(q), up = new THREE.Vector3(0, 1, 0).applyQuaternion(q)
        for (const degrees of [10, 30, 50, 70, 90, 110, 130, 150, 170]) {
          const angle = degrees * Math.PI / 180
          const target = right.clone().multiplyScalar(Math.cos(angle)).addScaledVector(up, Math.sin(angle)).multiplyScalar(radius * .99)
          const impact = target.clone().addScaledVector(view, Math.sqrt(radius ** 2 - target.lengthSq()))
          if (impact.y < radius * .05 || (impact.z > 0 && holes.some(hole => inside(impact, hole)))) continue
          const ray = new THREE.Raycaster(target.clone().addScaledVector(view, 2), view.clone().negate())
          expect(ray.intersectObject(mesh, false).length, `Missing dome at yaw ${yaw}, pitch ${pitch}, screen angle ${degrees}`).toBeGreaterThan(0)
          checked++
        }
      }
      expect(checked).toBeGreaterThan(240)
    } finally { material.dispose() }
  })
})
