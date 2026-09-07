import { describe, expect, it } from 'vitest'
import { BASE_POSE, animationDuration, defaultProject, definitionOf, detailAt, expressionDuration, mixPose, parseProject, sampleDefinition, sampleExpression } from './model'

describe('responsive character detail', () => {
  it('uses the user-defined boundaries inclusively, independently of rendering resolution', () => {
    expect(detailAt(12)).toBe('body'); expect(detailAt(15.99)).toBe('body')
    expect(detailAt(16)).toBe('eyes'); expect(detailAt(24)).toBe('eyes')
    expect(detailAt(24.01)).toBe('full'); expect(detailAt(120)).toBe('full')
  })
})
describe('animation continuity', () => {
  const project = defaultProject(), definition = definitionOf(project, project.characters[0]!)
  it('closes the face, pose, blink, and secondary motion on every default loop', () => {
    for (const speed of [.6, 1, 1.75]) {
      definition.character.speed = speed
      for (const animation of definition.animations) {
        const start = sampleDefinition(definition, animation.id, 0)
        const end = sampleDefinition(definition, animation.id, animationDuration(animation) / speed)
        for (const key of Object.keys(start.pose) as (keyof typeof start.pose)[]) {
          if (typeof start.pose[key] === 'number') expect(end.pose[key]).toBeCloseTo(start.pose[key] as number, 10)
          else expect(end.pose[key]).toBe(start.pose[key])
        }
        expect(end.bob).toBeCloseTo(start.bob, 10)
        expect(end.breathe).toBeCloseTo(start.breathe, 10)
        expect(end.blink).toBeCloseTo(start.blink, 10)
      }
    }
  })
  it('handles transitions between different expressions without a loop-boundary jump', () => {
    const d = definitionOf(project, project.characters[0]!)
    d.animations = [{ id: 'mixed', name: 'Mixed', loop: true, steps: [{ id: 'a', expressionId: 'happy', duration: 2.3 }, { id: 'b', expressionId: 'thinking', duration: 4.7 }] }]
    const before = sampleDefinition(d, 'mixed', 7 - .00001), after = sampleDefinition(d, 'mixed', 0)
    expect(before.pose.eye).toBe(after.pose.eye)
    expect(before.pose.rotationZ).toBeCloseTo(after.pose.rotationZ, 2)
    expect(before.pose.mouthWidth).toBeCloseTo(after.pose.mouthWidth, 2)
  })
  it('turns through the short path around the angle boundary', () => {
    const pose = mixPose({ ...BASE_POSE, rotationY: 179 }, { ...BASE_POSE, rotationY: -179 }, .5)
    expect(pose.rotationY).toBe(180)
  })
  it('uses finite samples at all beat boundaries', () => {
    for (const expression of project.expressions) {
      for (const time of [0, .1, expressionDuration(expression), 100]) {
        const s = sampleDefinition(definition, 'idle', time, expression.id)
        for (const value of Object.values(s.pose)) if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true)
      }
    }
  })
})
describe('portable project definitions', () => {
  it('loads earlier projects without enabling new view or face effects', () => {
    const old = JSON.parse(JSON.stringify(defaultProject()))
    for (const character of old.characters) for (const key of ['candleLight', 'trueFront', 'lockPosition']) delete character[key]
    for (const expression of old.expressions) for (const beat of expression.beats) for (const key of ['cheeks', 'tears', 'mouthStroke']) delete beat.pose[key]
    const restored = parseProject(old)
    expect(restored.characters[0]).toMatchObject({ candleLight: false, trueFront: false, lockPosition: false })
    expect(restored.expressions[0]!.beats[0]!.pose).toMatchObject({ cheeks: false, tears: false, mouthStroke: 1 })
    restored.characters[0]!.trueFront = restored.characters[0]!.lockPosition = true
    restored.expressions[0]!.beats[0]!.pose.tears = true
    expect(parseProject(JSON.parse(JSON.stringify(restored)))).toEqual(restored)
  })
  it('round-trips the full project and a selected-animation app export', () => {
    const project = defaultProject()
    expect(parseProject(JSON.parse(JSON.stringify(project)))).toEqual(project)
    const definition = definitionOf(project, project.characters[0]!, ['sleepy'])
    expect(definition.animations.map(a => a.id)).toEqual(['sleepy'])
    expect(definition.expressions.map(e => e.id)).toEqual(['sleepy'])
    expect(parseProject(definition).characters[0]).toEqual(project.characters[0])
  })
  it('rejects missing references and empty expressions before replacing a saved project', () => {
    const project = defaultProject()
    project.animations[0]!.steps[0]!.expressionId = 'missing'
    expect(() => parseProject(project)).toThrow('missing expression')
    const another = defaultProject(); another.expressions[0]!.beats = []
    expect(() => parseProject(another)).toThrow('beats')
  })
  it('bounds imported durations and geometry controls', () => {
    const project = defaultProject()
    project.expressions[0]!.beats[0]!.duration = -50
    project.expressions[0]!.beats[0]!.pose.eyeSize = 10000
    project.characters[0]!.elevation = 500
    const parsed = parseProject(project)
    expect(parsed.expressions[0]!.beats[0]!.duration).toBe(.2)
    expect(parsed.expressions[0]!.beats[0]!.pose.eyeSize).toBe(2)
    expect(parsed.characters[0]!.elevation).toBe(.2)
  })
})

describe('supporting expression details', () => {
  it('makes prop replacements invisible at the categorical switch, then eases them back in', () => {
    const expression = defaultProject().expressions[0]!
    expression.beats = ['heart', 'zzz'].map((prop, index) => ({ id: `b${index}`, name: 'Beat', duration: 1, pose: { ...BASE_POSE, prop: prop as 'heart' | 'zzz', tears: index === 1 } }))
    const before = sampleExpression(expression, .2 - .00001), at = sampleExpression(expression, .2), after = sampleExpression(expression, .2 + .00001)
    expect(before.pose.prop).not.toBe(after.pose.prop)
    for (const sample of [before, at, after]) { expect(sample.propAmount).toBeLessThan(.00001); expect(sample.tearAmount).toBeLessThan(.00001) }
    expect(sampleExpression(expression, .4).propAmount).toBe(1)
  })
  it('closes the secondary effect phase and visibility on exported loops', () => {
    const project = defaultProject(), definition = definitionOf(project, project.characters[0]!)
    for (const animation of definition.animations) {
      const duration = animationDuration(animation) / definition.character.speed
      const start = sampleDefinition(definition, animation.id, 0), end = sampleDefinition(definition, animation.id, duration)
      expect(end.effectPhase).toBeCloseTo(start.effectPhase!, 9)
      expect(end.propAmount).toBeCloseTo(start.propAmount!, 9)
      expect(end.tearAmount).toBeCloseTo(start.tearAmount!, 9)
    }
  })
})
