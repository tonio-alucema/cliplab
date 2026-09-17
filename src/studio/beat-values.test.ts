import { expect, it } from 'vitest'
import { BASE_POSE, type Beat } from './model'
import { copyBeatValues, pasteBeatValues, POSE_SECTIONS } from './beat-values'

const makeBeat = (): Beat => ({ id: 'beat', name: 'Beat', duration: 2, pose: { ...BASE_POSE } })
it('copies a snapshot of every section and preserves unrelated values on paste', () => {
  for (const section of Object.keys(POSE_SECTIONS) as (keyof typeof POSE_SECTIONS)[]) {
    const source = makeBeat(), target = makeBeat()
    source.pose = { ...BASE_POSE, mouth: 'oh', eye: 'star', prop: 'heart', mouthWidth: 1.3, rotationY: 25, leftX: 15, brows: 'angry', blush: .8 }
    const values = copyBeatValues(source, section)
    const snapshot = { ...source.pose }, before = { ...target.pose }
    source.pose.mouth = 'frown'; source.pose.leftX = -30
    expect(pasteBeatValues(target, section, values)).toBe(true)
    for (const key of Object.keys(BASE_POSE) as (keyof typeof BASE_POSE)[]) {
      expect(target.pose[key]).toEqual((POSE_SECTIONS[section] as readonly string[]).includes(key) ? snapshot[key] : before[key])
    }
    expect(target.id).toBe('beat'); expect(target.duration).toBe(2)
    target.pose.mouth = 'cry'
    expect(values.pose.mouth).not.toBe('cry')
  }
})
it('rejects empty or incompatible clipboards without changing the target', () => {
  const beat = makeBeat(), original = JSON.stringify(beat)
  expect(pasteBeatValues(beat, 'Mouth')).toBe(false)
  expect(pasteBeatValues(beat, 'Mouth', copyBeatValues(beat, 'Eyes'))).toBe(false)
  expect(JSON.stringify(beat)).toBe(original)
})
it('copies gradient beat settings without changing duration or face', () => {
  const source = { ...makeBeat(), gradientAction: 'rotate' as const, gradientTurns: 4 }, target = makeBeat()
  const values = copyBeatValues(source, 'Gradient loop')
  source.gradientTurns = 8
  pasteBeatValues(target, 'Gradient loop', values)
  expect(target.gradientTurns).toBe(4); expect(target.gradientAction).toBe('rotate')
  expect(target.pose).toEqual(BASE_POSE); expect(target.duration).toBe(2)
  pasteBeatValues(target, 'Gradient loop', copyBeatValues(makeBeat(), 'Gradient loop'))
  expect(target.gradientTurns).toBeUndefined(); expect(target.gradientAction).toBeUndefined()
})
