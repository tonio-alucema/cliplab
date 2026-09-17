import type { Beat, Pose } from './model'

export const POSE_SECTIONS = {
  'Pose & props': ['rotationX', 'rotationY', 'rotationZ', 'squash', 'prop'],
  Eyes: ['eye', 'cheeks', 'faceScale', 'faceY', 'eyeSize', 'eyeHeight', 'spacing', 'eyeTilt', 'leftScale', 'rightScale', 'gazeX', 'gazeY'],
  'Eye placement & rotation': ['leftX', 'rightX', 'leftY', 'rightY', 'leftRotation', 'rightRotation'],
  Mouth: ['mouth', 'mouthStroke', 'mouthWidth', 'mouthOpen', 'tongue', 'teeth', 'drool', 'tears'],
  'Brows & blush': ['brows', 'blush'],
} as const satisfies Record<string, readonly (keyof Pose)[]>
export type BeatSection = keyof typeof POSE_SECTIONS | 'Gradient loop'
export interface BeatValues { section: BeatSection; pose: Partial<Pose>; gradientAction?: Beat['gradientAction']; gradientTurns?: number }

export function copyBeatValues(beat: Beat, section: BeatSection): BeatValues {
  if (section === 'Gradient loop') return { section, pose: {}, gradientAction: beat.gradientAction, gradientTurns: beat.gradientTurns }
  return { section, pose: Object.fromEntries(POSE_SECTIONS[section].map(key => [key, beat.pose[key]])) }
}
export function pasteBeatValues(beat: Beat, section: BeatSection, values?: BeatValues): boolean {
  if (!values || values.section !== section) return false
  if (section === 'Gradient loop') {
    if (values.gradientAction === undefined) delete beat.gradientAction; else beat.gradientAction = values.gradientAction
    if (values.gradientTurns === undefined) delete beat.gradientTurns; else beat.gradientTurns = values.gradientTurns
  } else beat.pose = { ...beat.pose, ...values.pose }
  return true
}
