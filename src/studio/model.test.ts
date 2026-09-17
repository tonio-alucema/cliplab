import { describe, expect, it } from 'vitest'
import { BASE_POSE, animationDuration, defaultProject, definitionOf, detailAt, expressionDuration, mixPose, parseProject, sampleDefinition, sampleExpression, removeExpression } from './model'

describe('responsive character detail', () => {
  it('uses the user-defined boundaries inclusively, independently of rendering resolution', () => {
    expect(detailAt(12)).toBe('body'); expect(detailAt(12.01)).toBe('full')
    expect(detailAt(16)).toBe('full'); expect(detailAt(40)).toBe('full'); expect(detailAt(24)).toBe('full')
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
  it('loads earlier projects with default shading and preserves saved choices', () => {
    const old = JSON.parse(JSON.stringify(defaultProject()))
    for (const character of old.characters) for (const key of ['toon', 'candleLight', 'trueFront', 'lockPosition']) delete character[key]
    for (const expression of old.expressions) for (const beat of expression.beats) for (const key of ['cheeks', 'tears', 'mouthStroke']) delete beat.pose[key]
    const restored = parseProject(old)
    expect(restored.characters[0]).toMatchObject({ toon: true, trueFront: false, lockPosition: false })
    expect(restored.expressions[0]!.beats[0]!.pose).toMatchObject({ cheeks: false, tears: false, mouthStroke: 1 })
    restored.characters[0]!.toon = false
    restored.characters[0]!.trueFront = restored.characters[0]!.lockPosition = true
    restored.expressions[0]!.beats[0]!.pose.tears = true
    expect(parseProject(JSON.parse(JSON.stringify(restored)))).toEqual(restored)
  })
  it('migrates old candle-light choices into unified toon shading without restoring the obsolete toggle', () => {
    for (const toon of [false, true]) for (const candleLight of [false, true]) {
      const old = defaultProject()
      Object.assign(old.characters[0]!, { toon, candleLight })
      const restored = parseProject(old).characters[0]!
      expect(restored.toon).toBe(toon)
      expect(restored).not.toHaveProperty('candleLight')
    }
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


describe('gradient beat rotation controls', () => {
  it('keeps turn counts through save/import and accumulates them across holds and beats', () => {
    const project = defaultProject(), loading = project.expressions.find(e => e.id === 'loading')!
    loading.beats[0]!.gradientTurns = 3
    const restored = parseProject(JSON.parse(JSON.stringify(project))).expressions.find(e => e.id === 'loading')!
    expect(restored.beats[0]!.gradientTurns).toBe(3)
    expect(sampleExpression(restored, 1).gradientRotation).toBeCloseTo(540)
    expect(sampleExpression(restored, 2.25).gradientRotation).toBe(1080)
    restored.beats.push({ ...restored.beats[0]!, id: 'second-turn', gradientTurns: 2 })
    expect(sampleExpression(restored, 3.5).gradientRotation).toBeCloseTo(1440)
    const end = sampleExpression(restored, 4.5 - 1e-6).gradientRotation!
    expect(Math.cos(end * Math.PI / 180)).toBeCloseTo(1)
  })
  it('defaults old beats to one turn and constrains invalid imported values', () => {
    const project = defaultProject(), loading = project.expressions.find(e => e.id === 'loading')!
    expect(sampleExpression(loading, 1).gradientRotation).toBeCloseTo(180)
    loading.beats[0]!.gradientTurns = 99
    expect(parseProject(project).expressions.find(e => e.id === 'loading')!.beats[0]!.gradientTurns).toBe(8)
  })
})
describe('expression deletion', () => {
  it('cleans animation and linked face references without creating an invalid project', () => {
    const project = defaultProject()
    expect(removeExpression(project, 'working')).toBe(true)
    expect(project.expressions.find(e => e.id === 'loading')!.poseExpressionId).toBeUndefined()
    expect(project.animations.every(a => a.steps.length && a.steps.every(s => s.expressionId !== 'working'))).toBe(true)
    expect(() => parseProject(project)).not.toThrow()
    expect(removeExpression(project, 'missing')).toBe(false)
    while (project.expressions.length > 1) removeExpression(project, project.expressions[0]!.id)
    expect(removeExpression(project, project.expressions[0]!.id)).toBe(false)
    expect(() => parseProject(project)).not.toThrow()
  })
})


it('preserves brow proportions through save/import and interpolates them between beats', () => {
  const project = defaultProject(), expression = project.expressions[0]!
  expression.beats[0]!.pose.browStroke = 1.5; expression.beats[0]!.pose.browLength = 1.8
  const saved = parseProject(JSON.parse(JSON.stringify(project)))
  expect(saved.expressions[0]!.beats[0]!.pose.browStroke).toBe(1.5)
  expect(saved.expressions[0]!.beats[0]!.pose.browLength).toBe(1.8)
  const middle = mixPose(BASE_POSE, expression.beats[0]!.pose, .5)
  expect(middle.browStroke).toBe(1.25); expect(middle.browLength).toBe(1.4)
  const legacy = JSON.parse(JSON.stringify(project))
  delete legacy.expressions[0].beats[0].pose.browStroke; delete legacy.expressions[0].beats[0].pose.browLength
  expect(parseProject(legacy).expressions[0]!.beats[0]!.pose.browLength).toBe(1)
})
