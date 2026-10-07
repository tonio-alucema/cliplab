import { describe, expect, it } from 'vitest'
import { BODY_MODIFICATIONS, PILL_BODY_MODIFICATIONS, SHAPES, bodyModificationsFor, defaultProject, definitionOf, parseCharacter, parseProject, sampleDefinition } from './model'

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
    const character = { ...defaultProject().characters[1]!, bodyModification: 'ghost' as const, roundedSkull: true, shape: 'chunky-pill' as const }
    const restored = parseCharacter(JSON.parse(JSON.stringify(character)))
    expect(restored.shape).toBe('chunky-pill')
    expect(restored.bodyModification).toBe('ghost')
    expect(restored.roundedSkull).toBe(true)
  })

  it('offers modifications only for their supported body shapes', () => {
    expect(bodyModificationsFor('cap').map(mod => mod.id)).toEqual(['none', 'upside-down', 'rotate-left', 'rotate-right', 'ghost', 'skeleton'])
    expect(bodyModificationsFor('capsule')).toEqual(PILL_BODY_MODIFICATIONS)
    expect(bodyModificationsFor('chunky-pill').map(mod => mod.id)).toEqual(['none', 'horizontal', 'skeleton'])
    for (const shape of ['capsule', 'chunky-pill'] as const) {
      const character = { ...defaultProject().characters[0]!, shape, bodyModification: 'horizontal' as const }
      const restored = parseProject(JSON.parse(JSON.stringify(definitionOf(defaultProject(), character))))
      expect(restored.characters[0]).toEqual(character)
    }
    expect(bodyModificationsFor('sphere')).toEqual([])
    // Inactive selections remain stored when temporarily switching body shapes.
    expect(parseCharacter({ ...defaultProject().characters[0], shape: 'sphere', bodyModification: 'horizontal' }).bodyModification).toBe('horizontal')
  })

  it('round-trips the chunky pill skeleton without requiring the end-cap rounded-skull flag', () => {
    const project = defaultProject()
    const character = { ...project.characters[0]!, shape: 'chunky-pill' as const, bodyModification: 'skeleton' as const, roundedSkull: false }
    project.characters[0] = character
    expect(parseProject(JSON.parse(JSON.stringify(project))).characters[0]).toEqual(character)
    const exported = definitionOf(project, character, ['sleepy'])
    expect(parseProject(JSON.parse(JSON.stringify(exported))).characters[0]).toEqual(character)
    const legacy: Partial<typeof character> = { ...character }
    delete legacy.roundedSkull
    expect(parseCharacter(legacy)).toEqual(character)
  })

  it('keeps the original skeleton by default and preserves the rounded variant in app exports', () => {
    const project = defaultProject()
    expect(project.characters.every(character => character.roundedSkull === false)).toBe(true)
    const legacy = { ...project.characters[1]!, bodyModification: 'skeleton' as const }
    delete legacy.roundedSkull
    expect(parseCharacter(legacy).roundedSkull).toBe(false)
    expect(parseCharacter({ ...legacy, roundedSkull: 'true' }).roundedSkull).toBe(false)
    for (const roundedSkull of [false, true]) {
      const exported = definitionOf(project, { ...legacy, roundedSkull })
      expect(parseProject(JSON.parse(JSON.stringify(exported))).characters[0]!.roundedSkull).toBe(roundedSkull)
    }
  })
})

it('preserves continuous rounding in saved projects and app exports, with compatible defaults', () => {
  const project = defaultProject()
  const legacy = { ...project.characters[0]! }; delete legacy.bodyRounding
  expect(parseCharacter(legacy).bodyRounding).toBe(1)
  for (const value of [undefined, null, '0.5', NaN, Infinity]) expect(parseCharacter({ ...legacy, bodyRounding: value }).bodyRounding).toBe(1)
  expect(parseCharacter({ ...legacy, bodyRounding: -1 }).bodyRounding).toBe(0)
  expect(parseCharacter({ ...legacy, bodyRounding: 2 }).bodyRounding).toBe(1)
  for (const bodyRounding of [0, .37, 1]) {
    project.characters[0]!.bodyRounding = bodyRounding
    expect(parseProject(JSON.parse(JSON.stringify(project))).characters[0]!.bodyRounding).toBe(bodyRounding)
    expect(parseProject(JSON.parse(JSON.stringify(definitionOf(project, project.characters[0]!)))).characters[0]!.bodyRounding).toBe(bodyRounding)
  }
})
