// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { CharacterRenderer } from './renderer'
import { BASE_POSE, defaultProject } from './model'
import { SvgCanvas } from './svg-canvas'
import { snapshotSvg } from './svg-snapshot'

// Exercise the production geometry and exporter; only GPU submission is replaced.
vi.mock('three', async original => ({ ...await original<typeof import('three')>(), WebGLRenderer: class {
  outputColorSpace = ''; clearDepth() {} setPixelRatio() {} setSize() {} setClearColor() {} dispose() {} forceContextLoss() {}
  render(scene: THREE.Scene, camera: THREE.Camera) { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
} }))
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => new SvgCanvas('canvas') as unknown as CanvasRenderingContext2D) })
afterEach(() => vi.restoreAllMocks())

/** Nonzero winding of the exported polygon paths, independent of draw ordering. */
function contains(path: string, point: { x: number; y: number }) {
  const contours: { x: number; y: number }[][] = []
  for (const match of path.matchAll(/([MLZ])(?:([\d.e+-]+) ([\d.e+-]+))?/g)) {
    if (match[1] === 'M') contours.push([])
    if (match[1] !== 'Z') contours.at(-1)!.push({ x: Number(match[2]), y: Number(match[3]) })
  }
  let winding = 0
  for (const contour of contours) for (let i = 0; i < contour.length; i++) {
    const a = contour[i]!, b = contour[(i + 1) % contour.length]!
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)
    if (a.y <= point.y && b.y > point.y && cross > 0) winding++
    if (a.y > point.y && b.y <= point.y && cross < 0) winding--
  }
  return winding !== 0
}

it('keeps the near skull face over deeper socket walls in angled SVGs', () => {
  const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 400, height: 320, displaySize: 400 })
  const character = { ...defaultProject().characters[1]!, bodyModification: 'skeleton' as const, trueFront: false }
  try {
    for (const yaw of [-55, 55]) {
      renderer.render(character, { pose: BASE_POSE, blink: 0, bob: 0, breathe: 0, expressionId: '', beatIndex: 0, stepIndex: 0 }, { rotation: { x: 0, y: yaw, z: 0 } })
      const scene = renderer.snapshotScene(), text = snapshotSvg(scene)
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
      // This point overlaps the near cap and a deeper projected socket wall.
      // The previous wrong SVG order painted a dark horizontal strip here.
      const origin = new THREE.Vector3(-Math.sign(yaw) * .06, .08, 8)
      const skull = scene.skeleton!.getObjectByName('skull') as THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshBasicMaterial[]>
      const hit = new THREE.Raycaster(origin, new THREE.Vector3(0, 0, -1)).intersectObject(skull)[0]!
      expect(hit).toBeDefined()
      const expected = '#' + skull.material[hit.face!.materialIndex]!.color.getHexString()
      const screen = origin.clone().project(scene.camera)
      const point = { x: (screen.x + 1) * 200, y: (1 - screen.y) * 160 }
      const paths = [...doc.querySelectorAll('[data-name="skull"] path')]
      const painted = paths.filter(path => contains(path.getAttribute('d')!, point)).at(-1)!.getAttribute('fill')
      expect(painted).toBe(expected)
      expect(paths.length).toBeLessThanOrEqual(2)
      // The rear coat creates color behind socket openings without covering bones.
      const back = doc.querySelector('[data-name="Back body"]')!
      expect(Number(back.getAttribute('opacity'))).toBeGreaterThan(0)
      expect(Number(back.getAttribute('opacity'))).toBeLessThan(1)
      expect(text.indexOf('data-name="Back body"')).toBeLessThan(text.indexOf('data-name="Inner skeleton"'))
      expect(text.indexOf('data-name="Inner skeleton"')).toBeLessThan(text.indexOf('data-name="Outer body"'))
    }
    renderer.render({ ...character, shape: 'capsule' }, { pose: BASE_POSE, blink: 0, bob: 0, breathe: 0, expressionId: '', beatIndex: 0, stepIndex: 0 })
    const plain = snapshotSvg(renderer.snapshotScene())
    expect(plain).not.toContain('data-name="Back body"')
    expect(plain).not.toContain('data-name="Inner skeleton"')
  } finally { renderer.dispose() }
})

it('exports the ghost hem as a filled silhouette without torn gaps or a convex-hull fill', () => {
  const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 400, height: 320, displaySize: 400 })
  const character = { ...defaultProject().characters[1]!, bodyModification: 'ghost' as const, trueFront: false }
  try {
    for (const phase of [0, .2, .4]) {
      renderer.render(character, { pose: BASE_POSE, blink: 0, bob: 0, breathe: 0, effectPhase: phase, expressionId: '', beatIndex: 0, stepIndex: 0 }, { rotation: { x: 0, y: 0, z: 0 } })
      const scene = renderer.snapshotScene(), doc = new DOMParser().parseFromString(snapshotSvg(scene), 'image/svg+xml')
      const paths = doc.querySelectorAll('[data-name="Outer body"] path')
      expect(paths).toHaveLength(1)
      const path = paths[0]!.getAttribute('d')!
      expect(path.length).toBeLessThan(45000)
      const ray = new THREE.Raycaster()
      const hits = (x: number, y: number) => {
        ray.setFromCamera(new THREE.Vector2(x / 200 - 1, 1 - y / 160), scene.camera)
        return ray.intersectObject(scene.body).length > 0
      }
      let tested = 0, empty = 0
      for (let x = 95.37; x < 306; x += 5) for (let y = 243.23; y < 274; y += 2) {
        const expected = hits(x, y)
        // Avoid subpixel simplification/rounding at the exact silhouette boundary.
        if (hits(x, y - .1) !== expected || hits(x, y + .1) !== expected) continue
        expect(contains(path, { x, y }), `phase ${phase}, pixel ${x},${y}`).toBe(expected)
        tested++; if (!expected) empty++
      }
      expect(tested).toBeGreaterThan(600)
      expect(empty).toBeGreaterThan(30)
    }
  } finally { renderer.dispose() }
})

it('keeps spherical skull toon patches visible and occluded exactly as the 3D surface turns', () => {
  const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 512, height: 512, displaySize: 512 })
  const sample = { pose: BASE_POSE, blink: 0, bob: 0, breathe: 0, expressionId: '', beatIndex: 0, stepIndex: 0 }
  let checked = 0
  try {
    for (const shape of ['cap', 'chunky-pill'] as const) for (const yaw of [0, 70, 110, 180]) {
      renderer.render({ ...defaultProject().characters[1]!, shape, bodyModification: 'skeleton', roundedSkull: true, trueFront: false }, sample, { rotation: { x: 0, y: yaw, z: 0 } })
      const scene = renderer.snapshotScene(), doc = new DOMParser().parseFromString(snapshotSvg(scene), 'image/svg+xml')
      const skull = scene.skeleton!.getObjectByName('skull') as THREE.Mesh
      const center = new THREE.Box3().setFromObject(skull).getCenter(new THREE.Vector3())
      const paths = [...doc.querySelectorAll('[data-name="Inner skeleton"] path')]
      const colorAt = (x: number, y: number) => {
        const hit = new THREE.Raycaster(new THREE.Vector3(x, y, 8), new THREE.Vector3(0, 0, -1)).intersectObject(scene.skeleton!, true)[0]
        if (!hit) return undefined
        const mesh = hit.object as THREE.Mesh
        const material = (Array.isArray(mesh.material) ? mesh.material[hit.face!.materialIndex] : mesh.material) as THREE.MeshBasicMaterial
        return '#' + material.color.getHexString()
      }
      for (const x of [-.22, -.15, -.10, -.02, .02, .10, .15, .22]) for (const dy of [-.171, -.123, -.077, -.025, .05, .15]) {
        const y = center.y + dy, expected = colorAt(x, y)
        if (!expected || [colorAt(x - .001, y), colorAt(x + .001, y), colorAt(x, y - .001), colorAt(x, y + .001)].some(color => color !== expected)) continue
        const screen = new THREE.Vector3(x, y, 8).project(scene.camera)
        const point = { x: (screen.x + 1) * 256, y: (1 - screen.y) * 256 }
        const painted = paths.filter(path => contains(path.getAttribute('d')!, point)).at(-1)?.getAttribute('fill')
        expect(painted, `${shape}, yaw ${yaw}, point ${x},${y}`).toBe(expected)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(250)
  } finally { renderer.dispose() }
}, 15000)
