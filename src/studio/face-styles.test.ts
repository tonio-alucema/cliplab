import { describe, expect, it } from 'vitest'
import { FACE_SETS, expressionFromFace, facePose } from './face-styles'
import { defaultProject, parseProject, sampleExpression } from './model'

describe('face style library', () => {
  it('keeps both families editable and preserves every new feature through project export/import', () => {
    const project = defaultProject()
    const original = JSON.stringify(project.expressions)
    const added = FACE_SETS.flatMap(set => set.presets.map(preset => expressionFromFace(set, preset)))
    project.expressions.push(...added)
    const restored = parseProject(JSON.parse(JSON.stringify(project)))
    expect(JSON.stringify(restored.expressions.slice(0, 10))).toBe(original)
    expect(restored.expressions.slice(10)).toEqual(added)
    expect(new Set(added.map(e => e.id)).size).toBe(added.length)
    for (const expression of added) {
      const pose = sampleExpression(expression, 1.5).pose
      expect(pose.eye).toBe(expression.beats[1]!.pose.eye)
      expect(pose.mouth).toBe(expression.beats[1]!.pose.mouth)
      expect(Number.isFinite(pose.blush)).toBe(true)
    }
  })
  it('creates independent beats and leaves library definitions unchanged when edited', () => {
    const set = FACE_SETS[1]!, preset = set.presets[0]!
    const expression = expressionFromFace(set, preset)
    expression.beats[0]!.pose.eyeSize = .5
    expect(expression.beats[1]!.pose.eyeSize).toBe(preset.pose.eyeSize)
    expect(facePose(set, preset).eyeSize).toBe(preset.pose.eyeSize)
  })
  it('gives old projects quiet face defaults and keeps cursor rotation opt-in', () => {
    const project = JSON.parse(JSON.stringify(defaultProject()))
    for (const character of project.characters) delete character.followRotation
    for (const expression of project.expressions) for (const beat of expression.beats) {
      delete beat.pose.faceSet; delete beat.pose.brows; delete beat.pose.blush
    }
    const restored = parseProject(project)
    expect(restored.characters.every(c => !c.followRotation)).toBe(true)
    expect(restored.expressions[0]!.beats[0]!.pose).toMatchObject({ faceSet: 'set-1', brows: 'none', blush: 0 })
    restored.characters[0]!.followRotation = true
    expect(parseProject(restored).characters[0]!.followRotation).toBe(true)
  })
})
