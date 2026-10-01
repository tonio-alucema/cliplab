import { expect, it } from 'vitest'
import { BASE_POSE, defaultProject, sampleDefinition, type Definition, type Expression, type Prop } from './model'
import { particleLayout } from './particles'

const expression = (id: string, beats: [Prop, number][]): Expression => ({ id, name: id, description: '', beats: beats.map(([prop, duration], i) => ({ id: `${id}-${i}`, name: `${i}`, duration, pose: { ...BASE_POSE, prop } })) })
const definition = (expressions: Expression[]): Definition => ({ version: 1, character: { ...defaultProject().characters[0]!, speed: 1 }, expressions, animations: [] })
const starClock = (def: Definition, time: number, expressionId?: string) => sampleDefinition(def, 'loop', time, expressionId).propPhase!

it('starts a later star beat at launch instead of inheriting the global clock tail', () => {
  const def = definition([expression('happy', [['none', .9], ['sparkle', 1.3], ['none', 1.5]])])
  const onset = 1.125
  const sample = sampleDefinition(def, '', onset + .01, 'happy')
  expect(sample.pose.prop).toBe('sparkle')
  expect(sample.effectPhase).toBeGreaterThan(.5)
  expect(sample.propPhase).toBeLessThan(.01)
  const particles = particleLayout('sparkle', sample.propPhase).particles
  expect(particles.slice(0, 2).every(p => p.alpha === 0)).toBe(true)
  expect(particles[2]!.scale).toBeLessThan(.4)
  const later = starClock(def, onset + .2, 'happy')
  expect(later).toBeGreaterThan(sample.propPhase!)
  // Seeking or restarting produces precisely the same beginning.
  expect(starClock(def, onset + .01, 'happy')).toBe(sample.propPhase)
  expect(starClock(def, onset + .01 + 3.7, 'happy')).toBeCloseTo(sample.propPhase!, 10)
})

it('restarts on a new star run but continues through adjacent star beats', () => {
  const def = definition([expression('custom', [['none', 1], ['sparkle', 1], ['sparkle', 1], ['none', 1], ['sparkle', 1]])])
  expect(starClock(def, 2.001, 'custom') - starClock(def, 1.999, 'custom')).toBeCloseTo(.002 * 2 / 5)
  expect(starClock(def, 4.21, 'custom')).toBeLessThan(.01)
  expect(starClock(def, 4.21, 'custom')).toBeLessThan(starClock(def, 2.5, 'custom'))
})

it('starts cleanly after an animation step transition and preserves uninterrupted stars across steps', () => {
  const def = definition([expression('plain', [['none', 1]]), expression('stars', [['sparkle', 2]])])
  def.animations = [{ id: 'loop', name: 'Loop', loop: true, steps: [
    { id: 'a', expressionId: 'plain', duration: 1 }, { id: 'b', expressionId: 'stars', duration: 2 }, { id: 'c', expressionId: 'stars', duration: 2 }
  ] }]
  expect(starClock(def, 1.185)).toBeCloseTo(.01 * 2 / 5)
  expect(starClock(def, 3.001) - starClock(def, 2.999)).toBeCloseTo(.002 * 2 / 5)
})

it('uses linked face-expression timing and character speed for a fresh star entrance', () => {
  const face = expression('face', [['none', 1], ['sparkle', 2]])
  const carrier = { ...expression('carrier', [['none', 6]]), poseExpressionId: 'face' }
  const def = definition([carrier, face])
  expect(starClock(def, 2.46, 'carrier')).toBeCloseTo(.01 * 3 / 6)
  def.character.speed = 2
  expect(starClock(def, 1.23, 'carrier')).toBeCloseTo(.01 * 3 / 6)
})

it('retains outgoing star size, count and travel until the effect is fully faded', () => {
  const custom = expression('custom', [['sparkle', 2], ['none', 2]])
  Object.assign(custom.beats[0]!.pose, { propSize: 1.7, propCount: 5, propOutward: 2.4 })
  const def = definition([custom])
  for (const time of [1.99, 2.05, 2.15, 2.224]) {
    const sample = sampleDefinition(def, '', time, 'custom')
    expect(sample.pose).toMatchObject({ prop: 'sparkle', propSize: 1.7, propCount: 5, propOutward: 2.4 })
    expect(sample.propPhase).toBeCloseTo((time - .225) / 2)
  }
  const plain = sampleDefinition(def, '', 2.226, 'custom')
  expect(plain.pose.prop).toBe('none')
})
