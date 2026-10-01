import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { roundedSkeletonGeometry } from './rounded-skull'
import { bodyGeometry, disposeSkeleton, radiusAt } from './body-geometry'
import { toonLightOffset } from './renderer'

describe('recessed 3D skeleton', () => {
  for (const shape of ['cap', 'chunky-pill'] as const) {
    const radius = shape === 'cap' ? .3132 : .36
    it(`uses a round dome, shallow underside and two forward teeth for ${shape}`, () => {
      const skeleton = roundedSkeletonGeometry(shape)
      try {
        const skull = skeleton.getObjectByName('skull') as THREE.Mesh
        const bounds = skull.geometry.boundingBox!
        expect(bounds.max.y).toBeCloseTo(radius)
        expect(bounds.min.y).toBeCloseTo(-radius * .6)
        expect(bounds.max.x - bounds.min.x).toBeCloseTo(radius * 2)
        expect(bounds.max.z - bounds.min.z).toBeCloseTo(radius * 2, 2)
        expect(skull.userData.recessedSkull).toBe(true)
        const vertices = skull.geometry.attributes.position!
        for (let i = 0; i < vertices.count; i++) {
          const vertex = new THREE.Vector3().fromBufferAttribute(vertices, i)
          expect(vertex.length()).toBeLessThan(radius + .00001)
          if (vertex.y >= 0) expect(vertex.length()).toBeCloseTo(radius, 3)
        }
        const teeth = skull.children.filter(child => child.name.startsWith('tooth-'))
        expect(teeth).toHaveLength(2)
        for (const tooth of teeth) {
          expect(tooth.position.z).toBeGreaterThan(radius * .2)
          const bounds = new THREE.Box3().setFromObject(tooth)
          expect(bounds.min.y).toBeLessThan(-radius * .6)
          expect(bounds.max.y).toBeGreaterThan(-radius * .6)
        }
        expect(teeth[0]!.position.x).toBeCloseTo(-teeth[1]!.position.x)
        expect(skeleton.getObjectByName('rounded-jaw')).toBeUndefined()
      } finally { disposeSkeleton(skeleton) }
    })

    it(`leaves positive clearance around the skull inside the moving toon inset for ${shape}`, () => {
      const skeleton = roundedSkeletonGeometry(shape), inset = bodyGeometry(shape, false, 'skeleton', true)
      try {
        const skull = skeleton.getObjectByName('skull') as THREE.Mesh<THREE.SphereGeometry>
        const positions = inset.attributes.position!, scale = shape === 'cap' ? .85 : 1
        const directions = Array.from({ length: 72 }, (_, i) => new THREE.Vector2(Math.cos(i * Math.PI / 36), Math.sin(i * Math.PI / 36)))
        const rotations = [{ x: -5.9, y: -24.2, z: 0 }]
        for (const x of [-90, -45, 0, 45, 90]) for (const y of [-180, -90, -45, -28, 0, 28, 45, 90, 180]) for (const z of [0, 45, 90, 180]) rotations.push({ x, y, z })
        let minimum = Infinity, worst = ''
        const vertex = new THREE.Vector3(), projected = new Float64Array(positions.count * 2)
        for (const rotation of rotations) {
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x * Math.PI / 180, rotation.y * Math.PI / 180, rotation.z * Math.PI / 180, 'YXZ'))
          const offset = toonLightOffset(q, true), center = skull.position.clone().applyQuaternion(q)
          for (let i = 0; i < positions.count; i++) {
            vertex.fromBufferAttribute(positions, i).multiplyScalar(scale).applyQuaternion(q)
            projected[i * 2] = vertex.x + offset.x; projected[i * 2 + 1] = vertex.y + offset.y
          }
          // Support bounds test the complete convex silhouette in every screen
          // direction, including opposite profiles and rolled/pitched views.
          for (const direction of directions) {
            let support = -Infinity
            for (let i = 0; i < positions.count; i++) support = Math.max(support, projected[i * 2]! * direction.x + projected[i * 2 + 1]! * direction.y)
            const gap = support - center.x * direction.x - center.y * direction.y - radius
            if (gap < minimum) { minimum = gap; worst = `${JSON.stringify(rotation)}, direction ${direction.x.toFixed(3)},${direction.y.toFixed(3)}` }
          }
        }
        expect(minimum, `Minimum inset gap ${minimum} at ${worst}`).toBeGreaterThan(.005)
      } finally { inset.dispose(); disposeSkeleton(skeleton) }
    })

    it(`cuts three openings with shaded rims and concave closed backing into the ${shape} skull`, () => {
      const skeleton = roundedSkeletonGeometry(shape)
      try {
        skeleton.updateMatrixWorld(true)
        const skull = skeleton.getObjectByName('skull') as THREE.Mesh
        for (const name of ['socket-left', 'socket-right', 'nose']) {
          const patch = skeleton.getObjectByName(name) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial[]>
          const rim = skeleton.getObjectByName(`${name}-rim`) as typeof patch
          expect(patch.userData.skullLayer).toBe(0); expect(rim.userData.skullLayer).toBe(1)
          expect(patch.userData.surfaceOverlay).toBeUndefined()
          for (const material of patch.material) {
            expect(material.type).toBe('MeshBasicMaterial')
            expect(material.map).toBeNull(); expect(material.depthTest).toBe(true)
          }
          const position = patch.geometry.attributes.position!
          // The center is physically deeper than the matching lip, so camera
          // rotation reveals thickness rather than a decal above the surface.
          const centerVertex = new THREE.Vector3().fromBufferAttribute(position, position.count - 1)
          const edgeVertex = new THREE.Vector3().fromBufferAttribute(position, 0).add(new THREE.Vector3().fromBufferAttribute(position, 40)).multiplyScalar(.5)
          expect(centerVertex.z).toBeLessThan(edgeVertex.z - radius * .03)
          const center = patch.getWorldPosition(new THREE.Vector3())
          // Offset slightly from the fan's duplicate central vertex.
          const x = center.x + .0001, y = center.y + .0001
          const frontRay = new THREE.Raycaster(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1))
          const backRay = new THREE.Raycaster(new THREE.Vector3(x, y, -2), new THREE.Vector3(0, 0, 1))
          expect(frontRay.intersectObject(skull, false)).toHaveLength(0)
          expect(frontRay.intersectObject(skull, true)[0]!.object).toBe(patch)
          expect(backRay.intersectObject(skull, true)[0]!.object).toBe(skull)
          // The recess closes the shell: rays across each opening always find
          // a backing surface, with no transparent pinholes around the rim.
          for (const offset of [-.7, 0, .7]) {
            const ray = new THREE.Raycaster(new THREE.Vector3(center.x + offset * radius * (name === 'nose' ? .05 : .24), center.y, 2), new THREE.Vector3(0, 0, -1))
            expect(ray.intersectObject(skull, true).length).toBeGreaterThan(0)
          }
        }
        expect(skeleton.getObjectByName('nose-left')).toBeUndefined()
        expect(skeleton.getObjectByName('nose-right')).toBeUndefined()
      } finally { disposeSkeleton(skeleton) }
    })

    it(`keeps all bones inside ${shape}, with ${shape === 'chunky-pill' ? 'six' : 'four'} thicker ribs below the skull`, () => {
      const skeleton = roundedSkeletonGeometry(shape)
      try {
        const rows = shape === 'chunky-pill' ? 3 : 2
        expect(skeleton.children.map(child => child.name)).toEqual(['skull', ...['left', 'right'].flatMap(side => Array.from({ length: rows }, (_, i) => `rib-${side}-${i + 1}`))])
        skeleton.updateMatrixWorld(true)
        const skull = skeleton.getObjectByName('skull') as THREE.Mesh
        const center = skull.getWorldPosition(new THREE.Vector3()), ribs: THREE.Mesh<THREE.TubeGeometry>[] = []
        skeleton.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return
          const isRib = object.parent?.name.startsWith('rib-') ?? false
          if (object.name.startsWith('rib-') && object.geometry instanceof THREE.TubeGeometry) ribs.push(object)
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            expect(material.transparent).toBe(true); expect(material.opacity).toBe(1); expect(material.depthWrite).toBe(true)
          }
          const vertices = object.geometry.attributes.position!
          for (let i = 0; i < vertices.count; i++) {
            const p = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(object.matrixWorld)
            expect([p.x, p.y, p.z].every(Number.isFinite)).toBe(true)
            expect(Math.abs(p.y)).toBeLessThan(shape === 'cap' ? .5 : .75)
            expect(Math.hypot(p.x, p.z)).toBeLessThan(radiusAt(shape, p.y))
            if (isRib) expect(p.distanceTo(center)).toBeGreaterThan(radius)
          }
        })
        expect(ribs).toHaveLength(rows * 2)
        for (const rib of ribs) {
          expect(rib.geometry.parameters.radius).toBe(.032)
          const direction = rib.name.includes('left') ? -1 : 1, row = Number(rib.name.slice(-1)) - 1
          const top = shape === 'chunky-pill' ? -.19 - row * .15 : -.21 - row * .122, width = shape === 'chunky-pill' ? 1.12 : 1
          const previous = new THREE.CubicBezierCurve3(
            new THREE.Vector3(direction * .065, top - .039, .13),
            new THREE.Vector3(direction * .15 * width, top - .055, .16),
            new THREE.Vector3(direction * .255 * width, top - .047, .11),
            new THREE.Vector3(direction * (.32 - row * .025) * width, top + .006, .035),
          )
          const current = rib.geometry.parameters.path
          expect(current.getLength() / previous.getLength()).toBeCloseTo(.5, 5)
          const previousGap = (shape === 'cap' ? [.121, .119125] : [.134815, .132715, .130615])[row]!
          expect(current.getPoint(.5).x).toBeCloseTo(previous.getPoint(.5).x * .8 - direction * previousGap / 4, 5)
          expect(current.getPoint(.5).y).toBeCloseTo(previous.getPoint(.5).y - (shape === 'cap' ? row === 0 ? .05 : .025 : 0), 5)
          expect(current.getPoint(.5).z).toBeCloseTo(previous.getPoint(.5).z, 5)
        }
        for (const row of Array.from({ length: rows }, (_, i) => i + 1)) {
          const left = new THREE.Box3().setFromObject(skeleton.getObjectByName(`rib-left-${row}`)!)
          const right = new THREE.Box3().setFromObject(skeleton.getObjectByName(`rib-right-${row}`)!)
          const previousGap = (shape === 'cap' ? [.121, .119125] : [.134815, .132715, .130615])[row - 1]!
          expect(right.min.x - left.max.x).toBeCloseTo(previousGap / (shape === 'chunky-pill' ? 4 : 2), 5)
          expect(right.min.x).toBeCloseTo(-left.max.x, 5)
        }
      } finally { disposeSkeleton(skeleton) }
    })
  }
})


it('halves the chunky-pill vertical air gaps and tapers the six ribs from top to bottom', () => {
  const skeleton = roundedSkeletonGeometry('chunky-pill')
  try {
    for (const side of ['left', 'right']) {
      const ribs = [1, 2, 3].map(row => skeleton.getObjectByName(`rib-${side}-${row}`)!)
      const boxes = ribs.map(rib => new THREE.Box3().setFromObject(rib))
      for (let row = 1; row < 3; row++) {
        const previous = boxes[row - 1]!, current = boxes[row]!
        const gap = previous.min.y - current.max.y
        const originalGap = previous.min.y - ribs[row - 1]!.position.y - (current.max.y - ribs[row]!.position.y)
        expect(gap).toBeGreaterThan(.01)
        expect(gap).toBeCloseTo(originalGap * .5, 6)
        expect(current.getSize(new THREE.Vector3()).x).toBeLessThan(previous.getSize(new THREE.Vector3()).x)
        expect(current.getSize(new THREE.Vector3()).x / previous.getSize(new THREE.Vector3()).x).toBeGreaterThan(.85)
      }
    }
  } finally { disposeSkeleton(skeleton) }
})
