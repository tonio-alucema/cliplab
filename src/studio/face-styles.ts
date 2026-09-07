import { BASE_POSE, clone, uid, type Expression, type Pose } from './model'

export interface FacePreset { id: string; name: string; pose: Partial<Pose> }
export interface FaceStyleSet { id: Pose['faceSet']; name: string; description: string; presets: FacePreset[] }
export const FACE_SETS: FaceStyleSet[] = [
  { id: 'set-1', name: 'Set 1', description: 'Simple circles, rounded smiles, quiet gestures.', presets: [
    { id: 'happy', name: 'Happy', pose: { eye: 'dot', mouth: 'open', mouthOpen: .75 } },
    { id: 'delighted', name: 'Delighted', pose: { eye: 'arc-up', mouth: 'grin', mouthOpen: .65 } },
    { id: 'little-smile', name: 'Little smile', pose: { eye: 'squint', mouth: 'u-smile' } },
    { id: 'content', name: 'Content', pose: { eye: 'arc-down', mouth: 'open', mouthWidth: .63, mouthOpen: .4 } },
    { id: 'neutral', name: 'Neutral', pose: { eye: 'dot', mouth: 'line' } },
    { id: 'sad', name: 'Sad', pose: { eye: 'dot', mouth: 'frown' } },
    { id: 'tearful', name: 'Tearful', pose: { eye: 'dot', mouth: 'cry', tears: true, mouthOpen: .75 } },
    { id: 'cheeky', name: 'Cheeky', pose: { eye: 'dot', cheeks: true, mouth: 'grin', teeth: true } }
  ] },
  { id: 'set-2', name: 'Set 2', description: 'Bolder reactions, expressive brows, rosy cheeks, and playful mouths.', presets: [
    { id: 'laughing', name: 'Laughing', pose: { eye: 'squint', eyeSize: 1.12, mouth: 'grin', mouthWidth: .87, mouthOpen: .75, blush: .6, tongue: true } },
    { id: 'kiss', name: 'Kiss', pose: { eye: 'squint', mouth: 'kiss', blush: .85, prop: 'heart' } },
    { id: 'shy', name: 'Shy', pose: { eye: 'dot', eyeSize: .86, brows: 'worried', mouth: 'u-smile', mouthWidth: .55, blush: .65, gazeY: -.3 } },
    { id: 'lovestruck', name: 'Lovestruck', pose: { eye: 'heart', eyeSize: 1.6, mouth: 'smile', mouthWidth: .75, blush: .3, prop: 'heart' } },
    { id: 'mischievous', name: 'Mischievous', pose: { eye: 'half-lidded', eyeSize: 1.5, eyeTilt: -13, mouth: 'grin', mouthWidth: .6, mouthOpen: .25 } },
    { id: 'unimpressed', name: 'Unimpressed', pose: { eye: 'half-lidded', eyeSize: 1.4, mouth: 'line', mouthWidth: .7, gazeX: .4 } },
    { id: 'eye-roll', name: 'Eye roll', pose: { eye: 'pupil', eyeSize: 1.3, mouth: 'line', mouthWidth: .52, gazeY: 1 } },
    { id: 'surprised', name: 'Surprised', pose: { eye: 'pupil', eyeSize: 1.25, brows: 'raised', mouth: 'oh', mouthWidth: .68, mouthOpen: .85 } },
    { id: 'oops', name: 'Oops', pose: { eye: 'half-lidded', eyeSize: 1.1, leftScale: .85, brows: 'worried', mouth: 'wave', mouthWidth: .63, prop: 'sweat' } },
    { id: 'frustrated', name: 'Frustrated', pose: { eye: 'half-lidded', eyeSize: 1.1, eyeTilt: -20, brows: 'angry', mouth: 'frown', mouthWidth: .65 } },
    { id: 'tongue-out', name: 'Tongue out', pose: { eye: 'wink', mouth: 'tongue-out', mouthWidth: .8, mouthOpen: .8, blush: .2 } },
    { id: 'sobbing', name: 'Sobbing', pose: { eye: 'arc-down', brows: 'worried', mouth: 'cry', mouthOpen: .85, mouthWidth: .9, tears: true } }
  ] }
]

export function facePose(set: FaceStyleSet, preset: FacePreset): Pose { return { ...clone(BASE_POSE), ...preset.pose, faceSet: set.id } }
export function expressionFromFace(set: FaceStyleSet, preset: FacePreset): Expression {
  const pose = facePose(set, preset)
  return { id: uid(`${set.id}-${preset.id}`), name: preset.name, description: `${set.name} · ${set.description}`, beats: [
    { id: uid('beat'), name: 'Enter', duration: .9, pose: { ...pose, rotationZ: -3, gazeX: pose.gazeX - .15 } },
    { id: uid('beat'), name: 'Hold', duration: 1.8, pose: { ...pose, rotationZ: 2 } },
    { id: uid('beat'), name: 'Settle', duration: 1.3, pose: { ...pose, rotationZ: 0 } }
  ] }
}
