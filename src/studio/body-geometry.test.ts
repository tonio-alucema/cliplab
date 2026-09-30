import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { animateGhostGeometry, bodyGeometry, bodyDimensions, bodyHeight, bodyModification, bodySurfaceZ, disposeSkeleton, faceOffset, radiusAt, skeletonGeometry } from './body-geometry'
import { BASE_POSE, defaultProject } from './model'
import { faceForSize, projectedEye, resolveEyeGazes } from './renderer'

describe('body shape geometry and modifications', () => {
  it('gives chunky pill the requested 1:1.5 ratio with capsule curvature', () => {
    const geometry = bodyGeometry('chunky-pill')
    geometry.computeBoundingBox()
    const size = geometry.boundingBox!.getSize(new THREE.Vector3())
    expect(size.x).toBeCloseTo(1); expect(size.y).toBeCloseTo(1.5); expect(size.z).toBeCloseTo(1)
    expect(bodyHeight('chunky-pill')).toBe(1.5)
    expect(radiusAt('chunky-pill', .25)).toBe(.5)
    expect(radiusAt('chunky-pill', .75)).toBe(0)
    expect(faceOffset('chunky-pill')).toBeCloseTo(-.07)
    geometry.dispose()
  })

  it('flips only the end-cap surface and keeps its facial projection upright', () => {
    const normal = bodyGeometry('cap'), flipped = bodyGeometry('cap', false, 'upside-down')
    const before = normal.attributes.position!, after = flipped.attributes.position!
    for (let i = 0; i < before.count; i += 43) {
      expect(after.getY(i)).toBeCloseTo(-before.getY(i)); expect(after.getZ(i)).toBeCloseTo(before.getZ(i))
    }
    expect(radiusAt('cap', .35, 'upside-down')).toBe(.5)
    expect(radiusAt('cap', -.35, 'upside-down')).toBeCloseTo(radiusAt('cap', .35))
    const character = { ...defaultProject().characters[0]!, shape: 'cap' as const, bodyModification: 'upside-down' as const }
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 30); camera.position.z = 8; camera.updateMatrixWorld()
    const left = projectedEye(character, BASE_POSE, 0, -1, new THREE.Matrix4(), camera)
    const right = projectedEye(character, BASE_POSE, 0, 1, new THREE.Matrix4(), camera)
    expect(left.center.x).toBeLessThan(right.center.x); expect(left.up.y).toBeGreaterThan(left.center.y)
    normal.dispose(); flipped.dispose()
  })

  it('animates a bounded travelling ghost hem without replacing buffers, and loops seamlessly', () => {
    const geometry = bodyGeometry('cap', false, 'ghost'), position = geometry.attributes.position!
    const start = Float32Array.from(position.array), sameBuffer = position.array
    animateGhostGeometry(geometry, .25)
    let changedHem = 0
    for (let i = 0; i < position.count; i++) {
      expect(Number.isFinite(position.getY(i))).toBe(true)
      expect(position.getY(i)).toBeGreaterThanOrEqual(-.50001)
      expect(position.getY(i)).toBeLessThanOrEqual(.50001)
      if (start[i * 3 + 1]! > -.27) expect(position.getY(i)).toBe(start[i * 3 + 1])
      else if (Math.abs(position.getY(i) - start[i * 3 + 1]!) > .001) changedHem++
    }
    expect(changedHem).toBeGreaterThan(100)
    expect(position.array).toBe(sameBuffer)
    animateGhostGeometry(geometry, 1)
    for (let i = 0; i < start.length; i++) expect(position.array[i]).toBeCloseTo(start[i]!, 6)
    geometry.dispose()
  })

  it('restricts modifications to end caps', () => {
    for (const shape of ['capsule', 'chunky-pill', 'sphere'] as const) {
      expect(bodyModification({ shape, bodyModification: 'ghost' })).toBe('none')
      const a = bodyGeometry(shape), b = bodyGeometry(shape, false, 'upside-down')
      expect(a.attributes.position!.array).toEqual(b.attributes.position!.array)
      a.dispose(); b.dispose()
    }
    expect(bodyModification({ shape: 'cap' })).toBe('none')
  })

  it('turns only the requested body profiles and measures horizontal pills by their long edge', () => {
    for (const shape of ['capsule', 'chunky-pill'] as const) {
      const geometry = bodyGeometry(shape, false, 'horizontal'); geometry.computeBoundingBox()
      const size = geometry.boundingBox!.getSize(new THREE.Vector3()), dimensions = bodyDimensions(shape, 'horizontal')
      expect(size.x).toBeCloseTo(bodyHeight(shape)); expect(size.y).toBeCloseTo(1); expect(size.z).toBeCloseTo(1)
      expect(dimensions).toEqual({ width: bodyHeight(shape), height: 1, depth: 1 })
      expect(bodyModification({ shape, bodyModification: 'horizontal' })).toBe('horizontal')
      expect(bodyModification({ shape, bodyModification: 'rotate-left' })).toBe('none')
      geometry.dispose()
    }
    expect(bodyModification({ shape: 'cap', bodyModification: 'horizontal' })).toBe('none')
    for (const modification of ['rotate-left', 'rotate-right'] as const) {
      const geometry = bodyGeometry('cap', false, modification), positions = geometry.attributes.position!
      const extrema = modification === 'rotate-left' ? Math.min : Math.max
      const roundEnd = extrema(...Array.from({ length: positions.count }, (_, i) => positions.getX(i)))
      expect(roundEnd).toBeCloseTo(modification === 'rotate-left' ? -.5 : .5)
      expect(bodySurfaceZ('cap', modification === 'rotate-left' ? -.45 : .45, 0, modification)).toBeCloseTo(Math.sqrt(.25 - .45 ** 2))
      expect(bodySurfaceZ('cap', modification === 'rotate-left' ? .3 : -.3, 0, modification)).toBeCloseTo(.5)
      geometry.dispose()
    }
  })

  it('projects the upright face onto actual quarter-turned body geometry', () => {
    const cases = [
      { shape: 'cap', mod: 'rotate-left' }, { shape: 'cap', mod: 'rotate-right' },
      { shape: 'capsule', mod: 'horizontal' }, { shape: 'chunky-pill', mod: 'horizontal' },
    ] as const
    for (const { shape, mod } of cases) {
      const geometry = bodyGeometry(shape, false, mod), material = new THREE.MeshBasicMaterial(), body = new THREE.Mesh(geometry, material)
      body.updateMatrixWorld(true)
      for (const [x, y] of [[-.21, .09], [.21, -.09], [0, .17]]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 3), new THREE.Vector3(0, 0, -1))
        const hits = ray.intersectObject(body)
        expect(hits.length).toBeGreaterThan(0)
        expect(bodySurfaceZ(shape, x!, y!, mod)).toBeCloseTo(hits[0]!.point.z, 2)
      }
      const character = { ...defaultProject().characters[0]!, shape, bodyModification: mod }
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 30); camera.position.z = 8; camera.updateMatrixWorld()
      const transform = new THREE.Matrix4().makeRotationY(.2)
      const left = projectedEye(character, BASE_POSE, 0, -1, transform, camera), right = projectedEye(character, BASE_POSE, 0, 1, transform, camera)
      expect(left.center.x).toBeLessThan(right.center.x); expect(left.up.y).toBeGreaterThan(left.center.y)
      const mid = left.center.clone().add(right.center).multiplyScalar(.5)
      const gaze = resolveEyeGazes(character, BASE_POSE, 0, transform, camera, { x: 0, y: 0 }, { ...mid, weight: 1 })
      expect(gaze.left.x).toBeGreaterThan(0); expect(gaze.right.x).toBeLessThan(0)
      geometry.dispose(); material.dispose()
    }
    expect(bodySurfaceZ('capsule', .9, .4, 'horizontal')).toBeUndefined()
    expect(bodySurfaceZ('capsule', .8, .2, 'horizontal')).toBeCloseTo(Math.sqrt(.25 - .3 ** 2 - .2 ** 2))
  })

  it('keeps horizontal compact faces centered vertically with the same size constraints', () => {
    const character = { ...defaultProject().characters[0]!, shape: 'capsule' as const, bodyModification: 'horizontal' as const }
    const sample = { pose: { ...BASE_POSE }, blink: 0, bob: 0, breathe: 0, expressionId: 'idle', beatIndex: 0, stepIndex: 0 }
    const tiny = faceForSize(character, sample, 32)
    expect(faceOffset(character.shape, character.bodyModification)).toBe(-.025)
    expect(tiny.sample.pose.faceY).toBeCloseTo(BASE_POSE.faceY + .025)
    expect(tiny.character.trueFront).toBe(true); expect(tiny.character.lockPosition).toBe(true)
    expect(tiny.character.bodyModification).toBe('horizontal')
    expect(tiny.character.iris).toBe(false)
  })

  it('builds an internal volumetric skull with genuine openings and exactly four ribs', () => {
    const skeleton = skeletonGeometry()
    expect(skeleton.children.map(child => child.name)).toEqual(['skull', 'rib-left-1', 'rib-left-2', 'rib-right-1', 'rib-right-2'])
    const skull = skeleton.getObjectByName('skull') as THREE.Mesh<THREE.ExtrudeGeometry>
    expect((skull.geometry.parameters.shapes as THREE.Shape).holes).toHaveLength(3)
    skull.geometry.computeBoundingBox()
    expect(skull.geometry.boundingBox!.getSize(new THREE.Vector3()).z).toBeGreaterThan(.20)
    skeleton.updateMatrixWorld(true)
    skeleton.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      const vertices = object.geometry.attributes.position!
      for (let i = 0; i < vertices.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(object.matrixWorld)
        expect(p.y).toBeGreaterThan(-.5); expect(p.y).toBeLessThan(.5)
        expect(Math.hypot(p.x, p.z)).toBeLessThan(radiusAt('cap', p.y))
      }
    })
    disposeSkeleton(skeleton)
  })
})
