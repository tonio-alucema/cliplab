import { describe, expect, it } from 'vitest'
import { BODY_MODIFICATIONS, SHAPES, defaultProject, definitionOf, parseCharacter, parseProject, sampleDefinition } from './model'

describe('body shapes and modifications', () => {
  it('imports the chunky pill as its own shape and preserves character settings', () => {
    const project = defaultProject()
    const character = { ...project.characters[0]!, shape: 'chunky-pill' as const, followRotation: true, iris: true }
    project.characters[0] = character
    const restored = parseProject(JSON.parse(JSON.stringify(project)))
    expect(restored.characters[0]).toEqual(character)
    expect(SHAPES.find(shape => shape.id === 'chunky-pill')?.ratio).toBe('1:1.5')
    expect(restored.expressions).toEqual(project.expressions)
    expect(restored.animations).toEqual(project.animations)
  })

  it('keeps old projects unchanged visually by defaulting to no body modification', () => {
    expect(defaultProject().characters.every(character => character.bodyModification === 'none')).toBe(true)
    const legacy = defaultProject()
    for (const character of legacy.characters) delete character.bodyModification
    expect(parseProject(legacy).characters.every(character => character.bodyModification === 'none')).toBe(true)
    for (const bodyModification of ['unknown', ['ghost', 'skeleton'], null, 3]) {
      expect(parseCharacter({ ...legacy.characters[1], bodyModification }).bodyModification).toBe('none')
    }
  })

  it.each(BODY_MODIFICATIONS)('round-trips $name through project and app JSON without changing expression playback', ({ id }) => {
    const project = defaultProject()
    const original = definitionOf(project, project.characters[1]!, ['sleepy'])
    project.characters[1]!.bodyModification = id
    const exported = definitionOf(project, project.characters[1]!, ['sleepy'])
    const imported = parseProject(JSON.parse(JSON.stringify(exported)))
    expect(imported.characters[0]!.shape).toBe('cap')
    expect(imported.characters[0]!.bodyModification).toBe(id)
    expect(imported.expressions).toEqual(exported.expressions)
    expect(imported.animations).toEqual(exported.animations)
    expect(sampleDefinition(exported, 'sleepy', 2.5)).toEqual(sampleDefinition(original, 'sleepy', 2.5))
  })

  it('remembers the end-cap modification while a different body shape is selected', () => {
    const character = { ...defaultProject().characters[1]!, bodyModification: 'ghost' as const, shape: 'chunky-pill' as const }
    const restored = parseCharacter(JSON.parse(JSON.stringify(character)))
    expect(restored.shape).toBe('chunky-pill')
    expect(restored.bodyModification).toBe('ghost')
  })
})
