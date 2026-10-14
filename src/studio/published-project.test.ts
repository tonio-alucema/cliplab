import { expect, it } from 'vitest'
import snapshot from './defaults/tonio-set-02.cliplab.json'
import { loadStudioProject, publishedProject } from './published-project'
import { definitionOf, parseProject, sampleDefinition } from './model'

// New controls receive their backward-compatible defaults without altering the supplied artwork.
const expectedSnapshot = { ...snapshot, characters: snapshot.characters.map(character => ({ ...character, bodyRounding: 1 })) }

it('opens the complete supplied Tonio Set 02 project in a fresh studio without changing its values', () => {
  const project = loadStudioProject(null)
  expect(project).toEqual(expectedSnapshot)
  expect(project.name).toBe('tonio-set-02')
  expect(project.characters).toHaveLength(7)
  expect(project.expressions).toHaveLength(27)
  expect(project.animations).toHaveLength(15)
  expect(project.favoriteBeats).toHaveLength(2)
})

it('keeps edits isolated from the published snapshot and from later fresh studios', () => {
  const edited = publishedProject()
  edited.characters[0]!.name = 'My private edit'
  edited.expressions[0]!.beats[0]!.pose.mouthStroke = 2
  edited.animations[0]!.steps.splice(0, 1)
  expect(publishedProject()).toEqual(expectedSnapshot)
})

it('preserves an existing local project instead of replacing it with the published default', () => {
  const saved = publishedProject()
  saved.name = 'Personal workspace'
  saved.characters.reverse()
  saved.expressions[0]!.beats[0]!.pose.eyeSize = .9
  saved.favoriteBeats = []
  expect(loadStudioProject(JSON.stringify(saved))).toEqual(saved)
})

it('validates every published animation and linked expression for all saved characters', () => {
  const project = publishedProject()
  for (const character of project.characters) {
    const definition = definitionOf(project, character)
    for (const animation of project.animations) for (const time of [0, .4, 2]) {
      const sample = sampleDefinition(definition, animation.id, time)
      expect(project.expressions.some(e => e.id === sample.expressionId)).toBe(true)
      expect(Number.isFinite(sample.pose.faceScale)).toBe(true)
    }
  }
})


it('restores standard rendering for projects saved with the retired wolf and 3D shader experiments', () => {
  const project = publishedProject()
  project.characters[0]!.shape = 'sphere'
  project.characters[0]!.toon = true
  project.characters[0]!.color = '#847bba'
  const saved = { ...project, characters: project.characters.map(character => ({ ...character, werewolf: true, shading3d: true })) }
  // Reloading browser storage and importing an app definition both discard only
  // the retired appearance flags, retaining every authored clip and beat.
  expect(loadStudioProject(JSON.stringify(saved))).toEqual(project)
  const definition = definitionOf(project, project.characters[0]!)
  const restored = parseProject({ ...definition, character: { ...definition.character, werewolf: true, shading3d: true } })
  expect(restored.characters[0]).toEqual(definition.character)
  expect(restored.expressions).toEqual(definition.expressions)
  expect(restored.animations).toEqual(definition.animations)
})
