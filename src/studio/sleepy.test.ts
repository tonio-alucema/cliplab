import { expect, it } from 'vitest'
import { droolAnchor, mouthGeometry, blendContours } from './face-morph'
import { BASE_POSE, faceLayers } from './model'
import { drawProp } from './renderer'
it('anchors drool at the lower-right lip as the sleepy mouth opens and morphs', () => {
  const sleep = { ...BASE_POSE, mouth: 'sleep' as const, drool: true }, oh = { ...sleep, mouth: 'oh' as const, mouthOpen: .25, mouthWidth: .65 }
  const open = mouthGeometry(oh), anchor = droolAnchor(open.outline, open.width)
  const radius = 51 * oh.mouthWidth * (.55 + .3 * oh.mouthOpen) + 17 * oh.mouthStroke / 2
  expect(anchor.x).toBeGreaterThan(0)
  expect(Math.abs(anchor.y - (14 + Math.sqrt(radius * radius - anchor.x * anchor.x) + 6))).toBeLessThan(.6)
  let previous = droolAnchor(mouthGeometry(sleep).outline, mouthGeometry(sleep).width)
  for (let i = 1; i <= 60; i++) {
    const weight = i / 60, pose = { ...sleep, mouthOpen: sleep.mouthOpen + (oh.mouthOpen - sleep.mouthOpen) * weight, mouthWidth: sleep.mouthWidth + (oh.mouthWidth - sleep.mouthWidth) * weight }
    const closed = mouthGeometry(pose), opened = mouthGeometry({ ...pose, mouth: 'oh' })
    const layers = [{ traits: faceLayers(sleep)[0]!.traits, weight: 1 - weight }, { traits: faceLayers(oh)[0]!.traits, weight }]
    const point = droolAnchor(blendContours([closed.outline, opened.outline], layers), closed.width * (1 - weight) + opened.width * weight)
    expect(point.x).toBeGreaterThan(0); expect(Math.abs(point.y - previous.y)).toBeLessThan(2)
    previous = point
  }
  expect(previous.y).toBeGreaterThan(droolAnchor(mouthGeometry(sleep).outline, mouthGeometry(sleep).width).y + 20)
})
it('drifts the sleep marks outward and upward while retaining their eased loop', () => {
  const positions = (phase: number) => {
    const result: number[][] = []
    const ctx = new Proxy({}, { get: (_, key) => key === 'translate' ? (...p: number[]) => result.push(p) : () => {}, set: () => true }) as CanvasRenderingContext2D
    drawProp(ctx, 'zzz', '#ffd362', phase); return result
  }
  const early = positions(.05)[0]!, later = positions(.5)[0]!
  expect(later[0]! - early[0]!).toBeGreaterThan(8)
  expect(early[1]! - later[1]!).toBeGreaterThan(12)
  expect(positions(0)).toEqual(positions(1))
})
