import { describe, expect, it } from 'vitest'
import { bodyHeight, radiusAt, eyeRadius, effectEnvelope } from './renderer'
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
