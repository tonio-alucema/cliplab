// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { CharacterRenderer } from './renderer'
import { BASE_POSE, defaultProject, faceLayers } from './model'
import { SvgCanvas } from './svg-canvas'
import { snapshotSvg } from './svg-snapshot'

// Keep the complete production scene/meshes/materials; replace only GPU submission.
vi.mock('three', async original => ({ ...await original<typeof import('three')>(), WebGLRenderer: class {
  outputColorSpace = ''; setPixelRatio() {} setSize() {} setClearColor() {} dispose() {} forceContextLoss() {}
  render(scene: THREE.Scene, camera: THREE.Camera) { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
} }))
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => new SvgCanvas('canvas') as unknown as CanvasRenderingContext2D) })
afterEach(() => vi.restoreAllMocks())
it('exports production meshes with four semantic groups and no per-triangle SVG layers', () => {
  const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 1080, height: 1080 })
  try {
    for (const shape of ['sphere', 'capsule', 'cap'] as const) for (const rotation of [{ x: 0, y: 0, z: 0 }, { x: -5, y: -12, z: -7 }, { x: 20, y: 65, z: 17 }]) {
      const character = { ...defaultProject().characters[0]!, shape, iris: true, trueFront: false, toon: true, shadow: true }
      const pose = { ...BASE_POSE, cheeks: true, mouth: 'open' as const, teeth: true }
      renderer.render(character, { pose, faceLayers: faceLayers(pose), blink: 0, bob: 0, breathe: 0, expressionId: '', beatIndex: 0, stepIndex: 0 }, { rotation })
      const text = snapshotSvg(renderer.snapshotScene()), svg = new DOMParser().parseFromString(text, 'image/svg+xml')
      expect(svg.querySelector('parsererror, image, use')).toBeNull()
      expect(text).not.toMatch(/NaN|Infinity|face-triangle/)
      expect(svg.documentElement.querySelectorAll(':scope > g')).toHaveLength(4)
      expect(svg.querySelectorAll('path').length).toBeLessThan(35)
      expect(new TextEncoder().encode(text).length).toBeLessThan(65000)
      for (const label of ['body', 'candle-light']) expect(svg.querySelector(`[id$="-${label}"]`)!.children).toHaveLength(1)
    }
  } finally { renderer.dispose() }
})
it('uses up-left resting iris, half-rate body gaze, and a fixed reduced-motion gaze in the actual renderer', () => {
  const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 400, height: 400 })
  const character = { ...defaultProject().characters[0]!, iris: true, followCursor: false, followRotation: false, trueFront: false }
  const sample = { pose: BASE_POSE, blink: 0, bob: 0, breathe: 0, expressionId: '', beatIndex: 0, stepIndex: 0 }
  try {
    renderer.render(character, sample, { rotation: { x: 0, y: 0, z: 0 }, cursor: { x: 1, y: 0 } })
    const rest = renderer.eyeGazes()!
    expect(rest.left).toEqual({ x: -.22, y: .22 }); expect(rest.right).toEqual(rest.left)
    renderer.render({ ...character, followRotation: true }, sample, { cursor: { x: 1, y: 0 } })
    const turned = renderer.eyeGazes()!
    expect(turned.left.x - rest.left.x).toBeCloseTo(.575 * Math.cos(28 * Math.PI / 180))
    renderer.render({ ...character, followRotation: true, followCursor: true }, sample, { reducedMotion: true, cursor: { x: -1, y: -1 }, pointerLook: { x: -4, y: -4, weight: 1 } }, { x: -1, y: -1 })
    expect(renderer.eyeGazes()).toEqual(rest)
  } finally { renderer.dispose() }
})

it('uses one rounded lighting region for all three shapes and captures its cursor offset in SVG', () => {
  const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 1080, height: 1080 })
  const sample = { pose: { ...BASE_POSE, rotationX: 0, rotationY: 0, rotationZ: 0 }, blink: 0, bob: 0, breathe: 0, expressionId: '', beatIndex: 0, stepIndex: 0 }
  const innerPath = (text: string) => new DOMParser().parseFromString(text, 'image/svg+xml').querySelector('[id$="-candle-light"] path')!.getAttribute('d')
  try {
    for (const shape of ['sphere', 'capsule', 'cap'] as const) for (const tracking of [{ followCursor: true, followRotation: true }, { followCursor: false, followRotation: true }]) {
      const character = { ...defaultProject().characters[0]!, shape, toon: true, trueFront: false, ...tracking }
      const positions: THREE.Vector3[] = [], paths: (string | null)[] = []
      for (const cursor of [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }]) {
        renderer.render(character, sample, { cursor, rotation: { x: 15, y: 25, z: 60 } })
        const state = renderer.snapshotScene()
        expect(state.lightFill.visible).toBe(true)
        expect(state.body.material.fragmentShader).not.toContain('vWorldNormal')
        expect(state.body.material.uniforms.toonOn!.value).toBe(1)
        positions.push(state.lightFill.getWorldPosition(new THREE.Vector3()).sub(state.body.getWorldPosition(new THREE.Vector3())))
        const text = snapshotSvg(state); paths.push(innerPath(text))
        expect(new DOMParser().parseFromString(text, 'image/svg+xml').querySelectorAll('linearGradient')).toHaveLength(2)
        expect(text.length).toBeLessThan(65000)
      }
      expect(positions[1]!.x - positions[0]!.x).toBeCloseTo(.09)
      expect(positions[3]!.y - positions[2]!.y).toBeCloseTo(.09)
      expect(positions.every(p => Math.abs(p.z) < 1e-6 && p.length() < .07)).toBe(true)
      expect(paths[0]).not.toBe(paths[1]); expect(paths[2]).not.toBe(paths[3])
      for (const options of [{ reducedMotion: true }, { reducedMotion: false }]) {
        const staticCharacter = options.reducedMotion ? character : { ...character, followCursor: true, followRotation: false }
        const offsets: THREE.Vector3[] = []
        for (const cursor of [{ x: -1, y: -1 }, { x: 1, y: 1 }]) {
          renderer.render(staticCharacter, sample, { ...options, cursor })
          const state = renderer.snapshotScene()
          offsets.push(state.lightFill.getWorldPosition(new THREE.Vector3()).sub(state.body.getWorldPosition(new THREE.Vector3())))
        }
        expect(offsets[0]!.x).toBeCloseTo(-.015); expect(offsets[0]!.y).toBeCloseTo(.015)
        expect(offsets[0]!.distanceTo(offsets[1]!)).toBeLessThan(1e-6)
      }
      for (const displaySize of [24, 47, 48, 96]) {
        renderer.render(character, sample, { displaySize })
        expect(renderer.snapshotScene().lightFill.visible).toBe(displaySize >= 48)
      }
      renderer.render({ ...character, toon: false }, sample, { displaySize: 1080 })
      expect(renderer.snapshotScene().lightFill.visible).toBe(false)
      expect(renderer.snapshotScene().body.material.uniforms.toonOn!.value).toBe(0)
    }
  } finally { renderer.dispose() }
})

it('renders sleep marks in the foreground at every body angle and preserves that ordering in SVG', () => {
  const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 400, height: 400 })
  const character = defaultProject().characters[0]!
  const sample = { pose: { ...BASE_POSE, prop: 'zzz' as const }, effectPhase: .4, blink: 0, bob: 0, breathe: 0, expressionId: '', beatIndex: 0, stepIndex: 0 }
  try {
    for (const y of [-120, 0, 120, 180]) {
      renderer.render(character, sample, { rotation: { x: 15, y, z: -8 } })
      const state = renderer.snapshotScene()
      expect(state.prop.material.depthTest).toBe(false); expect(state.prop.renderOrder).toBe(2)
      const svg = new DOMParser().parseFromString(snapshotSvg(state), 'image/svg+xml')
      const prop = svg.querySelector('[id$="-supporting-elements"]')!
      expect(prop.getAttribute('mask')).toBeNull()
      expect(prop.parentElement!.lastElementChild).toBe(prop)
    }
    renderer.render(character, { ...sample, pose: { ...sample.pose, prop: 'heart' } })
    expect(renderer.snapshotScene().prop.material.depthTest).toBe(true)
    expect(renderer.snapshotScene().prop.renderOrder).toBe(0)
  } finally { renderer.dispose() }
})

it('fits every small preset consistently and enforces front-only gradient detail at the boundaries', () => {
  const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 96, height: 96 })
  const original = { ...defaultProject().characters[0]!, trueFront: false, lockPosition: false, followRotation: true, toon: true, iris: true }
  const sample = { pose: { ...BASE_POSE, squash: 1.1, rotationX: 20, rotationY: 30, rotationZ: 15 }, blink: 0, bob: 1, breathe: 1, expressionId: '', beatIndex: 0, stepIndex: 0 }
  try {
    for (const shape of ['sphere', 'capsule', 'cap'] as const) for (const size of [12, 16, 24, 48, 96]) {
      renderer.resize(size, size, size)
      renderer.render({ ...original, shape }, sample, { rotation: { x: 20, y: 50, z: 30 }, cursor: { x: 1, y: -1 }, zoom: 1.4 })
      const state = renderer.snapshotScene()
      expect(state.face.visible).toBe(size > 16)
      expect(state.lightFill.visible).toBe(size >= 48)
      if (size <= 24) {
        expect(renderer.orientation().angleTo(new THREE.Quaternion())).toBeCloseTo(0)
        expect(state.body.getWorldPosition(new THREE.Vector3()).length()).toBe(0)
        expect(state.body.getWorldScale(new THREE.Vector3()).toArray()).toEqual([1, 1, 1])
        const box = new THREE.Box3().setFromObject(state.body)
        const top = new THREE.Vector3(0, box.max.y, 0).project(state.camera)
        const bottom = new THREE.Vector3(0, box.min.y, 0).project(state.camera)
        expect((top.y - bottom.y) / 2).toBeCloseTo(1 / 1.1, 2)
        const svg = snapshotSvg(state)
        expect(svg).not.toMatch(/NaN|Infinity/)
        expect(new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('[id$="-candle-light"]')).toBeNull()
      }
    }
    expect(original.trueFront).toBe(false); expect(original.toon).toBe(true)
  } finally { renderer.dispose() }
})

it('squares the end-cap bottom at 24px and restores its fillet above the threshold', () => {
  const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 96, height: 96 })
  const character = { ...defaultProject().characters[0]!, shape: 'cap' as const }
  const sample = { pose: BASE_POSE, blink: 0, bob: 0, breathe: 0, expressionId: '', beatIndex: 0, stepIndex: 0 }
  try {
    for (const size of [96, 24, 16, 24.01, 12, 48]) {
      renderer.render(character, sample, { displaySize: size })
      const state = renderer.snapshotScene(), positions = state.body.geometry.attributes.position!
      let bottomRadius = 0
      for (let i = 0; i < positions.count; i++) if (Math.abs(positions.getY(i) + .5) < 1e-5) bottomRadius = Math.max(bottomRadius, Math.hypot(positions.getX(i), positions.getZ(i)))
      expect(bottomRadius).toBeCloseTo(size <= 24 ? .5 : .43, 5)
      expect(snapshotSvg(state)).not.toMatch(/NaN|Infinity/)
    }
  } finally { renderer.dispose() }
})

it('keeps rotating bodies inside the 48px and 96px canvas with a clear margin', () => {
  const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 96, height: 96 })
  const sample = { pose: { ...BASE_POSE, squash: 1.1 }, blink: 0, bob: 1, breathe: 1, expressionId: '', beatIndex: 0, stepIndex: 0 }
  try {
    for (const shape of ['sphere', 'cap', 'capsule'] as const) for (const size of [48, 96]) {
      renderer.resize(size, size, size)
      let previousHalf: number | undefined
      for (const x of [0, 45, 90]) for (const y of [0, 45, 90]) for (const z of [0, 45, 90]) {
        renderer.render({ ...defaultProject().characters[0]!, shape, trueFront: false, followRotation: false, lockPosition: false }, sample, { rotation: { x, y, z } })
        const state = renderer.snapshotScene(), vertices = state.body.geometry.attributes.position!
        let extent = 0
        for (let i = 0; i < vertices.count; i++) {
          const point = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(state.body.matrixWorld).project(state.camera)
          extent = Math.max(extent, Math.abs(point.x), Math.abs(point.y))
        }
        expect(extent).toBeLessThanOrEqual(.901)
        if (previousHalf !== undefined) expect(state.camera.top).toBe(previousHalf)
        previousHalf = state.camera.top
      }
    }
  } finally { renderer.dispose() }
})

it('locks the 24px eye positions to a leftward gaze despite cursor and animated offsets', () => {
  const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 24, height: 24 })
  const character = { ...defaultProject().characters[0]!, followCursor: true }
  const sample = { pose: { ...BASE_POSE, gazeX: 1, gazeY: 1, leftX: 30, rightY: 25, faceY: .1 }, blink: 0, bob: 0, breathe: 0, expressionId: '', beatIndex: 0, stepIndex: 0 }
  try {
    for (const x of [-1, 0, 1]) for (const reducedMotion of [false, true]) {
      renderer.render(character, sample, { displaySize: 24, cursor: { x, y: 1 }, reducedMotion }, { x, y: 1 })
      const state = renderer.snapshotScene()
      expect(state.gaze).toEqual({ x: 0, y: 0 })
      expect(state.sample.pose).toMatchObject({ gazeX: -4, gazeY: 0, leftX: 0, rightY: 0, spacing: BASE_POSE.spacing * .7, faceY: BASE_POSE.faceY })
    }
    renderer.render(character, sample, { displaySize: 48, reducedMotion: false }, { x: 1, y: 1 })
    expect(renderer.snapshotScene().sample.pose.gazeX).toBe(1)
    expect(sample.pose.leftX).toBe(30)
  } finally { renderer.dispose() }
})
