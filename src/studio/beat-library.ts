import { clone, uid, type Beat, type Expression, type Project } from './model'

export const MAX_BEATS = 32

/** Clipboard and library entries are independent snapshots, never live references. */
export function copyBeat(beat: Beat): Beat { return clone(beat) }

export function insertBeatAfter(expression: Expression, index: number, source: Beat): number | null {
  if (expression.beats.length >= MAX_BEATS || index < 0 || index >= expression.beats.length) return null
  const beat = copyBeat(source)
  beat.id = uid('beat')
  expression.beats.splice(index + 1, 0, beat)
  return index + 1
}

export function favoriteBeat(project: Project, source: Beat) {
  const favorites = project.favoriteBeats ??= []
  if (favorites.some(f => f.sourceBeatId === source.id) || favorites.length >= 200) return false
  favorites.push({ id: uid('favorite'), sourceBeatId: source.id, beat: copyBeat(source) })
  return true
}
