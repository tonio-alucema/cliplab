import { expect, it } from 'vitest'
import { particleCount, particleLayout } from './particles'
import { defaultProject, parseProject, PROPS } from './model'
import { copyBeatValues, pasteBeatValues } from './beat-values'

it('preserves original particle counts until a count is chosen', () => {
  expect(particleCount('none', 6)).toBe(0)
  expect(particleCount('zzz')).toBe(3)
  expect(particleCount('crown')).toBe(1)
  expect(particleCount('heart', 5)).toBe(5)
  expect(particleCount('heart', 20)).toBe(6)
})

it('adjusts size independently and lets outward movement stop or increase travel', () => {
  const base = particleLayout('heart', .4).particles[0]!
  expect(particleLayout('heart', .4, { propSize: 2 }).particles[0]!.scale).toBe(base.scale * 2)
  const stillA = particleLayout('heart', .2, { propOutward: 0 }).particles[0]!
  const stillB = particleLayout('heart', .6, { propOutward: 0 }).particles[0]!
  expect(stillA.x).toBe(stillB.x); expect(stillA.y).toBe(stillB.y)
  const far = particleLayout('heart', .4, { propOutward: 3 }).particles[0]!
  expect(far.x - stillA.x).toBeCloseTo((base.x - stillA.x) * 3)
  expect(far.y - stillA.y).toBeCloseTo((base.y - stillA.y) * 3)
})

it('keeps even maximum particles inside their padded texture for the whole cycle', () => {
  for (const prop of PROPS) for (const count of [1, 3, 6]) for (const phase of [undefined, 0, .25, .5, .75, .99]) {
    const { extent, particles } = particleLayout(prop, phase, { propSize: 2, propCount: count, propOutward: 3 })
    const radius = prop === 'crown' ? 100 : prop === 'question' ? 105 : prop === 'sweat' ? 80 : 48
    for (const p of particles) {
      expect(Math.abs(p.x - 128) + radius * p.scale).toBeLessThan(extent / 2)
      expect(Math.abs(p.y - 128) + radius * p.scale).toBeLessThan(extent / 2)
      expect(p.alpha).toBeGreaterThanOrEqual(0); expect(p.alpha).toBeLessThanOrEqual(1)
    }
  }
})

it('round-trips and copies per-beat settings, with defaults for older projects', () => {
  const project = defaultProject(), beat = project.expressions[0]!.beats[0]!
  Object.assign(beat.pose, { prop: 'heart', propSize: 1.8, propCount: 5, propOutward: 2.4 })
  const restored = parseProject(JSON.parse(JSON.stringify(project)))
  expect(restored.expressions[0]!.beats[0]!.pose).toEqual(beat.pose)
  const target = project.expressions[1]!.beats[0]!
  pasteBeatValues(target, 'Pose & props', copyBeatValues(beat, 'Pose & props'))
  expect(target.pose).toMatchObject({ prop: 'heart', propSize: 1.8, propCount: 5, propOutward: 2.4 })
  const legacy = JSON.parse(JSON.stringify(project))
  for (const key of ['propSize', 'propCount', 'propOutward']) delete legacy.expressions[0].beats[0].pose[key]
  expect(parseProject(legacy).expressions[0]!.beats[0]!.pose).toMatchObject({ propSize: 1, propCount: 0, propOutward: 1 })
})
