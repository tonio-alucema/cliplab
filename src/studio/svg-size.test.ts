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
      const character = { ...defaultProject().characters[0]!, shape, iris: true, trueFront: false, toon: true, candleLight: true, shadow: true }
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

it('keeps directional toon shading compact without dropping any shade region', () => {
  const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 1080, height: 1080 })
  try {
    for (const shape of ['sphere', 'capsule', 'cap'] as const) {
      renderer.render({ ...defaultProject().characters[0]!, shape, toon: true, candleLight: false }, { pose: BASE_POSE, blink: 0, bob: 0, breathe: 0, expressionId: '', beatIndex: 0, stepIndex: 0 })
      const text = snapshotSvg(renderer.snapshotScene()), svg = new DOMParser().parseFromString(text, 'image/svg+xml')
      expect(svg.querySelector('[id$="-body"]')!.children).toHaveLength(3)
      expect([...svg.querySelectorAll('[id$="-body"] path')].every(p => p.getAttribute('d')!.length > 20)).toBe(true)
      expect(text.length).toBeLessThan(85000)
    }
  } finally { renderer.dispose() }
})
