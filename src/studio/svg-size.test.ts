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
    expect(turned.left.x - rest.left.x).toBeCloseTo(.5 * Math.cos(28 * Math.PI / 180))
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
