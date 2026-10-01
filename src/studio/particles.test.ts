import { expect, it } from 'vitest'
import { particleCount, particleLayout } from './particles'
import { defaultProject, parseProject, PROPS } from './model'
import { copyBeatValues, pasteBeatValues } from './beat-values'

it('preserves original particle counts until a count is chosen', () => {
  expect(particleCount('none', 6)).toBe(0)
  expect(particleCount('zzz')).toBe(3)
  expect(particleCount('question')).toBe(3)
  expect(particleCount('sparkle')).toBe(3)
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
  for (const prop of PROPS) for (const count of [1, 3, 6]) for (const phase of [undefined, ...Array.from({ length: 101 }, (_, i) => i / 100)]) {
    const { extent, particles, bounds } = particleLayout(prop, phase, { propSize: 2, propCount: count, propOutward: 3 })
    const radius = prop === 'crown' ? 100 : prop === 'question' ? 82 : prop === 'sparkle' ? 74 : prop === 'sweat' ? 80 : 48
    for (const p of particles) {
      expect(Math.abs(p.x - 128) + radius * p.scale).toBeLessThan(extent / 2)
      expect(Math.abs(p.y - 128) + radius * p.scale).toBeLessThan(extent / 2)
      expect(p.alpha).toBeGreaterThanOrEqual(0); expect(p.alpha).toBeLessThanOrEqual(1)
      expect(Number.isFinite(p.rotation)).toBe(true)
      if (bounds) {
        expect(p.x - radius * p.scale).toBeGreaterThanOrEqual(bounds.left)
        expect(p.x + radius * p.scale).toBeLessThanOrEqual(bounds.right)
        expect(p.y - radius * p.scale).toBeGreaterThanOrEqual(bounds.top)
        expect(p.y + radius * p.scale).toBeLessThanOrEqual(bounds.bottom)
      }
    }
  }
})

it('keeps questions circulating continuously with no empty interval', () => {
  for (let i = 0; i <= 1000; i++) {
    const particles = particleLayout('question', i / 1000).particles
    expect(particles).toHaveLength(3)
    expect(Math.max(...particles.map(p => p.alpha))).toBeGreaterThan(.5)
  }
  const near = particleLayout('question', .13, { propCount: 1 }).particles[0]!
  const far = particleLayout('question', .8, { propCount: 1 }).particles[0]!
  expect(far.x).toBeGreaterThan(near.x)
  expect(far.y).toBeLessThan(near.y)
  expect(far.scale).toBeGreaterThan(near.scale)
  expect(far.alpha).toBeLessThan(near.alpha)
})

it('launches stars in a compact burst and lets their movement settle during the slower fade', () => {
  expect(particleLayout('sparkle', .11).particles.every(p => p.alpha > .95)).toBe(true)
  const at = (prop: 'sparkle' | 'question', phase: number) => particleLayout(prop, phase, { propCount: 1 }).particles[0]!
  const starLaunch = at('sparkle', .2).x - at('sparkle', 0).x
  const questionLaunch = at('question', .2).x - at('question', 0).x
  expect(starLaunch).toBeGreaterThan(questionLaunch * 2)
  expect(at('sparkle', .2).x - at('sparkle', .1).x).toBeGreaterThan((at('sparkle', .8).x - at('sparkle', .7).x) * 4)
  expect(at('sparkle', .55).alpha).toBeGreaterThan(.4)
  expect(at('sparkle', .8).alpha).toBeGreaterThan(0)
  expect(at('sparkle', .95).alpha).toBe(0)
})

it('gives burst stars distinct sizes and divergent destinations instead of overlapping at full size', () => {
  for (const phase of [.5, .6, .7]) {
    const particles = particleLayout('sparkle', phase).particles
    for (let i = 1; i < particles.length; i++) {
      const near = particles[i - 1]!, far = particles[i]!
      expect(far.scale).toBeGreaterThan(near.scale)
      expect(far.x).toBeGreaterThan(near.x)
      expect(far.y).toBeLessThan(near.y)
      // The visible star silhouettes separate once the burst opens.
      expect(Math.hypot(far.x - near.x, far.y - near.y)).toBeGreaterThan(54 * (near.scale + far.scale))
    }
  }
})

it('exposes phase-independent directional framing bounds without adding symmetric empty space', () => {
  for (const prop of ['sparkle', 'question'] as const) {
    for (const propOutward of [0, 1, 3]) {
      const settings = { propOutward, propSize: 2, propCount: 6 }
      const first = particleLayout(prop, 0, settings)
      expect(first.bounds).toEqual(particleLayout(prop, .57, settings).bounds)
      expect(first.bounds).toEqual(particleLayout(prop, undefined, settings).bounds)
      expect(first.bounds!.left).toBeLessThan(first.bounds!.right)
      expect(first.bounds!.top).toBeLessThan(first.bounds!.bottom)
      expect(first.bounds!.left).toBeGreaterThan(128 - first.extent / 2)
      expect(first.bounds!.bottom).toBeLessThan(128 + first.extent / 2)
    }
  }
  expect(particleLayout('zzz').bounds).toBeUndefined()
})

it('keeps particle resets invisible and all loops deterministic when seeking', () => {
  for (const prop of ['question', 'sparkle'] as const) for (const count of [1, 3, 6]) {
    const settings = { propCount: count, propSize: 2, propOutward: 3 }
    for (let i = 0; i < count; i++) {
      const seam = prop === 'question' ? (1 - i / count) % 1 : i * .02
      const before = particleLayout(prop, seam - 1e-7, settings).particles[i]!
      const after = particleLayout(prop, seam + 1e-7, settings).particles[i]!
      expect(before.alpha).toBeLessThan(1e-8)
      expect(after.alpha).toBeLessThan(1e-8)
    }
    const frame = particleLayout(prop, .431, settings)
    expect(particleLayout(prop, .431, settings)).toEqual(frame)
    const nextLoop = particleLayout(prop, 1.431, settings)
    expect(nextLoop.extent).toBe(frame.extent)
    frame.particles.forEach((particle, i) => {
      for (const key of ['x', 'y', 'alpha', 'scale', 'rotation'] as const) expect(nextLoop.particles[i]![key]).toBeCloseTo(particle[key], 10)
    })
    expect(particleLayout(prop, 0, settings).extent).toBe(particleLayout(prop, undefined, settings).extent)
    expect(particleLayout(prop, .99, settings).extent).toBe(frame.extent)
  }
})

it('shows a small-to-large still trail and preserves size, count, and outward controls', () => {
  for (const prop of ['question', 'sparkle'] as const) {
    const still = particleLayout(prop).particles
    expect(still).toHaveLength(3)
    for (let i = 1; i < still.length; i++) {
      expect(still[i]!.x).toBeGreaterThan(still[i - 1]!.x)
      expect(still[i]!.y).toBeLessThan(still[i - 1]!.y)
      expect(still[i]!.scale).toBeGreaterThan(still[i - 1]!.scale)
      expect(still[i]!.alpha).toBe(1)
    }
    expect(new Set(still.map(p => p.rotation)).size).toBe(3)
    expect(particleLayout(prop, .3, { propCount: 6 }).particles).toHaveLength(6)
    const base = particleLayout(prop, .3).particles[0]!
    const big = particleLayout(prop, .3, { propSize: 2 }).particles[0]!
    expect(big.scale).toBe(base.scale * 2)
    expect(big.x).toBe(base.x); expect(big.y).toBe(base.y)
    const stopped = particleLayout(prop, .3, { propOutward: 0 }).particles[0]!
    const stoppedLater = particleLayout(prop, .7, { propOutward: 0 }).particles[0]!
    expect(stopped.x).toBe(stoppedLater.x); expect(stopped.y).toBe(stoppedLater.y)
    const far = particleLayout(prop, .3, { propOutward: 3 }).particles[0]!
    expect(far.x - stopped.x).toBeCloseTo((base.x - stopped.x) * 3)
    expect(far.y - stopped.y).toBeCloseTo((base.y - stopped.y) * 3)
  }
})

it('keeps previous props unrotated and retains their original motion', () => {
  const smooth = (t: number) => t * t * (3 - 2 * t)
  for (const prop of ['zzz', 'heart', 'crown', 'sweat'] as const) {
    const count = particleCount(prop), particles = particleLayout(prop, .4).particles
    particles.forEach((particle, i) => {
      const index = count > 1 ? i * 2 / (count - 1) : 0
      const p = ((.4 + i * .29) % 1 + 1) % 1
      const x = count === 1 ? 128 : prop === 'zzz' ? 45 + index * 64 : 51 + index * 69
      const y = count === 1 ? 132 : prop === 'zzz' ? 204 - index * 58 : 198 - index * 60
      expect(particle.x).toBeCloseTo(x + p * p * 36)
      expect(particle.y).toBeCloseTo(y - p * p * (count === 1 ? 26 : prop === 'zzz' ? 54 : 38))
      expect(particle.rotation).toBe(0)
      expect(particle.scale).toBeCloseTo(.62 + .38 * smooth(Math.min(1, p / .38)))
    })
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
