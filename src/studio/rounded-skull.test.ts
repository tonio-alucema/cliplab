import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { roundedSkeletonGeometry } from './rounded-skull'
import { disposeSkeleton, radiusAt } from './body-geometry'

describe('rounded 3D skeleton', () => {
  it('has a round dome, actual recessed sockets and nose, and a separate jaw with tooth lobes', () => {
    const skeleton = roundedSkeletonGeometry()
    try {
      skeleton.updateMatrixWorld(true)
      const skull = skeleton.getObjectByName('skull') as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial[]>
      expect(skull.geometry.type).toBe('SphereGeometry')
      expect(skull.geometry.groups).toHaveLength(2)
      expect(skull.geometry.groups.reduce((total, group) => total + group.count, 0)).toBe(skull.geometry.index!.count)
      const size = skull.geometry.boundingBox!.getSize(new THREE.Vector3())
      expect(size.z).toBeGreaterThan(.44)
      expect(size.z / size.x).toBeGreaterThan(.75)
      const front = (x: number, y: number) => new THREE.Raycaster(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1)).intersectObject(skull, false)[0]!
      const rear = (y: number) => new THREE.Raycaster(new THREE.Vector3(0, y, -2), new THREE.Vector3(0, 0, 1)).intersectObject(skull, false)[0]!
      // Both sides have a curved dome rather than parallel extrusion planes.
      expect(front(0, .14).point.z - front(0, .36).point.z).toBeGreaterThan(.10)
      expect(rear(.36).point.z - rear(.14).point.z).toBeGreaterThan(.10)
      for (const x of [-.115, .115]) {
        expect(front(x, .024).point.z).toBeLessThan(.11)
        expect(front(x, .024).face!.materialIndex).toBe(1)
        expect(front(Math.sign(x) * .20, .024).point.z).toBeGreaterThan(front(x, .024).point.z + .025)
      }
      expect(front(0, -.047).point.z).toBeLessThan(.10)
      expect(front(0, -.047).face!.materialIndex).toBe(1)
      expect(skull.getObjectByName('rounded-jaw')).toBeDefined()
      expect(skull.children.filter(child => child.name === 'tooth')).toHaveLength(3)
    } finally { disposeSkeleton(skeleton) }
  })

  it('keeps all volumetric bones inside the end-cap shell and has exactly four thicker ribs', () => {
    const skeleton = roundedSkeletonGeometry()
    try {
      expect(skeleton.children.map(child => child.name)).toEqual(['skull', 'rib-left-1', 'rib-left-2', 'rib-right-1', 'rib-right-2'])
      skeleton.updateMatrixWorld(true)
      const ribs: THREE.Mesh<THREE.TubeGeometry>[] = []
      skeleton.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return
        if (object.name.startsWith('rib-') && object.geometry instanceof THREE.TubeGeometry) ribs.push(object)
        expect(object.material).not.toBeUndefined()
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          expect(material.transparent).toBe(true); expect(material.opacity).toBe(1); expect(material.depthWrite).toBe(true)
          expect(material.map).toBeNull()
        }
        const vertices = object.geometry.attributes.position!
        for (let i = 0; i < vertices.count; i++) {
          const p = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(object.matrixWorld)
          expect([p.x, p.y, p.z].every(Number.isFinite)).toBe(true)
          expect(p.y).toBeGreaterThan(-.43); expect(p.y).toBeLessThan(.43)
          expect(Math.hypot(p.x, p.z)).toBeLessThan(radiusAt('cap', p.y))
        }
      })
      expect(ribs).toHaveLength(4)
      for (const rib of ribs) expect(rib.geometry.parameters.radius / .026).toBeCloseTo(1.23, 2)
    } finally { disposeSkeleton(skeleton) }
  })
})
