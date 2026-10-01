import { expect, it } from 'vitest'
import { particleCount, particleLayout } from './particles'
import { defaultProject, parseProject, PROPS } from './model'
import { copyBeatValues, pasteBeatValues } from './beat-values'
import { particleIconSource } from './particle-art'

it('normalizes both supplied SVG artworks another fifteen percent smaller', () => {
  const question = particleIconSource('question'), star = particleIconSource('sparkle')
  expect(question.height * question.scale).toBeCloseTo(99.2 * .85)
  expect(star.width * star.scale).toBeCloseTo(83.2 * .85)
  expect(question.svg).toContain('<svg')
  expect(star.svg).toContain('<svg')
})

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
    const radius = prop === 'crown' ? 100 : prop === 'question' ? 55.76 : prop === 'sparkle' ? 50.32 : prop === 'sweat' ? 80 : 48
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
  expect(particleLayout('sparkle', .19).particles.every(p => p.alpha > .95)).toBe(true)
  const at = (prop: 'sparkle' | 'question', phase: number) => particleLayout(prop, phase, { propCount: 1 }).particles[0]!
  const starLaunch = at('sparkle', .2).x - at('sparkle', 0).x
  const questionLaunch = at('question', .2).x - at('question', 0).x
  expect(starLaunch).toBeGreaterThan(questionLaunch)
  expect(at('sparkle', .2).x - at('sparkle', .1).x).toBeGreaterThan((at('sparkle', .8).x - at('sparkle', .7).x) * 4)
  expect(at('sparkle', .55).alpha).toBeGreaterThan(.4)
  expect(at('sparkle', .8).alpha).toBeGreaterThan(0)
  expect(at('sparkle', .95).alpha).toBe(0)
})

it('separates all visible default stars throughout launch, growth, fade and the stationary preview', () => {
  for (const propSize of [.5, 1, 2]) for (const propOutward of [0, .5, 1, 3]) {
    for (const phase of [undefined, ...Array.from({ length: 2001 }, (_, i) => i / 2000)]) {
      const visible = particleLayout('sparkle', phase, { propOutward, propSize }).particles.filter(p => p.alpha > .02)
      for (let i = 0; i < visible.length; i++) for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i]!, b = visible[j]!
        // These circles enclose the supplied star's actual rounded outline.
        const gap = Math.hypot(a.x - b.x, a.y - b.y) - 35.7 * (a.scale + b.scale)
        expect(gap).toBeGreaterThan(0)
        if (propSize === 1 && propOutward === 1 && b.index - a.index === 1) expect(gap).toBeLessThan(45)
      }
    }
  }
})

it('keeps the default star cloud compact and every zero-outward lane stationary', () => {
  const layout = particleLayout('sparkle', .5)
  expect(layout.bounds!.right).toBeLessThan(330)
  expect(layout.bounds!.top).toBeGreaterThan(-100)
  const early = particleLayout('sparkle', .1, { propOutward: 0 }).particles
  const late = particleLayout('sparkle', .8, { propOutward: 0 }).particles
  early.forEach((particle, i) => {
    expect(late[i]!.x).toBe(particle.x)
    expect(late[i]!.y).toBe(particle.y)
  })
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
      const seam = prop === 'question' ? (1 - i / count) % 1 : (count - 1 - i) * .05
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


it('gives each star its own launch timing and a 45 degree spin over its lifetime', () => {
  const one = (phase: number, index: number) => particleLayout('sparkle', phase).particles[index]!
  const phases = [.1, .05, 0]
  phases.forEach((delay, index) => {
    const start = one(delay, index), end = one(delay + .9 - 1e-8, index)
    expect((end.rotation - start.rotation) * 180 / Math.PI).toBeCloseTo(45, 5)
    expect(start.alpha).toBeLessThan(1e-8)
    expect(end.alpha).toBeLessThan(1e-8)
  })
  const launches = phases.map((delay, index) => {
    const start = one(delay, index), end = one(delay + .9 - 1e-8, index), now = one(.12, index)
    return (now.x - start.x) / (end.x - start.x)
  })
  expect(launches[1]! - launches[0]!).toBeGreaterThan(.1)
  expect(launches[2]! - launches[1]!).toBeGreaterThan(.1)
  // Faster early travel settles to almost no movement during the late fade.
  expect(one(.2, 0).x - one(.1, 0).x).toBeGreaterThan((one(.8, 0).x - one(.7, 0).x) * 8)
})


it('gives neighboring marks contrasting seeded tilts without changing the star spin', () => {
  for (const prop of ['question', 'sparkle'] as const) {
    const tilts = [0, 1, 2].map(i => particleLayout(prop, prop === 'sparkle' ? (2 - i) * .05 : (1 - i / 3) % 1).particles[i]!.rotation * 180 / Math.PI)
    expect(tilts[0]).toBeLessThan(-5)
    expect(tilts[1]).toBeGreaterThan(5)
    expect(tilts[2]).toBeLessThan(-5)
  }
  const question = particleLayout('question').particles
  expect(question[2]!.x - question[0]!.x).toBeLessThan(85)
  const star = particleLayout('sparkle').particles
  expect(Math.hypot(star[2]!.x - star[0]!.x, star[2]!.y - star[0]!.y)).toBeLessThan(125)
})


it('starts every burst cleanly, with no wrapped tail before each delayed launch', () => {
  for (const propCount of [1, 3, 6]) for (const loop of [0, 1, 7]) {
    const start = particleLayout('sparkle', loop, { propCount }).particles
    expect(start.every(p => p.alpha === 0)).toBe(true)
    for (let i = 0; i < propCount; i++) {
      const delay = (propCount - 1 - i) * .05
      for (const phase of [0, delay / 2, Math.max(0, delay - 1e-6)]) {
        expect(particleLayout('sparkle', loop + phase, { propCount }).particles[i]!.alpha).toBe(0)
      }
      expect(particleLayout('sparkle', loop + delay + .03, { propCount }).particles[i]!.alpha).toBeGreaterThan(0)
    }
    expect(particleLayout('sparkle', loop + .99999, { propCount }).particles.every(p => p.alpha === 0)).toBe(true)
  }
})
