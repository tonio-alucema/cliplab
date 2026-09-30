import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { roundedSkeletonGeometry } from './rounded-skull'
import { disposeSkeleton, radiusAt } from './body-geometry'

describe('spherical 3D skeleton', () => {
  for (const shape of ['cap', 'chunky-pill'] as const) {
    const radius = shape === 'cap' ? .348 : .40
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
            expect(Math.hypot(p.x, p.z)).toBeLessThan(radiusAt(shape, p.y))
            if (isRib) expect(p.distanceTo(center)).toBeGreaterThan(radius)
          }
        })
        expect(ribs).toHaveLength(4)
        for (const rib of ribs) expect(rib.geometry.parameters.radius / .026).toBeCloseTo(1.23, 2)
      } finally { disposeSkeleton(skeleton) }
    })
  }
})
