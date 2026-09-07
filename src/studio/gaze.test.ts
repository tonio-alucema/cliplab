import { describe, expect, it } from 'vitest'
import { easeGaze, easePointer, irisOffset, pointerGaze, pointerLook } from './gaze'

describe('cursor gaze', () => {
  it('retains precise canvas positions at small sizes and fades tracking without moving the target', () => {
    const target = pointerLook({ clientX: 118, clientY: 212 }, { left: 100, top: 200, width: 24, height: 24 })
    expect(target).toEqual({ x: .5, y: 0, weight: 1 })
    const outside = pointerLook({ clientX: 172, clientY: 212 }, { left: 100, top: 200, width: 24, height: 24 })
    expect(outside.x).toBe(5)
    const leaving = easePointer(target, { ...target, weight: 0 }, .05)
    expect(leaving.x).toBe(target.x); expect(leaving.y).toBe(target.y)
    expect(leaving.weight).toBeGreaterThan(0); expect(leaving.weight).toBeLessThan(1)
    expect(easePointer(leaving, { ...target, weight: 0 }, 1).weight).toBe(0)
  })
  it('uses the actual canvas center and limits far-away pointers to a circular range', () => {
    const bounds = { left: 430, top: 170, width: 24, height: 24 }
    expect(pointerGaze({ clientX: 442, clientY: 182 }, bounds)).toEqual({ x: 0, y: -0 })
    const far = pointerGaze({ clientX: 3000, clientY: -400 }, bounds)
    expect(far.x).toBeGreaterThan(0); expect(far.y).toBeGreaterThan(0)
    expect(Math.hypot(far.x, far.y)).toBeCloseTo(1)
  })

  it('eases without overshooting and gives the same result at different frame rates', () => {
    const target = { x: .7, y: -.4 }
    const atRate = (fps: number) => {
      let current = { x: 0, y: 0 }
      for (let i = 0; i < fps / 4; i++) current = easeGaze(current, target, 1 / fps)
      return current
    }
    const slow = atRate(60), fast = atRate(120)
    expect(slow.x).toBeGreaterThan(0); expect(slow.x).toBeLessThan(target.x)
    expect(slow.x).toBeCloseTo(fast.x, 8); expect(slow.y).toBeCloseTo(fast.y, 8)
    expect(easeGaze(slow, { x: 0, y: 0 }, 1)).toEqual({ x: 0, y: 0 })
    expect(easeGaze(slow, target, 0, true)).toEqual(target)
  })

  it('keeps the entire dot inside differently sized eyes, including diagonal and combined pose gaze', () => {
    for (const radius of [4, 12, 32.4, 80]) for (const x of [-2, -1, 0, 1, 2]) for (const y of [-2, -1, 0, 1, 2]) {
      const dot = irisOffset(radius, { x, y }, 37)
      expect(Math.hypot(dot.x, dot.y) + radius * .28).toBeLessThanOrEqual(radius * .901)
    }
  })

  it('compensates eye rotation so the dot still moves toward the pointer', () => {
    const right = irisOffset(30, { x: 1, y: 0 }, 90)
    expect(right.x).toBeCloseTo(0); expect(right.y).toBeLessThan(-15)
    const up = irisOffset(30, { x: 0, y: 1 })
    expect(up.x).toBe(0); expect(up.y).toBeLessThan(-15)
  })

  it('keeps the full white dot clear of cheek cutouts when looking down or diagonally', () => {
    for (const radius of [10, 32.4, 80]) for (const rotation of [-90, 0, 45, 90]) for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) {
      const dot = irisOffset(radius, { x, y }, rotation, true)
      expect(Math.hypot(dot.x, dot.y) + radius * .28).toBeLessThan(radius)
      expect(Math.hypot(dot.x, dot.y - radius * 1.13) - radius * .28).toBeGreaterThan(radius * .82)
    }
  })
})
