// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { CharacterRenderer } from './renderer'
import { BASE_POSE, defaultProject, definitionOf, parseCharacter, parseProject, sampleDefinition } from './model'
import { SvgCanvas } from './svg-canvas'
import { snapshotSvg } from './svg-snapshot'
import { hasWolfSkin } from './werewolf'

vi.mock('three', async original => ({ ...await original<typeof import('three')>(), WebGLRenderer: class {
  outputColorSpace = ''; clearDepth() {} setPixelRatio() {} setSize() {} setClearColor() {} dispose() {} forceContextLoss() {}
  render(scene: THREE.Scene, camera: THREE.Camera) { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
} }))
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => new SvgCanvas('canvas') as unknown as CanvasRenderingContext2D) })
afterEach(() => vi.restoreAllMocks())
const sample = { pose: BASE_POSE, blink: 0, bob: 0, breathe: 0, expressionId: '', beatIndex: 0, stepIndex: 0 }

it('round-trips the Circle skin through app/project exports without changing expression timing', () => {
  const project = defaultProject(), character = { ...project.characters[0]!, shape: 'sphere' as const, werewolf: true }
  project.characters[0] = character
  expect(parseProject(JSON.parse(JSON.stringify(project))).characters[0]).toEqual(character)
  const definition = definitionOf(project, character)
  expect(parseProject(definition).characters[0]!.werewolf).toBe(true)
  expect(sampleDefinition(definition, 'sleepy', 2)).toEqual(sampleDefinition(definitionOf(project, { ...character, werewolf: false }), 'sleepy', 2))
  expect(hasWolfSkin(parseCharacter({ ...character, shape: 'cap' }))).toBe(false)
  expect(parseCharacter({ ...character, werewolf: 'true' }).werewolf).toBe(false)
  expect(parseCharacter({}).werewolf).toBe(false)
})

it('retains the skin across shape switches, fits every rotation and releases its resources', () => {
  const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 256, height: 256 })
  const character = { ...defaultProject().characters[0]!, shape: 'sphere' as const, werewolf: true, trueFront: false }
  renderer.render(character, sample)
  const wolf = renderer.snapshotScene().wolf!
  const disposal = vi.fn(); (wolf.children[0] as THREE.Mesh).geometry.addEventListener('dispose', disposal)
  try {
    for (const size of [16, 32, 48, 96, 256]) for (const y of [0, 45, 90, 180, 270, 720]) {
      renderer.render(character, sample, { displaySize: size, rotation: { x: 25, y, z: 30 } })
      const scene = renderer.snapshotScene()
      expect(scene.wolf).toBe(wolf)
      let extent = 0
      scene.wolf!.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return
        const positions = object.geometry.getAttribute('position')
        for (let i = 0; i < positions.count; i++) {
          const projected = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(scene.camera)
          extent = Math.max(extent, Math.abs(projected.x), Math.abs(projected.y))
        }
      })
      expect(extent).toBeLessThan(1)
    }
    renderer.render({ ...character, shape: 'cap' }, sample)
    expect(renderer.snapshotScene().wolf).toBeUndefined()
    renderer.render(character, sample)
    expect(renderer.snapshotScene().wolf).toBe(wolf)
  } finally { renderer.dispose() }
  expect(disposal).toHaveBeenCalledOnce()
})

it('exports compact editable skin paths and hides front mask behind the body on rear views', () => {
  const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 400, height: 400 })
  const character = { ...defaultProject().characters[0]!, shape: 'sphere' as const, werewolf: true, trueFront: false }
  try {
    for (const y of [0, 55, 180]) {
      renderer.render(character, sample, { rotation: { x: 0, y, z: 0 } })
      const svg = snapshotSvg(renderer.snapshotScene())
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
      expect(doc.querySelector('[data-name="Shaggy wolf skin"]')).not.toBeNull()
      expect(svg).not.toMatch(/NaN|Infinity|<image|data:image/)
      expect(svg.length).toBeLessThan(400000)
      expect(doc.querySelectorAll('[data-name="Shaggy wolf skin"] path').length).toBeLessThan(35)
      const mask = doc.querySelector('[data-name="facial-mask"]')!
      expect(mask.querySelectorAll('path').length).toBe(y === 180 ? 0 : 1)
    }
  } finally { renderer.dispose() }
}, 30000)


it('switches between soft 3D and toon without combining their lighting or losing settings', () => {
  const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 320, height: 320 })
  const character = { ...defaultProject().characters[0]!, shape: 'sphere' as const, werewolf: true, shading3d: true, toon: true, trueFront: false }
  try {
    renderer.render(character, sample)
    const scene = renderer.snapshotScene(), skin = scene.wolf!
    expect(scene.body.material.uniforms.softLighting!.value).toBe(1)
    expect(scene.body.material.uniforms.toonOn!.value).toBe(0)
    expect(scene.lightFill.visible).toBe(false)
    expect(skin.getObjectByName('muzzle')!.visible).toBe(true)
    const geometry = (skin.children[0] as THREE.Mesh).geometry
    const disposed = vi.fn(); geometry.addEventListener('dispose', disposed)
    for (const y of [0, 55, 180, 720]) {
      renderer.render(character, sample, { rotation: { x: 20, y, z: 25 } })
      const current = renderer.snapshotScene()
      let extent = 0
      current.wolf!.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return
        const positions = object.geometry.getAttribute('position')
        for (let i = 0; i < positions.count; i++) {
          const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(current.camera)
          extent = Math.max(extent, Math.abs(p.x), Math.abs(p.y))
        }
      })
      expect(extent).toBeLessThan(1)
    }
    const svg = snapshotSvg(renderer.snapshotScene())
    expect(svg).toContain('soft-vector-approximation')
    expect(svg).toContain('<radialGradient')
    expect(svg).not.toMatch(/NaN|Infinity|<image/)
    expect(svg.length).toBeLessThan(500000)
    renderer.render({ ...character, shading3d: false }, sample)
    expect(disposed).toHaveBeenCalledOnce()
    const toon = renderer.snapshotScene()
    expect(toon.body.material.uniforms.softLighting!.value).toBe(0)
    expect(toon.body.material.uniforms.toonOn!.value).toBe(1)
    expect(toon.lightFill.visible).toBe(true)
    expect(toon.wolf!.getObjectByName('muzzle')).toBeUndefined()
    expect(character.toon).toBe(true)
    renderer.render(character, sample, { displaySize: 24 })
    expect(renderer.snapshotScene().body.material.uniforms.softLighting!.value).toBe(0)
    expect(character.shading3d).toBe(true)
  } finally { renderer.dispose() }
}, 30000)

it('preserves 3D shading in saved definitions and defaults old definitions to toon', () => {
  expect(parseCharacter({ shading3d: true }).shading3d).toBe(true)
  expect(parseCharacter({ shading3d: 'yes' }).shading3d).toBe(false)
  expect(parseCharacter({}).shading3d).toBe(false)
  const project = defaultProject(); project.characters[0]!.shading3d = true
  expect(parseProject(definitionOf(project, project.characters[0]!)).characters[0]!.shading3d).toBe(true)
})
