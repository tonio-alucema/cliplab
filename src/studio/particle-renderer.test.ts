// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { CharacterRenderer, drawProp } from './renderer'
import { BASE_POSE, defaultProject, sampleDefinition, type Definition, type Prop, type Sample } from './model'
import { particleLayout } from './particles'
import { ParticleVectors } from './particle-vectors'
import { SvgCanvas } from './svg-canvas'
import { snapshotSvg } from './svg-snapshot'

// Preserve production geometry, transforms, and vector drawing; replace GPU submission only.
vi.mock('three', async original => ({ ...await original<typeof import('three')>(), WebGLRenderer: class {
  outputColorSpace = ''; clearDepth() {} setPixelRatio() {} setSize() {} setClearColor() {} dispose() {} forceContextLoss() {}
  render(scene: THREE.Scene, camera: THREE.Camera) { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
} }))
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => new SvgCanvas('canvas') as unknown as CanvasRenderingContext2D) })
afterEach(() => vi.restoreAllMocks())

const parse = (text: string) => new DOMParser().parseFromString(text, 'image/svg+xml')
const sampleFor = (prop: Prop, effectPhase?: number): Sample => ({ pose: { ...BASE_POSE, prop }, effectPhase, blink: 0, bob: 0, breathe: 0, expressionId: '', beatIndex: 0, stepIndex: 0 })
const supportingArt = (renderer: CharacterRenderer) => parse(snapshotSvg(renderer.snapshotScene())).querySelector('[data-name="Supporting elements"]')!

it('draws supplied question and star artwork as editable gold paths, preserving particle count controls', () => {
  for (const prop of ['question', 'sparkle'] as const) for (const [propCount, expected] of [[0, 3], [1, 1], [6, 6]] as const) {
    const canvas = new SvgCanvas('test')
    // Deliberately pass another color: the supplied artwork should retain its own exact gold.
    drawProp(canvas as unknown as CanvasRenderingContext2D, prop, '#ff00ff', undefined, { propCount })
    const markup = canvas.markup(), svg = parse(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`)
    expect(svg.querySelector('parsererror, text, image, use')).toBeNull()
    const paths = [...svg.querySelectorAll('path')]
    expect(paths).toHaveLength(expected)
    for (const path of paths) {
      expect(path.getAttribute('fill')).toBe('#FFBE16')
      expect(path.getAttribute('d')).toContain('C')
      expect(path.getAttribute('transform')).toMatch(/^matrix\(/)
    }
    drawProp(canvas as unknown as CanvasRenderingContext2D, prop, '#ff00ff', undefined, { propCount })
    expect(canvas.markup()).toBe(markup)
  }
})

it('keeps cycling icons above and right of the body and in front at front, back, and rolled views', () => {
  const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 400, height: 400 })
  const base = { ...defaultProject().characters[0]!, trueFront: false, followRotation: false, lockPosition: false }
  try {
    for (const shape of ['cap', 'chunky-pill', 'capsule'] as const) for (const prop of ['question', 'sparkle'] as const) {
      for (const rotation of [{ x: 0, y: 0, z: 0 }, { x: 0, y: 180, z: 0 }, { x: 20, y: 75, z: 90 }]) {
        renderer.render({ ...base, shape }, sampleFor(prop, .431), { rotation })
        const state = renderer.snapshotScene(), icon = supportingArt(renderer)
        expect(state.prop.material.depthTest).toBe(false)
        expect(state.prop.renderOrder).toBeGreaterThan(Math.max(state.body.renderOrder, state.lightFill.renderOrder, state.face.renderOrder))
        const bodyCenter = state.body.getWorldPosition(new THREE.Vector3()).project(state.camera)
        const iconCenter = state.prop.getWorldPosition(new THREE.Vector3()).project(state.camera)
        expect(iconCenter.x).toBeGreaterThan(bodyCenter.x)
        expect(iconCenter.y).toBeGreaterThan(bodyCenter.y)
        expect(icon.getAttribute('mask')).toBeNull()
        expect(icon.parentElement!.lastElementChild).toBe(icon)
        expect(icon.querySelectorAll('path')).toHaveLength(3)
        expect(icon.querySelectorAll('path[fill="#FFBE16"]')).toHaveLength(3)
        expect(icon.querySelector('text, image')).toBeNull()
      }
    }
  } finally { renderer.dispose() }
})

it('freezes cycling icons consistently in renderer and SVG under reduced motion and resumes deterministic seeking', () => {
  const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 400, height: 400 })
  const character = { ...defaultProject().characters[0]!, shape: 'cap' as const, trueFront: false, followRotation: false }
  const rotation = { x: 12, y: 180, z: 25 }
  try {
    for (const prop of ['question', 'sparkle'] as const) {
      const frames = [.13, .64].map(effectPhase => {
        renderer.render(character, sampleFor(prop, effectPhase), { rotation, reducedMotion: true })
        const state = renderer.snapshotScene()
        expect(state.propPhase).toBeUndefined()
        expect(supportingArt(renderer).querySelectorAll('path')).toHaveLength(3)
        return { art: supportingArt(renderer).innerHTML, position: state.prop.getWorldPosition(new THREE.Vector3()).toArray(), scale: state.prop.getWorldScale(new THREE.Vector3()).toArray() }
      })
      expect(frames[0]).toEqual(frames[1])
      const frame = (phase: number) => {
        renderer.render(character, sampleFor(prop, phase), { rotation, reducedMotion: false })
        expect(renderer.snapshotScene().propPhase).toBe(phase)
        return supportingArt(renderer).innerHTML
      }
      const first = frame(.13), later = frame(.64)
      expect(later).not.toBe(first)
      expect(frame(.13)).toBe(first)
    }
  } finally { renderer.dispose() }
})

it('keeps a continuous shared particle cycle across beat and animation-step boundaries', () => {
  for (const prop of ['question', 'sparkle'] as const) {
    const beat = (id: string, duration: number) => ({ id, name: id, duration, pose: { ...BASE_POSE, prop } })
    const definition: Definition = {
      version: 1, character: { ...defaultProject().characters[0]!, speed: 1 },
      expressions: [
        { id: 'a', name: 'A', description: '', beats: [beat('a1', 1.1), beat('a2', 2)] },
        { id: 'b', name: 'B', description: '', beats: [beat('b1', .5), beat('b2', 1.4)] }
      ],
      animations: [{ id: 'loop', name: 'Loop', loop: true, steps: [{ id: 's1', expressionId: 'a', duration: 3.1 }, { id: 's2', expressionId: 'b', duration: 1.9 }] }]
    }
    for (const [boundary, expressionId] of [[1.1, 'a'], [3.1, undefined]] as const) {
      const before = sampleDefinition(definition, 'loop', boundary - .00001, expressionId)
      const after = sampleDefinition(definition, 'loop', boundary + .00001, expressionId)
      if (expressionId) expect(after.beatIndex).not.toBe(before.beatIndex)
      else expect(after.stepIndex).not.toBe(before.stepIndex)
      expect(after.effectPhase! - before.effectPhase!).toBeGreaterThan(0)
      expect(after.effectPhase! - before.effectPhase!).toBeLessThan(.0001)
      expect(before.propAmount).toBe(1); expect(after.propAmount).toBe(1)
      const oldParticles = particleLayout(prop, before.effectPhase).particles
      particleLayout(prop, after.effectPhase).particles.forEach((particle, i) => {
        for (const key of ['x', 'y', 'alpha', 'scale', 'rotation'] as const) expect(Math.abs(particle[key] - oldParticles[i]![key])).toBeLessThan(.01)
      })
    }
    const start = sampleDefinition(definition, 'loop', .431), looped = sampleDefinition(definition, 'loop', 5.431)
    expect(looped.effectPhase).toBeCloseTo(start.effectPhase!, 12)
    expect(particleLayout(prop, looped.effectPhase).particles).toEqual(particleLayout(prop, start.effectPhase).particles)
  }
})


it('eases particle framing in and out with prop visibility and preserves compact-size framing', () => {
  const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 400, height: 400 })
  const character = { ...defaultProject().characters[0]!, shape: 'cap' as const, trueFront: true, followRotation: false, lockPosition: true }
  const half = (prop: Prop, propAmount = 1, displaySize = 400) => {
    renderer.render(character, { ...sampleFor(prop, .4), propAmount }, { displaySize })
    return renderer.snapshotScene().camera.top
  }
  try {
    const base = half('none')
    for (const prop of ['question', 'sparkle'] as const) {
      expect(half(prop, 0)).toBeCloseTo(base)
      const full = half(prop), middle = half(prop, .5)
      expect(full).toBeGreaterThan(base)
      expect(middle).toBeCloseTo((base + full) / 2)
      expect(half(prop, .00001) - base).toBeLessThan(.00001)
      expect(half(prop, 1, 24)).toBe(half('none', 1, 24))
    }
  } finally { renderer.dispose() }
})

it('keeps mesh particles aligned with the SVG sprite plane under body rotation and nonuniform squash', () => {
  const vectors = new ParticleVectors(), root = new THREE.Group()
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ opacity: .73, transparent: true }))
  const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, .1, 20)
  camera.position.set(1, 2, 5); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true)
  root.position.set(.12, -.08, .03); root.rotation.set(.3, 1.4, -.7); root.scale.set(.91, 1.2, .91)
  sprite.position.set(.7, .48, .15); root.add(sprite)
  try {
    for (const prop of ['question', 'sparkle'] as const) {
      const layout = particleLayout(prop, .43, { propSize: 1.4, propCount: 3 })
      sprite.scale.setScalar(layout.extent * .58 / 256); root.updateMatrixWorld(true)
      vectors.update(prop, layout, sprite, camera); vectors.group.updateMatrixWorld(true)
      const worldCenter = sprite.getWorldPosition(new THREE.Vector3())
      const worldSize = sprite.getWorldScale(new THREE.Vector3())
      const cameraRotation = camera.getWorldQuaternion(new THREE.Quaternion())
      vectors.group.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>
        const particle = layout.particles[i]!, positions = mesh.geometry.getAttribute('position')
        expect(mesh.material.map).toBeNull()
        expect(mesh.material.color.getHexString()).toBe('ffbe16')
        expect(mesh.material.depthTest).toBe(false)
        expect(mesh.material.opacity).toBeCloseTo(particle.alpha * sprite.material.opacity)
        expect(positions.count).toBeGreaterThan(20)
        // Compare the mesh against the existing canvas/SVG convention: Y points
        // down in artwork, rotations are clockwise, and the sprite faces camera.
        for (const index of [0, Math.floor(positions.count / 2), positions.count - 1]) {
          const point = new THREE.Vector3().fromBufferAttribute(positions, index)
          const canvasX = point.x * particle.scale, canvasY = -point.y * particle.scale
          const x = particle.x + Math.cos(particle.rotation) * canvasX - Math.sin(particle.rotation) * canvasY
          const y = particle.y + Math.sin(particle.rotation) * canvasX + Math.cos(particle.rotation) * canvasY
          const expected = new THREE.Vector3((x - 128) / layout.extent * worldSize.x, (128 - y) / layout.extent * worldSize.y, 0)
            .applyQuaternion(cameraRotation).add(worldCenter)
          expect(point.applyMatrix4(mesh.matrixWorld).distanceTo(expected)).toBeLessThan(1e-8)
        }
      })
    }
  } finally { vectors.dispose(); sprite.material.dispose() }
})

it('renders reusable mesh artwork across frames and zoom, then restores existing sprite props', () => {
  const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 400, height: 400 })
  const render = vi.spyOn(renderer.gl, 'render')
  const character = { ...defaultProject().characters[0]!, trueFront: false, followRotation: false }
  const geometries = new Map<Prop, THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  let vectorGroup: THREE.Group | undefined
  try {
    for (const prop of ['question', 'sparkle', 'question'] as const) for (const zoom of [1, 2.5]) {
      for (const effectPhase of [.21, .58]) {
        const sample = sampleFor(prop, effectPhase); sample.pose.squash = 1.2
        renderer.render(character, sample, { rotation: { x: 20, y: 155, z: 85 }, zoom })
        const scene = render.mock.calls.at(-1)![0]
        vectorGroup = scene.getObjectByName('Vector particles') as THREE.Group
        expect(vectorGroup.visible).toBe(true)
        const meshes = vectorGroup.children as THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>[]
        expect(meshes).toHaveLength(3)
        expect(meshes.some(mesh => mesh.visible)).toBe(true)
        const geometry = meshes[0]!.geometry
        if (geometries.has(prop)) expect(geometry).toBe(geometries.get(prop))
        else geometries.set(prop, geometry)
        for (const mesh of meshes) {
          expect(mesh.geometry).toBe(geometry)
          expect(mesh.material.map).toBeNull()
          materials.add(mesh.material)
        }
        const snapshot = renderer.snapshotScene()
        expect(snapshot.prop.visible).toBe(true)
        expect(snapshot.prop.material.visible).toBe(false)
        expect(supportingArt(renderer).querySelectorAll('path')).toHaveLength(3)
      }
    }
    expect(geometries.get('question')).not.toBe(geometries.get('sparkle'))
    expect(materials.size).toBe(3)
    renderer.render(character, sampleFor('heart', .3))
    expect(vectorGroup!.visible).toBe(false)
    expect(renderer.snapshotScene().prop.material.visible).toBe(true)
    expect(renderer.snapshotScene().prop.material.map).not.toBeNull()
    renderer.render(character, sampleFor('none'))
    expect(vectorGroup!.visible).toBe(false)
    expect(renderer.snapshotScene().prop.visible).toBe(false)

    const disposeGeometry = [...geometries.values()].map(geometry => vi.spyOn(geometry, 'dispose'))
    const disposeMaterial = [...materials].map(material => vi.spyOn(material, 'dispose'))
    renderer.dispose(); renderer.dispose()
    for (const dispose of [...disposeGeometry, ...disposeMaterial]) expect(dispose).toHaveBeenCalledTimes(1)
    expect(vectorGroup!.children).toHaveLength(0)
  } finally { renderer.dispose() }
})

it('reuses the particle mesh pool when count falls and disposes each cached icon exactly once', () => {
  const vectors = new ParticleVectors(), sprite = new THREE.Sprite(new THREE.SpriteMaterial())
  const camera = new THREE.OrthographicCamera()
  try {
    vectors.update('question', particleLayout('question', undefined, { propCount: 6 }), sprite, camera)
    const pool = [...vectors.group.children] as THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>[]
    const questionGeometry = pool[0]!.geometry
    vectors.update('sparkle', particleLayout('sparkle', undefined, { propCount: 3 }), sprite, camera)
    const sparkleGeometry = pool[0]!.geometry
    expect(pool.slice(3).every(mesh => !mesh.visible)).toBe(true)
    vectors.update('question', particleLayout('question', undefined, { propCount: 1 }), sprite, camera)
    expect(vectors.group.children).toEqual(pool)
    expect(pool[0]!.geometry).toBe(questionGeometry)
    expect(pool[0]!.visible).toBe(true)
    expect(pool.slice(1).every(mesh => !mesh.visible)).toBe(true)
    const dispose = [questionGeometry, sparkleGeometry, ...pool.map(mesh => mesh.material)].map(resource => vi.spyOn(resource, 'dispose'))
    vectors.dispose(); vectors.dispose()
    for (const spy of dispose) expect(spy).toHaveBeenCalledTimes(1)
    expect(vectors.group.children).toHaveLength(0)
  } finally { vectors.dispose(); sprite.material.dispose() }
})
