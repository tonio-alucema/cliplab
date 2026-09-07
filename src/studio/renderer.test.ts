import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { bodyHeight, radiusAt, eyeRadius, effectEnvelope, drawFace, projectedEye, resolveEyeGazes } from './renderer'
import { BASE_POSE, defaultProject } from './model'
import type { EyeGazes } from './gaze'
describe('independent eye focus', () => {
  const character = { ...defaultProject().characters[0]!, iris: true }
  function rig(aspect = 1, zoom = 1) {
    const camera = new THREE.OrthographicCamera(-aspect / zoom, aspect / zoom, 1 / zoom, -1 / zoom, .1, 30)
    camera.position.z = 8; camera.updateMatrixWorld(true)
    return camera
  }
  it('converges between the eyes, centers under the pointer, and responds to fine movements', () => {
    const camera = rig(), matrix = new THREE.Matrix4()
    const left = projectedEye(character, BASE_POSE, 0, -1, matrix, camera), right = projectedEye(character, BASE_POSE, 0, 1, matrix, camera)
    const midpoint = left.center.clone().add(right.center).multiplyScalar(.5)
    const focus = (point: { x: number; y: number }) => resolveEyeGazes(character, BASE_POSE, 0, matrix, camera, { x: 0, y: 0 }, { ...point, weight: 1 })
    const crossed = focus(midpoint)
    expect(crossed.left.x).toBeGreaterThan(.8); expect(crossed.right.x).toBeLessThan(-.8)
    expect(crossed.left.y).toBeCloseTo(0); expect(crossed.right.y).toBeCloseTo(0)
    const overLeft = focus(left.center)
    expect(overLeft.left.x).toBeCloseTo(0); expect(overLeft.left.y).toBeCloseTo(0); expect(overLeft.right.x).toBeLessThan(-.9)
    const near = left.center.clone().lerp(left.right, .1)
    const moved = focus(near).left
    expect(moved.x).toBeGreaterThan(.05); expect(moved.x).toBeLessThan(.15)
    const idle = resolveEyeGazes(character, BASE_POSE, 0, matrix, camera, { x: 0, y: 0 }, { x: 0, y: 0, weight: 0 })
    expect(idle.left.x).toBeCloseTo(0); expect(idle.right.x).toBeCloseTo(0)
  })
  it('aims toward the actual pointer across body shapes, camera framing, eye offsets and rotation', () => {
    for (const shape of ['capsule', 'cap', 'sphere'] as const) for (const zoom of [.7, 1.4]) {
      const body = { ...character, shape, elevated: true, elevation: .08 }
      const pose = { ...BASE_POSE, faceScale: .8, faceY: .12, eyeTilt: 20, leftX: -12, rightY: 18, rightRotation: -35, eyeHeight: .7 }
      const root = new THREE.Group(); root.rotation.set(.12, .35, .6); root.position.y = .06; root.scale.set(.96, 1.1, .96); root.updateMatrixWorld(true)
      const camera = rig(1.7, zoom)
      const a = projectedEye(body, pose, .2, -1, root.matrixWorld, camera), b = projectedEye(body, pose, .2, 1, root.matrixWorld, camera)
      const pointer = a.center.clone().add(b.center).multiplyScalar(.5)
      const eyes = resolveEyeGazes(body, pose, .2, root.matrixWorld, camera, { x: 0, y: 0 }, { ...pointer, weight: 1 })
      for (const [projection, look] of [[a, eyes.left], [b, eyes.right]] as const) {
        const screen = projection.right.clone().sub(projection.center).multiplyScalar(look.x).add(projection.up.clone().sub(projection.center).multiplyScalar(look.y))
        const toward = pointer.clone().sub(projection.center)
        expect(screen.x * toward.x + screen.y * toward.y).toBeGreaterThan(0)
        expect(screen.x * toward.y - screen.y * toward.x).toBeCloseTo(0, 8)
        expect(Math.hypot(look.x, look.y)).toBeLessThanOrEqual(1)
      }
    }
  })
})
describe('three requested body profiles', () => {
  it('keeps exact 1:2 and 1:1 outer dimensions', () => {
    expect(bodyHeight('capsule')).toBe(2)
    expect(bodyHeight('cap')).toBe(1)
    expect(bodyHeight('sphere')).toBe(1)
    for (const shape of ['capsule', 'cap', 'sphere'] as const) expect(radiusAt(shape, 0) * 2).toBe(1)
  })
  it('rounds the end-cap base into its straight side without losing the flat underside', () => {
    expect(radiusAt('cap', -.5)).toBeCloseTo(.43)
    expect(radiusAt('cap', -.43)).toBe(.5)
    expect(radiusAt('cap', -.49)).toBeGreaterThan(.43)
    expect(radiusAt('cap', -.49)).toBeLessThan(.5)
  })
  it('elevates the face in depth without changing its frontal coordinates', () => {
    const x = .16, y = -.05, s = 1.08
    for (const shape of ['capsule', 'cap', 'sphere'] as const) {
      const attached = Math.sqrt(radiusAt(shape, y) ** 2 - x ** 2)
      const elevated = Math.sqrt((s * radiusAt(shape, y / s)) ** 2 - x ** 2)
      expect(elevated).toBeGreaterThan(attached)
    }
  })
})
describe('illustrative face and supporting motion', () => {
  function recordFace(gaze: { x: number; y: number }, overrides = {}, blink = 0, detail: 'full' | 'eyes' | 'body' = 'full', eyeGazes?: EyeGazes) {
    const dots: number[][] = [], positions: number[][] = []
    let fillStyle = '', clips = 0
    const ctx = new Proxy({}, {
      get: (_, key) => {
        if (key === 'fillStyle') return fillStyle
        if (key === 'arc') return (...args: number[]) => { if (fillStyle === '#ffffff') dots.push(args) }
        if (key === 'translate') return (...args: number[]) => positions.push(args)
        if (key === 'clip') return () => clips++
        return () => {}
      },
      set: (_, key, value) => { if (key === 'fillStyle') fillStyle = value; return true }
    }) as CanvasRenderingContext2D
    drawFace(ctx, { ...BASE_POSE, ...overrides }, { ...defaultProject().characters[0]!, iris: true }, blink, detail, gaze, { eyeGazes })
    return { dots, positions, clips }
  }
  it('moves white dots within clipped eyes while keeping the eyes and mouth in place', () => {
    const left = recordFace({ x: -1, y: 0 }), right = recordFace({ x: 1, y: 0 })
    expect(left.positions).toEqual(right.positions)
    expect(left.dots).toHaveLength(2); expect(right.dots).toHaveLength(2)
    expect(left.dots[0]![0]).toBeLessThan(-15); expect(right.dots[0]![0]).toBeGreaterThan(15)
    expect(left.clips).toBeGreaterThanOrEqual(2)
    const authored = recordFace({ x: 0, y: 0 }, { gazeX: 1 })
    expect(authored.dots).toEqual(right.dots)
  })
  it('draws independent inward directions without adding shared gaze a second time', () => {
    const eyes = { left: { x: .9, y: 0 }, right: { x: -.9, y: 0 } }
    const crossed = recordFace({ x: 1, y: 1 }, { gazeX: 1, leftRotation: 45 }, 0, 'full', eyes)
    expect(crossed.dots).toHaveLength(2)
    expect(crossed.dots[0]![0]).toBeGreaterThan(15); expect(crossed.dots[1]![0]).toBeLessThan(-15)
    expect(crossed.dots[0]![1]).toBeCloseTo(0); expect(crossed.dots[1]![1]).toBeCloseTo(0)
  })
  it('hides white dots on closed eyes, during a blink, and at small app sizes', () => {
    expect(recordFace({ x: 1, y: 1 }, { eye: 'closed' }).dots).toHaveLength(0)
    expect(recordFace({ x: 1, y: 1 }, {}, .8).dots).toHaveLength(0)
    expect(recordFace({ x: 1, y: 1 }, {}, 0, 'eyes').dots).toHaveLength(0)
    expect(recordFace({ x: 1, y: 1 }, {}, 0, 'body').dots).toHaveLength(0)
    expect(recordFace({ x: 0, y: -1 }, { cheeks: true }).clips).toBeGreaterThanOrEqual(4)
  })
  it('enlarges both black eyes by exactly 20% when the iris is enabled', () => {
    const character = defaultProject().characters[0]!
    for (const side of [-1, 1]) for (const detail of ['full', 'eyes'] as const) {
      const pose = { ...BASE_POSE, leftScale: .8, rightScale: 1.1 }
      expect(eyeRadius(pose, { ...character, iris: true }, detail, side) / eyeRadius(pose, { ...character, iris: false }, detail, side)).toBeCloseTo(1.2, 10)
    }
  })
  it('eases supporting elements in and out without a visible loop seam', () => {
    expect(effectEnvelope(0)).toBe(0); expect(effectEnvelope(1)).toBe(0)
    expect(effectEnvelope(.3)).toBe(1)
    expect(effectEnvelope(.00001)).toBeLessThan(.000001)
    expect(effectEnvelope(.99999)).toBeLessThan(.000001)
    expect(effectEnvelope(.09)).toBeCloseTo(.5)
  })
})
