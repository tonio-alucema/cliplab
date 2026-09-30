import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { roundedSkeletonGeometry } from './rounded-skull'
import { bodyGeometry, disposeSkeleton, radiusAt } from './body-geometry'
import { toonLightOffset } from './renderer'

describe('spherical 3D skeleton', () => {
  for (const shape of ['cap', 'chunky-pill'] as const) {
    const radius = shape === 'cap' ? .3132 : .36
    it(`uses an undeformed perfect sphere with no jaw or teeth for ${shape}`, () => {
      const skeleton = roundedSkeletonGeometry(shape)
      try {
        const skull = skeleton.getObjectByName('skull') as THREE.Mesh<THREE.SphereGeometry>
        const size = skull.geometry.boundingBox!.getSize(new THREE.Vector3())
        expect(size.x).toBeCloseTo(radius * 2); expect(size.y).toBeCloseTo(size.x); expect(size.z).toBeCloseTo(size.x)
        const vertices = skull.geometry.attributes.position!
        for (let i = 0; i < vertices.count; i++) expect(new THREE.Vector3().fromBufferAttribute(vertices, i).length()).toBeCloseTo(radius, 6)
        expect(skull.children.map(child => child.name)).toEqual(['socket-left', 'socket-right', 'nose-left', 'nose-right'])
        expect(skeleton.getObjectByName('rounded-jaw')).toBeUndefined()
        expect(skeleton.getObjectByName('tooth')).toBeUndefined()
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

    it(`maps smooth two-tone marks onto the surface and hides them behind the ${shape} skull`, () => {
      const skeleton = roundedSkeletonGeometry(shape)
      try {
        skeleton.updateMatrixWorld(true)
        const skull = skeleton.getObjectByName('skull') as THREE.Mesh<THREE.SphereGeometry>
        for (const mark of skull.children as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[]) {
          expect(mark.userData.surfaceOverlay).toBe(true)
          expect(mark.material.type).toBe('MeshBasicMaterial')
          expect(mark.material.color.getHexString()).toBe('b8a979')
          expect(mark.material.map).toBeNull(); expect(mark.material.depthTest).toBe(true)
          const position = mark.geometry.attributes.position!
          for (let i = 0; i < position.count; i++) {
            const p = new THREE.Vector3().fromBufferAttribute(position, i).add(mark.position)
            expect(p.length()).toBeGreaterThan(radius)
            expect(p.length()).toBeLessThan(radius + .002)
          }
          // A forward ray hits the marking before the bone; a rear ray hits the
          // sphere first, proving these markings are not camera-facing overlays.
          const center = mark.getWorldPosition(new THREE.Vector3())
          const frontRay = new THREE.Raycaster(new THREE.Vector3(center.x, center.y, 2), new THREE.Vector3(0, 0, -1))
          const backRay = new THREE.Raycaster(new THREE.Vector3(center.x, center.y, -2), new THREE.Vector3(0, 0, 1))
          expect(frontRay.intersectObjects([skull, mark], false)[0]!.object).toBe(mark)
          expect(backRay.intersectObjects([skull, mark], false)[0]!.object).toBe(skull)
        }
      } finally { disposeSkeleton(skeleton) }
    })

    it(`keeps all bones inside ${shape}, with exactly four thicker ribs below the sphere`, () => {
      const skeleton = roundedSkeletonGeometry(shape)
      try {
        expect(skeleton.children.map(child => child.name)).toEqual(['skull', 'rib-left-1', 'rib-left-2', 'rib-right-1', 'rib-right-2'])
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
        expect(ribs).toHaveLength(4)
        for (const rib of ribs) {
          expect(rib.geometry.parameters.radius).toBe(.032)
          const direction = rib.name.includes('left') ? -1 : 1, row = rib.name.endsWith('2') ? 1 : 0
          const top = shape === 'chunky-pill' ? -.19 - row * .15 : -.21 - row * .122, width = shape === 'chunky-pill' ? 1.12 : 1
          const previous = new THREE.CubicBezierCurve3(
            new THREE.Vector3(direction * .065, top - .039, .13),
            new THREE.Vector3(direction * .15 * width, top - .055, .16),
            new THREE.Vector3(direction * .255 * width, top - .047, .11),
            new THREE.Vector3(direction * (.32 - row * .025) * width, top + .006, .035),
          )
          const current = rib.geometry.parameters.path
          expect(current.getLength() / previous.getLength()).toBeCloseTo(.5, 5)
          const previousGap = (shape === 'cap' ? [.121, .119125] : [.134815, .132715])[row]!
          expect(current.getPoint(.5).x).toBeCloseTo(previous.getPoint(.5).x * .8 - direction * previousGap / 4, 5)
          expect(current.getPoint(.5).y).toBeCloseTo(previous.getPoint(.5).y - (shape === 'cap' ? row === 0 ? .05 : .025 : 0), 5)
          expect(current.getPoint(.5).z).toBeCloseTo(previous.getPoint(.5).z, 5)
        }
        for (const row of [1, 2]) {
          const left = new THREE.Box3().setFromObject(skeleton.getObjectByName(`rib-left-${row}`)!)
          const right = new THREE.Box3().setFromObject(skeleton.getObjectByName(`rib-right-${row}`)!)
          const previousGap = (shape === 'cap' ? [.121, .119125] : [.134815, .132715])[row - 1]!
          expect(right.min.x - left.max.x).toBeCloseTo(previousGap / 2, 5)
          expect(right.min.x).toBeCloseTo(-left.max.x, 5)
        }
      } finally { disposeSkeleton(skeleton) }
    })
  }
})
