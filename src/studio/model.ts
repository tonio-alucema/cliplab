export type Shape = 'capsule' | 'cap' | 'sphere'
export type Eye = 'dot' | 'soft' | 'closed' | 'wink' | 'star' | 'heart' | 'squint' | 'wide' | 'arc-up' | 'arc-down'
export type Mouth = 'smile' | 'open' | 'line' | 'frown' | 'oh' | 'wave' | 'sleep' | 'grin' | 'cry' | 'u-smile'
export type Prop = 'none' | 'zzz' | 'sparkle' | 'heart' | 'question' | 'sweat' | 'crown'
export type Detail = 'body' | 'eyes' | 'full'

export interface Pose {
  eye: Eye; mouth: Mouth; prop: Prop
  eyeSize: number; eyeHeight: number; spacing: number; eyeTilt: number
  leftScale: number; rightScale: number; gazeX: number; gazeY: number
  leftX: number; rightX: number; leftY: number; rightY: number; leftRotation: number; rightRotation: number
  mouthWidth: number; mouthOpen: number; faceScale: number; faceY: number
  rotationX: number; rotationY: number; rotationZ: number; squash: number
  tongue: boolean; teeth: boolean; drool: boolean; cheeks: boolean; tears: boolean; mouthStroke: number
}
export interface Beat { id: string; name: string; duration: number; pose: Pose }
export interface Expression { id: string; name: string; description: string; beats: Beat[] }
export interface Step { id: string; expressionId: string; duration: number }
export interface Animation { id: string; name: string; steps: Step[]; loop: boolean }
export interface Character {
  id: string; name: string; shape: Shape; color: string; color2: string; gradient: boolean
  gradientAngle: number; toon: boolean; candleLight: boolean; trueFront: boolean; lockPosition: boolean; eyeColor: string; iris: boolean
  elevated: boolean; elevation: number; shadow: boolean
  motion: number; speed: number; blink: boolean; blinkInterval: number; followCursor: boolean
}
export interface Definition { version: 1; character: Character; expressions: Expression[]; animations: Animation[] }
export interface Project { version: 1; name: string; characters: Character[]; expressions: Expression[]; animations: Animation[] }
export interface Sample { pose: Pose; blink: number; bob: number; breathe: number; expressionId: string; beatIndex: number; stepIndex: number; effectPhase?: number; propAmount?: number; tearAmount?: number }

export const EYES: Eye[] = ['dot', 'soft', 'closed', 'wink', 'star', 'heart', 'squint', 'wide', 'arc-up', 'arc-down']
export const MOUTHS: Mouth[] = ['smile', 'open', 'line', 'frown', 'oh', 'wave', 'sleep', 'grin', 'cry', 'u-smile']
export const PROPS: Prop[] = ['none', 'zzz', 'sparkle', 'heart', 'question', 'sweat', 'crown']
export const SHAPES: { id: Shape; name: string; ratio: string }[] = [
  { id: 'capsule', name: 'Capsule', ratio: '1:2' }, { id: 'cap', name: 'End cap', ratio: '1:1' }, { id: 'sphere', name: 'Circle', ratio: '1:1' }
]
export const PALETTES = [
  ['#ff986d', '#ffd092'], ['#81d4c1', '#c6efd2'], ['#a79ce8', '#d8cafa'],
  ['#f0ce58', '#fff1a5'], ['#ee98b2', '#ffd2da'], ['#72b6de', '#b9e4f5']
]

export function detailAt(size: number): Detail { return size < 16 ? 'body' : size <= 24 ? 'eyes' : 'full' }
export function uid(prefix = 'item') { return `${prefix}-${crypto.randomUUID().slice(0, 8)}` }
export function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
export const BASE_POSE: Pose = {
  eye: 'dot', mouth: 'smile', prop: 'none', eyeSize: 1, eyeHeight: 1, spacing: 1, eyeTilt: 0,
  leftScale: 1, rightScale: 1, gazeX: 0, gazeY: 0, mouthWidth: 1, mouthOpen: .5,
  leftX: 0, rightX: 0, leftY: 0, rightY: 0, leftRotation: 0, rightRotation: 0,
  faceScale: 1, faceY: 0, rotationX: 0, rotationY: 0, rotationZ: 0, squash: 1,
  tongue: false, teeth: false, drool: false, cheeks: false, tears: false, mouthStroke: 1
}
const p = (v: Partial<Pose> = {}): Pose => ({ ...BASE_POSE, ...v })
const b = (id: string, name: string, duration: number, pose: Partial<Pose>): Beat => ({ id, name, duration, pose: p(pose) })

export function defaultExpressions(): Expression[] {
  return [
    { id: 'idle', name: 'Idle', description: 'A little breath. A quiet smile.', beats: [
      b('idle-1', 'Settle', 1.8, {}), b('idle-2', 'Look around', 1.4, { gazeX: .22, rotationZ: -3, rotationY: 5 }), b('idle-3', 'Return', 1.8, {})
    ] },
    { id: 'listening', name: 'Listening', description: 'Present, curious, and all ears.', beats: [
      b('listen-1', 'Notice', 1.2, { eye: 'wide', mouth: 'line', eyeSize: 1.06, rotationX: -4 }), b('listen-2', 'Lean in', 1.5, { mouth: 'smile', eyeHeight: 1.13, rotationZ: 6, rotationX: -7 }), b('listen-3', 'Nod', 1.1, { mouth: 'smile', rotationX: 5, rotationZ: 3 })
    ] },
    { id: 'thinking', name: 'Thinking', description: 'A glance up. Something is taking shape.', beats: [
      b('think-1', 'Wonder', 1.5, { mouth: 'oh', mouthOpen: .23, mouthWidth: .6, gazeX: .6, gazeY: .55, rotationZ: -7, prop: 'question' }), b('think-2', 'Consider', 1.6, { eye: 'soft', mouth: 'wave', gazeX: -.35, gazeY: .2, rotationY: -8, rotationZ: 4 }), b('think-3', 'Almost', 1.2, { mouth: 'smile', gazeY: .25, rotationZ: -3 })
    ] },
    { id: 'working', name: 'Working', description: 'Small, focused, steady movements.', beats: [
      b('work-1', 'Focus left', 1.0, { eye: 'soft', mouth: 'line', mouthWidth: .65, gazeX: -.5, gazeY: -.3, rotationY: -7, rotationX: 4 }), b('work-2', 'Focus right', 1.0, { eye: 'soft', mouth: 'line', mouthWidth: .65, gazeX: .5, gazeY: -.3, rotationY: 7, rotationX: 4 }), b('work-3', 'Check', 1.4, { mouth: 'smile', rotationX: -3 })
    ] },
    { id: 'happy', name: 'Happy', description: 'A small open smile says it all.', beats: [
      b('happy-1', 'Light up', .9, { mouth: 'open', mouthOpen: .62, rotationZ: -5, squash: 1.025 }), b('happy-2', 'Delight', 1.3, { eye: 'arc-up', mouth: 'grin', mouthOpen: .8, prop: 'sparkle', rotationZ: 5, squash: .97 }), b('happy-3', 'Glow', 1.5, { mouth: 'open', mouthOpen: .5, rotationZ: -2 })
    ] },
    { id: 'confused', name: 'Confused', description: 'A little uneven. A second look.', beats: [
      b('confused-1', 'Wait', 1.2, { eye: 'soft', leftScale: .7, rightScale: 1.1, mouth: 'wave', rotationZ: 10, prop: 'question' }), b('confused-2', 'Really?', 1.4, { leftScale: 1.1, rightScale: .7, mouth: 'oh', mouthOpen: .25, rotationZ: -9, gazeX: -.2 }), b('confused-3', 'Hmm', 1.3, { eye: 'soft', mouth: 'frown', mouthWidth: .75, rotationZ: 4 })
    ] },
    { id: 'sleepy', name: 'Sleepy', description: 'Slow breathing, drifting sleep marks.', beats: [
      b('sleep-1', 'Doze', 2, { eye: 'arc-down', mouth: 'sleep', prop: 'zzz', drool: true, rotationZ: -6, rotationX: 4, squash: .97 }), b('sleep-2', 'Breathe in', 2, { eye: 'arc-down', mouth: 'oh', mouthOpen: .25, mouthWidth: .65, prop: 'zzz', drool: true, rotationZ: -3, squash: 1.025 }), b('sleep-3', 'Breathe out', 2, { eye: 'arc-down', mouth: 'sleep', prop: 'zzz', drool: true, rotationZ: -7, squash: .98 })
    ] },
    { id: 'sad', name: 'Sad', description: 'A round frown, a little lower.', beats: [
      b('sad-1', 'Low', 1.6, { mouth: 'frown', rotationZ: -3 }), b('sad-2', 'Sigh', 1.8, { eye: 'arc-down', mouth: 'frown', rotationX: 4 }), b('sad-3', 'Look up', 1.6, { mouth: 'frown', gazeY: .2 })
    ] },
    { id: 'tearful', name: 'Tearful', description: 'A trembling mouth and falling tears.', beats: [
      b('tear-1', 'Well up', 1.5, { mouth: 'cry', tears: true, mouthOpen: .6, rotationZ: -3 }), b('tear-2', 'Let go', 1.8, { mouth: 'cry', tears: true, mouthOpen: .85, eye: 'arc-down', rotationZ: 3 }), b('tear-3', 'Breathe', 1.8, { mouth: 'cry', tears: true, mouthOpen: .5 })
    ] },
    { id: 'playful', name: 'Playful', description: 'A wink, a grin, a little mischief.', beats: [
      b('play-1', 'Peek', 1.1, { mouth: 'open', tongue: true, rotationY: -10, rotationZ: -8 }), b('play-2', 'Wink', 1.2, { eye: 'squint', mouth: 'u-smile', tongue: true, mouthOpen: .7, rotationZ: 9, prop: 'sparkle' }), b('play-3', 'Grin', 1.3, { mouth: 'grin', cheeks: true, teeth: true, mouthOpen: .45, rotationZ: -3 })
    ] }
  ]
}
export function defaultProject(): Project {
  const base: Character = {
    id: 'milo', name: 'Milo', shape: 'capsule', color: '#ff986d', color2: '#ffd092', gradient: true,
    gradientAngle: 20, toon: true, candleLight: true, trueFront: false, lockPosition: false, eyeColor: '#080909', iris: false, elevated: false, elevation: .065,
    shadow: true, motion: .45, speed: 1, blink: true, blinkInterval: 4.2, followCursor: false
  }
  const expressions = defaultExpressions()
  const sequences: Record<string, [string, number][]> = {
    listening: [['listening', 3.8], ['idle', 1.6]],
    thinking: [['thinking', 4.3], ['working', 1.8]],
    working: [['working', 6.8], ['thinking', 2.2]],
    happy: [['happy', 3.7], ['playful', 2.4], ['idle', 1.8]],
    confused: [['confused', 3.9], ['thinking', 2.1]],
    playful: [['playful', 3.6], ['happy', 2.2]]
  }
  return {
    version: 1, name: 'My character studio',
    characters: [base, { ...base, id: 'pip', name: 'Pip', shape: 'cap', color: '#81d4c1', color2: '#c6efd2' }, { ...base, id: 'lumi', name: 'Lumi', shape: 'sphere', color: '#a79ce8', color2: '#d8cafa' }],
    expressions,
    animations: expressions.map((e) => ({
      id: e.id, name: e.id === 'happy' ? 'Success' : e.name, loop: true,
      steps: (sequences[e.id] ?? [[e.id, expressionDuration(e)] as [string, number]]).map(([expressionId, duration], i) => ({ id: `${e.id}-step-${i + 1}`, expressionId, duration }))
    }))
  }
}
const safeDuration = (value: number) => Number.isFinite(value) ? Math.max(.2, value) : 1
export function expressionDuration(expression: Expression) { return expression.beats.reduce((n, beat) => n + safeDuration(beat.duration), 0) }
export function animationDuration(animation: Animation) { return animation.steps.reduce((n, step) => n + safeDuration(step.duration), 0) }
export function definitionOf(project: Project, character: Character, animationIds?: string[]): Definition {
  const animations = project.animations.filter(a => !animationIds || animationIds.includes(a.id))
  const used = new Set(animations.flatMap(a => a.steps.map(s => s.expressionId)))
  return clone({ version: 1, character, expressions: animationIds ? project.expressions.filter(e => used.has(e.id)) : project.expressions, animations })
}
const numericKeys = Object.keys(BASE_POSE).filter(k => typeof BASE_POSE[k as keyof Pose] === 'number') as (keyof Pose)[]
export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const result = { ...(t < .5 ? a : b) }
  for (const key of numericKeys) {
    let delta = (b[key] as number) - (a[key] as number)
    if (key.startsWith('rotation')) delta = ((delta + 180) % 360 + 360) % 360 - 180
    ;(result as unknown as Record<string, unknown>)[key] = (a[key] as number) + delta * t
  }
  return result
}
const smooth = (t: number) => { const v = Math.max(0, Math.min(1, t)); return v * v * (3 - 2 * v) }
function featureAmount(a: unknown, b: unknown, blend: number) { return a === b ? 1 : blend < .5 ? 1 - smooth(blend * 2) : smooth((blend - .5) * 2) }
const mod = (t: number, d: number) => ((t % d) + d) % d
export function sampleExpression(expression: Expression, time: number): { pose: Pose; beatIndex: number; propAmount: number; tearAmount: number } {
  const duration = expressionDuration(expression)
  let t = mod(time, duration)
  for (let i = 0; i < expression.beats.length; i++) {
    const beat = expression.beats[i]!
    const beatDuration = safeDuration(beat.duration)
    if (t < beatDuration || i === expression.beats.length - 1) {
      const previous = expression.beats[(i - 1 + expression.beats.length) % expression.beats.length]!
      const transition = Math.min(.45, beatDuration * .4)
      const progress = Math.min(t / transition, 1)
      const eased = progress * progress * (3 - 2 * progress)
      return { pose: mixPose(previous.pose, beat.pose, eased), beatIndex: i, propAmount: featureAmount(previous.pose.prop, beat.pose.prop, eased), tearAmount: featureAmount(previous.pose.tears, beat.pose.tears, eased) }
    }
    t -= beatDuration
  }
  return { pose: p(), beatIndex: 0, propAmount: 1, tearAmount: 1 }
}
export function sampleDefinition(def: Definition, animationId: string, time: number, expressionId?: string): Sample {
  const speedTime = Math.max(0, time) * def.character.speed
  const animation = def.animations.find(a => a.id === animationId) ?? def.animations[0]
  let expression = def.expressions.find(e => e.id === expressionId) ?? def.expressions[0]!
  let local = speedTime, stepIndex = 0
  let previousExpression: Expression | undefined
  let blend = 1
  if (!expressionId && animation?.steps.length) {
    const total = animationDuration(animation)
    local = animation.loop ? mod(speedTime, total) : Math.min(speedTime, total - .00001)
    for (let i = 0; i < animation.steps.length; i++) {
      const step = animation.steps[i]!
      const stepDuration = safeDuration(step.duration)
      if (local < stepDuration || i === animation.steps.length - 1) {
        expression = def.expressions.find(e => e.id === step.expressionId) ?? expression
        stepIndex = i
        if (animation.steps.length > 1 && (i > 0 || animation.loop)) {
          const prev = animation.steps[(i - 1 + animation.steps.length) % animation.steps.length]!
          previousExpression = def.expressions.find(e => e.id === prev.expressionId)
          blend = Math.min(1, local / Math.min(.35, stepDuration * .2))
        }
        local = local / stepDuration * expressionDuration(expression)
        break
      }
      local -= stepDuration
    }
  }
  const sample = sampleExpression(expression, local)
  if (previousExpression && blend < 1) {
    const previous = sampleExpression(previousExpression, expressionDuration(previousExpression) - .00001)
    const eased = smooth(blend)
    const oldProp = previous.pose.prop, oldTears = previous.pose.tears
    sample.propAmount *= featureAmount(oldProp, sample.pose.prop, eased)
    sample.tearAmount *= featureAmount(oldTears, sample.pose.tears, eased)
    sample.pose = mixPose(previous.pose, sample.pose, eased)
  }
  // All secondary motion uses the cycle period, so exported loops close exactly.
  const period = expressionId ? expressionDuration(expression) : animation ? animationDuration(animation) : expressionDuration(expression)
  const phase = 2 * Math.PI * mod(speedTime, period) / period
  const blinkCount = Math.max(1, Math.round(period / def.character.blinkInterval))
  const blinkPhase = mod(speedTime + period * .17, period / blinkCount)
  const blink = def.character.blink && blinkPhase < .19 ? Math.sin(blinkPhase / .19 * Math.PI) ** 2 : 0
  return { ...sample, expressionId: expression.id, stepIndex, blink, effectPhase: mod(speedTime, period) / period * Math.max(1, Math.round(period / 2.4)), bob: Math.sin(phase) * def.character.motion, breathe: Math.cos(phase) * def.character.motion }
}

function obj(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('This file is not a ClipLab project.'); return v as Record<string, unknown> }
function num(v: unknown, fallback: number, low: number, high: number) { return typeof v === 'number' && Number.isFinite(v) ? Math.min(high, Math.max(low, v)) : fallback }
function str(v: unknown, fallback: string, max = 80) { return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback }
function color(v: unknown, fallback: string) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback }
function choice<T extends string>(v: unknown, options: T[], fallback: T) { return options.includes(v as T) ? v as T : fallback }
function boolean(v: unknown, fallback: boolean) { return typeof v === 'boolean' ? v : fallback }
function parsePose(value: unknown): Pose {
  const v = obj(value), pose = { ...BASE_POSE }
  const ranges: Record<string, [number, number]> = { mouthStroke: [.5, 2.2], leftX: [-60, 60], rightX: [-60, 60], leftY: [-60, 60], rightY: [-60, 60], leftRotation: [-90, 90], rightRotation: [-90, 90], eyeSize: [.35, 2], eyeHeight: [.15, 2], spacing: [.5, 1.6], eyeTilt: [-45, 45], leftScale: [.3, 1.8], rightScale: [.3, 1.8], gazeX: [-1, 1], gazeY: [-1, 1], mouthWidth: [.3, 1.7], mouthOpen: [.1, 1], faceScale: [.6, 1.4], faceY: [-.3, .3], rotationX: [-180, 180], rotationY: [-180, 180], rotationZ: [-180, 180], squash: [.8, 1.2] }
  for (const key of numericKeys) { const [lo, hi] = ranges[key]!; (pose as unknown as Record<string, unknown>)[key] = num(v[key], BASE_POSE[key] as number, lo, hi) }
  return { ...pose, eye: choice(v.eye, EYES, 'dot'), mouth: choice(v.mouth, MOUTHS, 'smile'), prop: choice(v.prop, PROPS, 'none'), tongue: boolean(v.tongue, false), teeth: boolean(v.teeth, false), drool: boolean(v.drool, false), cheeks: boolean(v.cheeks, false), tears: boolean(v.tears, false) }
}
export function parseCharacter(value: unknown): Character {
  const v = obj(value), d = defaultProject().characters[0]!
  return { ...d, id: str(v.id, uid('character')), name: str(v.name, 'Character'), shape: choice(v.shape, ['capsule', 'cap', 'sphere'], 'capsule'), color: color(v.color, d.color), color2: color(v.color2, d.color2), gradient: boolean(v.gradient, true), gradientAngle: num(v.gradientAngle, 20, -180, 180), toon: boolean(v.toon, true), candleLight: boolean(v.candleLight, false), trueFront: boolean(v.trueFront, false), lockPosition: boolean(v.lockPosition, false), eyeColor: color(v.eyeColor, d.eyeColor), iris: boolean(v.iris, false), elevated: boolean(v.elevated, false), elevation: num(v.elevation, .065, .005, .2), shadow: boolean(v.shadow, true), motion: num(v.motion, .45, 0, 1), speed: num(v.speed, 1, .25, 3), blink: boolean(v.blink, true), blinkInterval: num(v.blinkInterval, 4.2, 1, 12), followCursor: boolean(v.followCursor, false) }
}
export function parseProject(value: unknown): Project {
  const v = obj(value)
  if (v.version !== 1 || !Array.isArray(v.expressions) || !Array.isArray(v.animations)) throw new Error('Choose a ClipLab version 1 project or character definition.')
  const charactersRaw = Array.isArray(v.characters) ? v.characters : v.character ? [v.character] : []
  if (!charactersRaw.length || charactersRaw.length > 30 || !v.expressions.length || v.expressions.length > 100 || !v.animations.length || v.animations.length > 100) throw new Error('The project has an unsupported number of characters or sequences.')
  const expressions = v.expressions.map((item, index): Expression => {
    const e = obj(item)
    if (!Array.isArray(e.beats) || !e.beats.length || e.beats.length > 32) throw new Error('Each expression needs 1–32 beats.')
    return { id: str(e.id, `expression-${index}`), name: str(e.name, 'Expression'), description: str(e.description, '', 160), beats: e.beats.map((item, i) => { const b = obj(item); return { id: str(b.id, `beat-${i}`), name: str(b.name, `Beat ${i + 1}`), duration: num(b.duration, 1.5, .2, 15), pose: parsePose(b.pose) } }) }
  })
  if (new Set(expressions.map(e => e.id)).size !== expressions.length) throw new Error('Expression names in the file must have unique IDs.')
  const animations = v.animations.map((item, index): Animation => {
    const a = obj(item)
    if (!Array.isArray(a.steps) || !a.steps.length || a.steps.length > 64) throw new Error('Each animation needs 1–64 steps.')
    return { id: str(a.id, `animation-${index}`), name: str(a.name, 'Animation'), loop: boolean(a.loop, true), steps: a.steps.map((item, i) => { const s = obj(item); if (!expressions.some(e => e.id === s.expressionId)) throw new Error('An animation refers to a missing expression.'); return { id: str(s.id, `step-${i}`), expressionId: s.expressionId as string, duration: num(s.duration, 3, .2, 30) } }) }
  })
  const characters = charactersRaw.map(parseCharacter)
  if (new Set(characters.map(c => c.id)).size !== characters.length || new Set(animations.map(a => a.id)).size !== animations.length) throw new Error('Characters and animations need unique IDs.')
  return { version: 1, name: str(v.name, 'My character studio'), characters, expressions, animations }
}
