import { describe, expect, it } from 'vitest'
import { bodyHeight, radiusAt, eyeRadius, effectEnvelope, drawFace } from './renderer'
import { BASE_POSE, defaultProject } from './model'
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
  function recordFace(gaze: { x: number; y: number }, overrides = {}, blink = 0, detail: 'full' | 'eyes' | 'body' = 'full') {
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
    drawFace(ctx, { ...BASE_POSE, ...overrides }, { ...defaultProject().characters[0]!, iris: true }, blink, detail, gaze)
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
