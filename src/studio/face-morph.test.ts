import { describe, expect, it } from 'vitest'
import { BASE_POSE, EYES, MOUTHS, clone, defaultProject, definitionOf, faceLayers, mixFaceLayers, parseProject, sampleDefinition, sampleExpression, upgradeStudioDefaults } from './model'
import { blendContours, eyeContour, mouthGeometry } from './face-morph'
import { irisOffset } from './gaze'

const bounds = (points: { x: number; y: number }[]) => ({ left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)), top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) })
describe('continuous face contours', () => {
  it('preserves circular eyes, half-circle arcs, and round-ended mouth strokes', () => {
    const dot = bounds(eyeContour(BASE_POSE, 27, -1, 0, 'full'))
    expect(dot.left).toBeCloseTo(-27, 1); expect(dot.right).toBeCloseTo(27, 1)
    expect(dot.top).toBeCloseTo(-27, 1); expect(dot.bottom).toBeCloseTo(27, 1)
    const closed = bounds(eyeContour({ ...BASE_POSE, eye: 'arc-down' }, 27, -1, 0, 'full'))
    expect(closed.top).toBeCloseTo(-6.5, 1); expect(closed.bottom).toBeCloseTo(33.5, 1)
    const line = bounds(mouthGeometry({ ...BASE_POSE, mouth: 'line' }).outline)
    expect(line.top).toBeCloseTo(-8.5, 1); expect(line.bottom).toBeCloseTo(8.5, 1)
    expect(line.left).toBeCloseTo(-(61 * .58 + 8.5), 1)
  })

  it('has finite matching topology for every eye and mouth, with continuous halfway geometry', () => {
    for (const detail of ['eyes', 'full'] as const) for (const eye of EYES) for (const side of [-1, 1]) {
      const points = eyeContour({ ...BASE_POSE, eye, faceSet: 'set-2' }, 32.4, side, .2, detail)
      expect(points).toHaveLength(128); expect(points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    }
    for (const mouth of MOUTHS) {
      const shape = mouthGeometry({ ...BASE_POSE, mouth })
      expect(shape.outline).toHaveLength(128); expect(shape.opening).toHaveLength(128)
      expect(shape.outline.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    }
    for (const [from, to] of [['line', 'open'], ['open', 'cry'], ['smile', 'frown'], ['kiss', 'tongue-out']] as const) {
      const a = { ...BASE_POSE, mouth: from }, b = { ...BASE_POSE, mouth: to }
      const shapes = [mouthGeometry(a).outline, mouthGeometry(b).outline]
      const at = (t: number) => { const layers = mixFaceLayers(faceLayers(a), faceLayers(b), t); return blendContours(layers.map(l => mouthGeometry({ ...BASE_POSE, ...l.traits }).outline), layers) }
      const before = at(.49999), after = at(.50001)
      expect(Math.max(...before.map((p, i) => Math.hypot(p.x - after[i]!.x, p.y - after[i]!.y)))).toBeLessThan(.01)
      expect(at(0)).toEqual(shapes[0]); expect(at(1)).toEqual(shapes[1])
    }
  })

  it('keeps beat and overlapping expression weights normalized, including the loop seam', () => {
    const project = defaultProject(), definition = definitionOf(project, project.characters[0]!)
    for (const animation of definition.animations) for (const time of [0, .1, .19, .21, .34, .9, 2.51, 7]) {
      const sample = sampleDefinition(definition, animation.id, time)
      expect(sample.faceLayers!.reduce((n, l) => n + l.weight, 0)).toBeCloseTo(1, 10)
      expect(sample.faceLayers!.every(l => l.weight >= 0)).toBe(true)
    }
    const expression = project.expressions[0]!
    expression.beats = [
      { id: 'a', name: 'Round', duration: 1, pose: { ...BASE_POSE, eye: 'dot', mouth: 'line' } },
      { id: 'b', name: 'Smile', duration: 1, pose: { ...BASE_POSE, eye: 'arc-up', mouth: 'open' } }
    ]
    const before = sampleExpression(expression, .2 - .00001), after = sampleExpression(expression, .2 + .00001)
    expect(before.faceLayers).toHaveLength(2); expect(after.faceLayers).toHaveLength(2)
    expect(before.faceLayers[0]!.weight).toBeCloseTo(after.faceLayers[0]!.weight, 3)
    expect(sampleExpression(expression, 0).faceLayers).toEqual(sampleExpression(expression, 2).faceLayers)
  })

  it('moves iris clearance continuously as cheek cutouts grow', () => {
    let previous = irisOffset(32.4, { x: .4, y: -1 }, 0, 0)
    for (let i = 1; i <= 100; i++) {
      const next = irisOffset(32.4, { x: .4, y: -1 }, 0, i / 100)
      expect(Number.isFinite(next.y)).toBe(true)
      expect(Math.abs(next.y - previous.y)).toBeLessThan(1)
      expect(Math.hypot(next.x, next.y) + 32.4 * .28).toBeLessThan(32.4)
      previous = next
    }
  })
})

describe('updated studio defaults', () => {
  it('shrinks defaults once and upgrades neutral Loading without changing authored timing or custom size', () => {
    const old = clone(defaultProject()); delete old.defaultsRevision
    for (const e of old.expressions) for (const b of e.beats) b.pose.faceScale = 1
    old.expressions[0]!.beats[0]!.pose.faceScale = 1.2
    const loading = old.expressions.find(e => e.id === 'loading')!
    delete loading.poseExpressionId; loading.beats[0]!.duration = 4
    const animations = clone(old.animations)
    const updated = upgradeStudioDefaults(old)
    expect(updated.expressions[0]!.beats[0]!.pose.faceScale).toBe(1.2)
    expect(updated.expressions[1]!.beats[0]!.pose.faceScale).toBe(.75)
    expect(loading.poseExpressionId).toBe('working'); expect(loading.beats[0]!.duration).toBe(4)
    expect(updated.animations).toEqual(animations)
    updated.expressions[1]!.beats[0]!.pose.faceScale = 1
    expect(upgradeStudioDefaults(parseProject(updated)).expressions[1]!.beats[0]!.pose.faceScale).toBe(1)
    const custom = clone(old); delete custom.defaultsRevision; delete custom.expressions.find(e => e.id === 'loading')!.poseExpressionId
    custom.expressions.find(e => e.id === 'loading')!.beats[0]!.pose.mouth = 'cry'
    expect(upgradeStudioDefaults(custom).expressions.find(e => e.id === 'loading')!.poseExpressionId).toBeUndefined()
    const resized = clone(old); delete resized.defaultsRevision
    const resizedLoading = resized.expressions.find(e => e.id === 'loading')!
    delete resizedLoading.poseExpressionId; resizedLoading.beats[0]!.pose.faceScale = 1.2
    expect(upgradeStudioDefaults(resized).expressions.find(e => e.id === 'loading')!.poseExpressionId).toBeUndefined()
    expect(resizedLoading.beats[0]!.pose.faceScale).toBe(1.2)
  })

  it('includes linked face motion in exports and rejects missing or cyclic references', () => {
    const project = defaultProject()
    const definition = definitionOf(project, project.characters[0]!, ['loading'])
    expect(definition.expressions.map(e => e.id).sort()).toEqual(['loading', 'working'])
    expect(parseProject(definition).expressions).toEqual(definition.expressions)
    project.expressions.find(e => e.id === 'working')!.poseExpressionId = 'loading'
    expect(() => parseProject(project)).toThrow('refer back')
    delete project.expressions.find(e => e.id === 'working')!.poseExpressionId
    project.expressions.find(e => e.id === 'loading')!.poseExpressionId = 'missing'
    expect(() => parseProject(project)).toThrow('missing face motion')
  })
})
