import { describe, expect, it } from 'vitest'
import { addLoadingAnimation, clone, defaultProject, definitionOf, expressionDuration, parseProject, sampleDefinition, sampleExpression } from './model'

describe('Loading gradient loop', () => {
  const project = defaultProject(), loading = project.expressions.find(e => e.id === 'loading')!
  const angle = (time: number) => sampleExpression(loading, time).gradientRotation!

  it('makes one strongly eased turn, holds exactly half a second, then repeats seamlessly', () => {
    expect(expressionDuration(loading)).toBe(2.5)
    expect(angle(0)).toBe(0); expect(angle(.2)).toBeLessThan(1)
    expect(angle(1)).toBeCloseTo(180)
    expect(angle(1.8)).toBeGreaterThan(359)
    expect(angle(1.2) - angle(.8)).toBeGreaterThan(200)
    for (const time of [2, 2.1, 2.25, 2.49999]) expect(angle(time)).toBe(360)
    expect(angle(2.5)).toBe(0)
    expect(Math.cos(angle(2.49999) * Math.PI / 180)).toBeCloseTo(Math.cos(angle(2.5) * Math.PI / 180), 10)
    expect(Math.sin(angle(2.49999) * Math.PI / 180)).toBeCloseTo(Math.sin(angle(2.5) * Math.PI / 180), 10)
    for (const time of [.1, .75, 1.25, 2.25]) expect(angle(time + 25)).toBeCloseTo(angle(time), 8)
  })

  it('moves only the gradient and scales the rotation and hold with sequence timing', () => {
    const definition = definitionOf(project, project.characters[0]!)
    for (const time of [0, .1, 1, 2, 2.25]) {
      const sample = sampleDefinition(definition, 'loading', time)
      expect(sample.gradientRotation).toBeCloseTo(angle(time), 8)
      expect(sample).toMatchObject({ bob: 0, breathe: 0, blink: 0 })
      expect(sample.pose).toEqual(loading.beats[0]!.pose)
    }
    expect(sampleDefinition(definition, 'idle', 1).gradientRotation).toBeUndefined()
    definition.animations.find(a => a.id === 'loading')!.steps[0]!.duration = 5
    expect(sampleDefinition(definition, 'loading', 2).gradientRotation).toBeCloseTo(180)
    expect(sampleDefinition(definition, 'loading', 4.75).gradientRotation).toBe(360)
    definition.character.speed = 2
    expect(sampleDefinition(definition, 'loading', 1).gradientRotation).toBeCloseTo(180)
    expect(sampleDefinition(definition, 'loading', 2.25).gradientRotation).toBe(360)
  })

  it('preserves motion after renaming, exporting, and reordering its beats', () => {
    const edited = clone(project)
    const expression = edited.expressions.find(e => e.id === 'loading')!
    expression.name = 'Please wait'
    expression.beats = [expression.beats[1]!, expression.beats[0]!]
    expression.beats[1]!.duration = 4
    const restored = parseProject(definitionOf(edited, edited.characters[0]!, ['loading']))
    expect(restored.expressions[0]!.beats.map(b => b.gradientAction)).toEqual(['hold', 'rotate'])
    expect(sampleExpression(restored.expressions[0]!, .25).gradientRotation).toBe(0)
    expect(sampleExpression(restored.expressions[0]!, 2.5).gradientRotation).toBeCloseTo(180)
    const unknown = clone(edited) as any
    unknown.expressions[0].beats[0].gradientAction = 'invalid'
    expect(parseProject(unknown).expressions[0]!.beats[0]!.gradientAction).toBeUndefined()
  })

  it('composes with ordinary expressions without a gradient jump at loop boundaries', () => {
    const definition = definitionOf(project, project.characters[0]!)
    definition.animations = [{ id: 'mixed', name: 'Mixed', loop: true, steps: [{ id: 'load', expressionId: 'loading', duration: 2.5 }, { id: 'idle', expressionId: 'idle', duration: 2.5 }] }]
    for (const boundary of [2.5, 5]) {
      const before = sampleDefinition(definition, 'mixed', boundary - .00001).gradientRotation ?? 0
      const after = sampleDefinition(definition, 'mixed', boundary).gradientRotation ?? 0
      expect(Math.cos(before * Math.PI / 180)).toBeCloseTo(Math.cos(after * Math.PI / 180), 8)
      expect(Math.sin(before * Math.PI / 180)).toBeCloseTo(Math.sin(after * Math.PI / 180), 8)
    }
  })

  it('adds Loading to an old library and reuses its edited expression after deletion', () => {
    const old = clone(project)
    old.expressions = old.expressions.filter(e => e.id !== 'loading'); old.animations = old.animations.filter(a => a.id !== 'loading')
    const original = clone(old)
    const added = addLoadingAnimation(old)
    expect(added).toMatchObject({ id: 'loading', name: 'Loading', loop: true })
    expect(old.expressions.slice(0, -1)).toEqual(original.expressions)
    expect(old.animations.slice(0, -1)).toEqual(original.animations)
    expect(addLoadingAnimation(old)).toBe(added)
    old.expressions.at(-1)!.beats[0]!.duration = 3
    old.animations = old.animations.filter(a => a.id !== added.id)
    const restored = addLoadingAnimation(old)
    expect(restored.steps[0]!.duration).toBe(3.5)
    expect(old.expressions).toHaveLength(original.expressions.length + 1)
    expect(parseProject(old)).toEqual(old)
  })

  it('fades a solid fill into the gradient without reversing short turns during a transition', () => {
    const definition = definitionOf(project, { ...project.characters[0]!, gradient: false })
    definition.expressions.find(e => e.id === 'loading')!.beats[0]!.duration = .2
    definition.animations = [{ id: 'quick', name: 'Quick', loop: true, steps: [{ id: 'idle', expressionId: 'idle', duration: 1 }, { id: 'load', expressionId: 'loading', duration: .7 }] }]
    expect(sampleDefinition(definition, 'quick', 1).gradientMix).toBeCloseTo(0, 10)
    expect(sampleDefinition(definition, 'quick', 1.07).gradientMix).toBeCloseTo(.5)
    expect(sampleDefinition(definition, 'quick', 1.15).gradientMix).toBe(1)
    let previous = 0
    for (let i = 0; i <= 200; i++) {
      const current = sampleDefinition(definition, 'quick', 1 + i / 1000).gradientRotation!
      expect(current).toBeGreaterThanOrEqual(previous)
      expect(current - previous).toBeLessThan(20)
      previous = current
    }
    expect(sampleDefinition(definition, 'quick', 1.7).gradientMix).toBe(1)
    expect(sampleDefinition(definition, 'quick', 1.8).gradientMix).toBeCloseTo(.5)
    expect(sampleDefinition(definition, 'quick', 1.91).gradientMix).toBeUndefined()
    expect(definition.character.gradient).toBe(false)
  })
})
