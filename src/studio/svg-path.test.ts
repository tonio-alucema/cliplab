import { describe, expect, it } from 'vitest'
import { boundaryContours, flatten, pathData, strokeOutline, type Point } from './svg-path'
const area = (points: Point[]) => points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]!; return sum + p.x * q.y - p.y * q.x }, 0) / 2

describe('compact vector outlines', () => {
  it('removes every interior triangle edge while preserving holes and disconnected regions', () => {
    const triangles: Point[][] = []
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) {
      if (x === 1 && y === 1) continue
      const a = { x, y }, b = { x: x + 1, y }, c = { x: x + 1, y: y + 1 }, d = { x, y: y + 1 }
      triangles.push([a, b, c], [a, c, d])
    }
    triangles.push([{ x: 5, y: 0 }, { x: 6, y: 0 }, { x: 5, y: 1 }])
    const outlines = boundaryContours(triangles)
    expect(outlines).toHaveLength(3)
    expect(outlines.reduce((sum, c) => sum + area(c.points), 0)).toBeCloseTo(8.5)
    expect(outlines.some(c => area(c.points) < 0)).toBe(true)
  })
  it('preserves round stroke width and end caps when converting a line to an outline', () => {
    const [outline] = strokeOutline({ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], closed: false }, 20)
    expect(Math.min(...outline!.points.map(p => p.x))).toBeCloseTo(-10, 1)
    expect(Math.max(...outline!.points.map(p => p.x))).toBeCloseTo(110, 1)
    expect(Math.min(...outline!.points.map(p => p.y))).toBe(-10)
    expect(Math.max(...outline!.points.map(p => p.y))).toBe(10)
    expect(Math.abs(area(outline!.points))).toBeCloseTo(2000 + Math.PI * 100, -1)
  })
  it('retains nonlinear curvature even on originally straight path edges', () => {
    const straight = flatten([{ op: 'M', points: [0, 0] }, { op: 'L', points: [100, 0] }])
    const warped = pathData(straight, p => ({ x: p.x, y: Math.sin(p.x / 100 * Math.PI) * 20 }))
    expect((warped.match(/L/g) ?? []).length).toBeGreaterThan(8)
    expect(warped).toContain('50 20')
  })
})
