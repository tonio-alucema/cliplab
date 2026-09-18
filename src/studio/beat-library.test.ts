import { expect, it } from 'vitest'
import { copyBeat, favoriteBeat, insertBeatAfter, MAX_BEATS } from './beat-library'
import { defaultProject, parseProject } from './model'

it('copies every beat setting and inserts an independent beat directly after the target', () => {
  const project = defaultProject(), source = project.expressions[0]!.beats[0]!, target = project.expressions[1]!
  Object.assign(source, { gradientAction: 'rotate', gradientTurns: 4, duration: 3 })
  Object.assign(source.pose, { prop: 'heart', propCount: 5, browLength: 1.8 })
  const clipboard = copyBeat(source)
  source.pose.propCount = 1
  const nextId = target.beats[1]!.id
  expect(insertBeatAfter(target, 0, clipboard)).toBe(1)
  const inserted = target.beats[1]!
  expect(inserted.id).not.toBe(source.id)
  expect(inserted).toEqual({ ...clipboard, id: inserted.id })
  expect(target.beats[2]!.id).toBe(nextId)
  inserted.pose.propCount = 6
  expect(clipboard.pose.propCount).toBe(5)
  expect(source.pose.propCount).toBe(1)
  insertBeatAfter(target, 1, clipboard)
  expect(new Set(target.beats.map(b => b.id)).size).toBe(target.beats.length)
  expect(parseProject(JSON.parse(JSON.stringify(project))).expressions[1]).toEqual(target)
})

it('supports paste beyond four beats and rejects invalid positions and the import limit', () => {
  const expression = defaultProject().expressions[0]!, source = copyBeat(expression.beats[0]!)
  expect(insertBeatAfter(expression, -1, source)).toBeNull()
  expect(insertBeatAfter(expression, expression.beats.length, source)).toBeNull()
  while (expression.beats.length < MAX_BEATS) expect(insertBeatAfter(expression, expression.beats.length - 1, source)).not.toBeNull()
  expect(insertBeatAfter(expression, 0, source)).toBeNull()
  expect(expression.beats).toHaveLength(32)
})

it('persists favorites as snapshots that survive source edits and removal', () => {
  const project = defaultProject(), source = project.expressions[0]!.beats[0]!
  expect(favoriteBeat(project, source)).toBe(true)
  expect(favoriteBeat(project, source)).toBe(false)
  const savedName = source.name
  source.name = 'Changed'; source.pose.propSize = 2
  project.expressions[0]!.beats.shift()
  const restored = parseProject(JSON.parse(JSON.stringify(project)))
  expect(restored.favoriteBeats).toEqual(project.favoriteBeats)
  expect(restored.favoriteBeats![0]!.beat.name).toBe(savedName)
  expect(restored.favoriteBeats![0]!.beat.pose.propSize).toBe(1)
  expect(parseProject(defaultProject()).favoriteBeats ?? []).toEqual([])
})
