import { expect, it } from 'vitest'
import { BASE_POSE, beatEndRotation, defaultProject, definitionOf, parseProject, sampleDefinition, sampleExpression, type Expression } from './model'
import { characterRotation } from './renderer'
import { copyBeatValues, pasteBeatValues } from './beat-values'
import { copyBeat, favoriteBeat, insertBeatAfter } from './beat-library'

const twirl = (degrees = 720): Expression => ({ id: 'twirl', name: 'Twirl', description: '', beats: [
  { id: 'spin', name: 'Spin', duration: 2, pose: { ...BASE_POSE }, rotationTravel: { x: 0, y: degrees, z: 0 } },
] })

it('plays every authored turn over the entire beat without shortest-path wrapping', () => {
  for (const degrees of [360, 720, -720, 1440]) {
    const e = twirl(degrees)
    expect(sampleExpression(e, .5).rotationTravel!.y).toBeCloseTo(degrees * (1 - Math.cos(Math.PI / 4)) / 2)
    expect(sampleExpression(e, 1).rotationTravel!.y).toBeCloseTo(degrees / 2)
    expect(sampleExpression(e, 1.99999).rotationTravel!.y).toBeCloseTo(degrees, 5)
    expect(sampleExpression(e, 2).rotationTravel?.y ?? 0).toBe(0)
  }
})

it('carries the end orientation into the next beat and supports all axes', () => {
  const e = twirl()
  e.beats[0]!.rotationTravel = { x: 360, y: 720, z: -360 }
  e.beats.push({ id: 'hold', name: 'Hold', duration: 1, pose: { ...BASE_POSE } })
  expect(beatEndRotation(e, 0)).toEqual({ x: 360, y: 720, z: -360 })
  expect(sampleExpression(e, 2).rotationTravel).toEqual(beatEndRotation(e, 0))
  expect(sampleExpression(e, 2.8).rotationTravel).toEqual(beatEndRotation(e, 0))
})

it('scales turns with animation step duration and playback speed', () => {
  const project = defaultProject(); project.expressions.push(twirl())
  project.animations = [{ id: 'twirl-animation', name: 'Twirl', loop: false, steps: [{ id: 'step', expressionId: 'twirl', duration: 4 }] }]
  const definition = definitionOf(project, project.characters[0]!)
  expect(sampleDefinition(definition, 'twirl-animation', 2).rotationTravel!.y).toBeCloseTo(360)
  definition.character.speed = 2
  expect(sampleDefinition(definition, 'twirl-animation', 1).rotationTravel!.y).toBeCloseTo(360)
  expect(sampleDefinition(definition, 'twirl-animation', 8).rotationTravel!.y).toBeCloseTo(720, 4)
})

it('adds turns to normal and cursor-follow orientation while honoring front lock', () => {
  const travel = { x: 30, y: 720, z: -360 }, pose = { ...BASE_POSE }, base = { x: 0, y: 0, z: 0 }
  expect(characterRotation({ trueFront: false, followRotation: false }, pose, base, undefined, travel)).toEqual(travel)
  expect(characterRotation({ trueFront: false, followRotation: true }, pose, base, { x: 1, y: 1 }, travel)).toEqual({ x: 14, y: 748, z: -360 })
  expect(characterRotation({ trueFront: true, followRotation: true }, pose, base, undefined, travel)).toEqual(base)
})

it('preserves authored turns in projects, clipboard copies, favorites, and section paste', () => {
  const project = defaultProject(), e = twirl(); project.expressions.push(e)
  const source = e.beats[0]!, target = project.expressions[0]!.beats[0]!
  favoriteBeat(project, source)
  insertBeatAfter(project.expressions[0]!, 0, copyBeat(source))
  const values = copyBeatValues(source, 'Pose & props')
  pasteBeatValues(target, 'Pose & props', values)
  source.rotationTravel!.y = 360
  expect(target.rotationTravel!.y).toBe(720)
  expect(project.favoriteBeats![0]!.beat.rotationTravel!.y).toBe(720)
  expect(parseProject(JSON.parse(JSON.stringify(project)))).toEqual(project)
  pasteBeatValues(target, 'Pose & props', copyBeatValues({ ...target, rotationTravel: undefined }, 'Pose & props'))
  expect(target.rotationTravel).toBeUndefined()
  const old = defaultProject(); expect(parseProject(old)).toEqual(old)
})
