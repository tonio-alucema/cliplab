import { describe, expect, it } from 'vitest'
import { bodyHeight, radiusAt } from './renderer'
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
