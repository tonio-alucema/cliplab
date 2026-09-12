import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { bodyHeight, radiusAt, eyeRadius, effectEnvelope, drawFace, projectedEye, resolveEyeGazes, characterRotation, faceForSize } from './renderer'
import { BASE_POSE, defaultProject, detailAt, faceLayers } from './model'
import type { EyeGazes } from './gaze'
describe('compact faces above 16 through 48 CSS pixels', () => {
  const character = { ...defaultProject().characters[0]!, iris: true, eyeColor: '#663399' }
  const sample = { pose: { ...BASE_POSE, faceScale: .8 }, blink: 0, bob: 0, breathe: 0, expressionId: 'idle', beatIndex: 0, stepIndex: 0 }
  it('enlarges only the requested sizes, without changing the stored face or accumulating scale', () => {
    for (const size of [16.01, 23, 24, 24.01, 32, 48]) {
      const adapted = faceForSize(character, sample, size)
      expect(adapted.sample.pose.faceScale).toBeCloseTo(1.04)
      expect(adapted.sample.pose.eyeSize).toBeCloseTo(sample.pose.eyeSize * (size === 24 ? 1.2 : 1))
      expect(adapted.character.iris).toBe(false); expect(adapted.simpleEyes).toBe(true)
      expect(adapted.character.eyeColor).toBe(character.eyeColor)
    }
    for (const size of [48.01, 49, 96]) {
      const restored = faceForSize(character, sample, size)
      expect(restored.sample).toBe(sample); expect(restored.character.iris).toBe(character.iris)
      expect(restored.simpleEyes).toBe(false)
    }
    const shaded = { ...character, toon: true, shadow: true }
    for (const size of [12, 16, 24, 32, 47.99, 48, 96]) {
      const adapted = faceForSize(shaded, sample, size)
      expect(adapted.character.toon).toBe(size >= 48)
      expect(adapted.character.shadow).toBe(size >= 48)
      for (const key of ['gradient', 'color', 'color2', 'gradientAngle'] as const) expect(adapted.character[key]).toBe(shaded[key])
    }
    expect(shaded.toon).toBe(true); expect(shaded.shadow).toBe(true)
    expect(sample.pose.faceScale).toBe(.8); expect(character.iris).toBe(true)
  })
  it('draws black circles instead of pupils, hearts, cheek cuts or happy arcs, including during morphs', () => {
    for (const size of [24, 48]) for (const eye of ['pupil', 'heart', 'closed'] as const) for (const morphing of [false, true]) {
      const pose = { ...sample.pose, eye, eyeHeight: .3, cheeks: true, mouth: 'open' as const, faceSet: 'set-2' as const }
      const adapted = faceForSize(character, { ...sample, pose }, size)
      const circles: number[][] = [], colors: string[] = [], scales: number[][] = []
      let ink = '', clips = 0
      const ctx = new Proxy({}, {
        get: (_, key) => {
          if (key === 'arc') return (...args: number[]) => { if (ink === '#000000') circles.push(args) }
          if (key === 'fill') return () => colors.push(ink)
          if (key === 'clip') return () => clips++
          if (key === 'scale') return (...args: number[]) => scales.push(args)
          return () => {}
        },
        set: (_, key, value) => { if (key === 'fillStyle') ink = value; return true }
      }) as CanvasRenderingContext2D
      drawFace(ctx, adapted.sample.pose, adapted.character, 0, detailAt(size), { x: 0, y: 0 }, { simpleEyes: adapted.simpleEyes, faceLayers: morphing ? faceLayers(pose) : undefined })
      expect(circles).toHaveLength(2)
      expect(circles.every(c => c[2] === (size === 24 ? 27 * 1.2 : 27) && c[3] === 0 && c[4] === Math.PI * 2)).toBe(true)
      expect(scales.filter(s => s[0] === 1 && s[1] === 1)).toHaveLength(2)
      expect(colors).not.toContain('#ffffff'); expect(colors).not.toContain('#fffef9')
      expect(colors.slice(0, 2)).toEqual(['#000000', '#000000'])
      if (size === 48) expect(colors).toContain(character.eyeColor)
    }
  })
})
describe('vertical body cursor following', () => {
  it('looks equally far up and down despite manual or expression pitch', () => {
    const project = defaultProject(), character = { ...project.characters[0]!, followRotation: true, trueFront: false }
    const listening = project.expressions.find(e => e.id === 'listening')!.beats[1]!.pose
    for (const pose of [BASE_POSE, listening]) for (const pitch of [-80, -5, 40]) {
      const rest = { x: pitch, y: -12, z: -7 }
      const up = characterRotation(character, pose, rest, { x: 0, y: 1 })
      const down = characterRotation(character, pose, rest, { x: 0, y: -1 })
      const facing = (r: typeof rest) => new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(r.x * Math.PI / 180, r.y * Math.PI / 180, r.z * Math.PI / 180, 'YXZ'))
      expect(up.x).toBe(-16); expect(down.x).toBe(16)
      expect(facing(up).y).toBeGreaterThan(0); expect(facing(down).y).toBeLessThan(0)
      expect(facing(up).y).toBeCloseTo(-facing(down).y)
      expect(characterRotation(character, pose, rest).x).toBeCloseTo(0)
      expect(characterRotation({ ...character, followRotation: false }, pose, rest).x).toBe(pitch + pose.rotationX)
      expect(characterRotation({ ...character, trueFront: true }, pose, rest, { x: 1, y: -1 })).toEqual({ x: 0, y: 0, z: 0 })
    }
  })
})
describe('independent eye focus', () => {
  const character = { ...defaultProject().characters[0]!, iris: true }
  function rig(aspect = 1, zoom = 1) {
    const camera = new THREE.OrthographicCamera(-aspect / zoom, aspect / zoom, 1 / zoom, -1 / zoom, .1, 30)
    camera.position.z = 8; camera.updateMatrixWorld(true)
    return camera
  }
  it('converges between the eyes, centers under the pointer, and responds to fine movements', () => {
    const camera = rig(), matrix = new THREE.Matrix4()
    const left = projectedEye(character, BASE_POSE, 0, -1, matrix, camera), right = projectedEye(character, BASE_POSE, 0, 1, matrix, camera)
    const midpoint = left.center.clone().add(right.center).multiplyScalar(.5)
    const focus = (point: { x: number; y: number }) => resolveEyeGazes(character, BASE_POSE, 0, matrix, camera, { x: 0, y: 0 }, { ...point, weight: 1 })
    const crossed = focus(midpoint)
    expect(crossed.left.x).toBeGreaterThan(.8); expect(crossed.right.x).toBeLessThan(-.8)
    expect(crossed.left.y).toBeCloseTo(0); expect(crossed.right.y).toBeCloseTo(0)
    const overLeft = focus(left.center)
    expect(overLeft.left.x).toBeCloseTo(0); expect(overLeft.left.y).toBeCloseTo(0); expect(overLeft.right.x).toBeLessThan(-.9)
    const near = left.center.clone().lerp(left.right, .1)
    const moved = focus(near).left
    expect(moved.x).toBeGreaterThan(.05); expect(moved.x).toBeLessThan(.15)
    const idle = resolveEyeGazes(character, BASE_POSE, 0, matrix, camera, { x: 0, y: 0 }, { x: 0, y: 0, weight: 0 })
    expect(idle.left.x).toBeCloseTo(0); expect(idle.right.x).toBeCloseTo(0)
  })
  it('aims toward the actual pointer across body shapes, camera framing, eye offsets and rotation', () => {
    for (const shape of ['capsule', 'cap', 'sphere'] as const) for (const zoom of [.7, 1.4]) {
      const body = { ...character, shape, elevated: true, elevation: .08 }
      const pose = { ...BASE_POSE, faceScale: .8, faceY: .12, eyeTilt: 20, leftX: -12, rightY: 18, rightRotation: -35, eyeHeight: .7 }
      const root = new THREE.Group(); root.rotation.set(.12, .35, .6); root.position.y = .06; root.scale.set(.96, 1.1, .96); root.updateMatrixWorld(true)
      const camera = rig(1.7, zoom)
      const a = projectedEye(body, pose, .2, -1, root.matrixWorld, camera), b = projectedEye(body, pose, .2, 1, root.matrixWorld, camera)
      const pointer = a.center.clone().add(b.center).multiplyScalar(.5)
      const eyes = resolveEyeGazes(body, pose, .2, root.matrixWorld, camera, { x: 0, y: 0 }, { ...pointer, weight: 1 })
      for (const [projection, look] of [[a, eyes.left], [b, eyes.right]] as const) {
        const screen = projection.right.clone().sub(projection.center).multiplyScalar(look.x).add(projection.up.clone().sub(projection.center).multiplyScalar(look.y))
        const toward = pointer.clone().sub(projection.center)
        expect(screen.x * toward.x + screen.y * toward.y).toBeGreaterThan(0)
        expect(screen.x * toward.y - screen.y * toward.x).toBeCloseTo(0, 8)
        expect(Math.hypot(look.x, look.y)).toBeLessThanOrEqual(1)
      }
    }
  })
})
describe('three requested body profiles', () => {
  it('keeps exact 1:2 and 1:1 outer dimensions', () => {
    expect(bodyHeight('capsule')).toBe(2)
    expect(bodyHeight('cap')).toBe(1)
    expect(bodyHeight('sphere')).toBe(1)
    for (const shape of ['capsule', 'cap', 'sphere'] as const) expect(radiusAt(shape, 0) * 2).toBe(1)
  })
  it('rounds the end-cap base into its straight side without losing the flat underside', () => {
    expect(radiusAt('cap', -.5)).toBeCloseTo(.43)
    expect(radiusAt('cap', -.43)).toBe(.5)
    expect(radiusAt('cap', -.49)).toBeGreaterThan(.43)
    expect(radiusAt('cap', -.49)).toBeLessThan(.5)
  })
  it('elevates the face in depth without changing its frontal coordinates', () => {
    const x = .16, y = -.05, s = 1.08
    for (const shape of ['capsule', 'cap', 'sphere'] as const) {
      const attached = Math.sqrt(radiusAt(shape, y) ** 2 - x ** 2)
      const elevated = Math.sqrt((s * radiusAt(shape, y / s)) ** 2 - x ** 2)
      expect(elevated).toBeGreaterThan(attached)
    }
  })
})
describe('illustrative face and supporting motion', () => {
  function recordFace(gaze: { x: number; y: number }, overrides = {}, blink = 0, detail: 'full' | 'eyes' | 'body' = 'full', eyeGazes?: EyeGazes) {
    const dots: number[][] = [], positions: number[][] = []
    let fillStyle = '', clips = 0
    const ctx = new Proxy({}, {
      get: (_, key) => {
        if (key === 'fillStyle') return fillStyle
        if (key === 'arc') return (...args: number[]) => { if (fillStyle === '#ffffff') dots.push(args) }
        if (key === 'translate') return (...args: number[]) => positions.push(args)
        if (key === 'clip') return () => clips++
        return () => {}
      },
      set: (_, key, value) => { if (key === 'fillStyle') fillStyle = value; return true }
    }) as CanvasRenderingContext2D
    drawFace(ctx, { ...BASE_POSE, ...overrides }, { ...defaultProject().characters[0]!, iris: true }, blink, detail, gaze, { eyeGazes })
    return { dots, positions, clips }
  }
  it('moves white dots within clipped eyes while keeping the eyes and mouth in place', () => {
    const left = recordFace({ x: -1, y: 0 }), right = recordFace({ x: 1, y: 0 })
    expect(left.positions).toEqual(right.positions)
    expect(left.dots).toHaveLength(2); expect(right.dots).toHaveLength(2)
    expect(left.dots[0]![0]).toBeLessThan(-15); expect(right.dots[0]![0]).toBeGreaterThan(15)
    expect(left.clips).toBeGreaterThanOrEqual(2)
    const authored = recordFace({ x: 0, y: 0 }, { gazeX: 1 })
    expect(authored.dots).toEqual(right.dots)
  })
  it('draws independent inward directions without adding shared gaze a second time', () => {
    const eyes = { left: { x: .9, y: 0 }, right: { x: -.9, y: 0 } }
    const crossed = recordFace({ x: 1, y: 1 }, { gazeX: 1, leftRotation: 45 }, 0, 'full', eyes)
    expect(crossed.dots).toHaveLength(2)
    expect(crossed.dots[0]![0]).toBeGreaterThan(15); expect(crossed.dots[1]![0]).toBeLessThan(-15)
    expect(crossed.dots[0]![1]).toBeCloseTo(0); expect(crossed.dots[1]![1]).toBeCloseTo(0)
  })
  it('hides white dots on closed eyes, during a blink, and at small app sizes', () => {
    expect(recordFace({ x: 1, y: 1 }, { eye: 'closed' }).dots).toHaveLength(0)
    expect(recordFace({ x: 1, y: 1 }, {}, .8).dots).toHaveLength(0)
    expect(recordFace({ x: 1, y: 1 }, {}, 0, 'eyes').dots).toHaveLength(0)
    expect(recordFace({ x: 1, y: 1 }, {}, 0, 'body').dots).toHaveLength(0)
    expect(recordFace({ x: 0, y: -1 }, { cheeks: true }).clips).toBeGreaterThanOrEqual(4)
  })
  it('enlarges both black eyes by exactly 20% when the iris is enabled', () => {
    const character = defaultProject().characters[0]!
    for (const side of [-1, 1]) for (const detail of ['full', 'eyes'] as const) {
      const pose = { ...BASE_POSE, leftScale: .8, rightScale: 1.1 }
      expect(eyeRadius(pose, { ...character, iris: true }, detail, side) / eyeRadius(pose, { ...character, iris: false }, detail, side)).toBeCloseTo(1.2, 10)
    }
  })
  it('eases supporting elements in and out without a visible loop seam', () => {
    expect(effectEnvelope(0)).toBe(0); expect(effectEnvelope(1)).toBe(0)
    expect(effectEnvelope(.3)).toBe(1)
    expect(effectEnvelope(.00001)).toBeLessThan(.000001)
    expect(effectEnvelope(.99999)).toBeLessThan(.000001)
    expect(effectEnvelope(.09)).toBeCloseTo(.5)
  })
})
