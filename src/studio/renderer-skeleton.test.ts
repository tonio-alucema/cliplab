// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { CharacterRenderer, projectedEye, resolveEyeGazes } from './renderer'
import { BASE_POSE, defaultProject, type Character } from './model'

// Exercise the real renderer/geometry lifecycle without requiring a GPU. The
// drawing backend still updates scene matrices like WebGLRenderer.render does.
vi.mock('three', async importOriginal => {
  const three = await importOriginal<typeof import('three')>()
  return { ...three, WebGLRenderer: class {
    outputColorSpace = ''; autoClear = true
    setPixelRatio() {} setSize() {} setClearColor() {} clearDepth() {} dispose() {} forceContextLoss() {}
    render(scene: THREE.Scene, camera: THREE.Camera) { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  } }
})

const sample = { pose: { ...BASE_POSE }, blink: 0, bob: 0, breathe: 0, expressionId: 'idle', beatIndex: 0, stepIndex: 0 }
const renderers: CharacterRenderer[] = []
beforeEach(() => {
  const context = new Proxy({}, { get: () => () => {}, set: () => true })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as CanvasRenderingContext2D)
})
afterEach(() => { renderers.splice(0).forEach(renderer => renderer.dispose()); vi.restoreAllMocks() })

function observeDisposal(group: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>()
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    geometries.add(object.geometry)
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
  })
  return [...geometries, ...materials].map(resource => { const callback = vi.fn(); resource.addEventListener('dispose', callback); return callback })
}

describe('skeleton renderer shape lifecycle', () => {
  it('aligns recessed skull sockets with default eye centers in the front view', () => {
    const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 256, height: 256, displaySize: 256, pixelRatio: 1 })
    renderers.push(renderer)
    for (const shape of ['cap', 'chunky-pill'] as const) {
      const character: Character = { ...defaultProject().characters[0]!, shape, bodyModification: 'skeleton', roundedSkull: shape === 'cap', trueFront: true }
      renderer.render(character, sample)
      const snapshot = renderer.snapshotScene()
      for (const side of [-1, 1]) {
        const socket = snapshot.skeleton!.getObjectByName(side < 0 ? 'socket-left' : 'socket-right')!
        const center = socket.getWorldPosition(new THREE.Vector3()).project(snapshot.camera)
        const eye = projectedEye(character, sample.pose, 0, side, snapshot.face.matrixWorld, snapshot.camera)
        expect(center.x).toBeCloseTo(eye.center.x, 7)
        expect(center.y).toBeCloseTo(eye.center.y, 7)
        // Alignment does not flatten the skeleton onto the face surface.
        expect(center.z).toBeGreaterThan(eye.center.z)
      }
      expect(snapshot.sample.pose).toEqual(sample.pose)
    }
  })

  it('rebuilds cap/chunky skeletons by effective shape and skull style, and disposes each resource once', () => {
    const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 256, height: 256, displaySize: 256, pixelRatio: 1 })
    renderers.push(renderer)
    const character: Character = { ...defaultProject().characters[0]!, shape: 'cap', bodyModification: 'skeleton', roundedSkull: false, trueFront: true }
    const render = () => { renderer.render(character, sample); return renderer.snapshotScene() }
    const classic = render(), classicSkeleton = classic.skeleton!, classicEvents = observeDisposal(classicSkeleton)
    const backShell = classic.backShell!
    expect(backShell.geometry).toBe(classic.body.geometry)
    expect(classicSkeleton.getObjectByName('rounded-jaw')).toBeUndefined()

    character.roundedSkull = true
    const rounded = render(), roundedSkeleton = rounded.skeleton!, roundedEvents = observeDisposal(roundedSkeleton)
    expect(roundedSkeleton).not.toBe(classicSkeleton)
    expect(classicSkeleton.parent).toBeNull(); classicEvents.forEach(event => expect(event).toHaveBeenCalledOnce())
    expect(roundedSkeleton.getObjectByName('rounded-jaw')).toBeUndefined()
    expect(roundedSkeleton.getObjectByName('socket-left')?.userData.skullLayer).toBe(0)
    expect(roundedSkeleton.getObjectByName('skull')?.userData.recessedSkull).toBe(true)

    const priorGeometry = rounded.body.geometry, disposedBody = vi.fn(); priorGeometry.addEventListener('dispose', disposedBody)
    character.shape = 'chunky-pill'; character.roundedSkull = false
    const chunky = render(), chunkySkeleton = chunky.skeleton!, chunkyEvents = observeDisposal(chunkySkeleton)
    expect(chunkySkeleton).not.toBe(roundedSkeleton)
    roundedEvents.forEach(event => expect(event).toHaveBeenCalledOnce())
    expect(disposedBody).toHaveBeenCalledOnce()
    expect(chunkySkeleton.getObjectByName('rounded-jaw')).toBeUndefined()
    expect(chunkySkeleton.getObjectByName('skull')?.userData.recessedSkull).toBe(true)
    expect(chunkySkeleton.getObjectByName('tooth-left')).toBeDefined()
    expect(chunkySkeleton.getObjectByName('tooth-right')).toBeDefined()
    expect(chunky.backShell).toBe(backShell); expect(backShell.geometry).toBe(chunky.body.geometry)
    expect(chunky.body.material.uniforms.bodyHeight!.value).toBe(1.5)
    expect(chunky.body.material.transparent).toBe(true)
    const facePositions = Float32Array.from(chunky.face.geometry.attributes.position!.array)

    character.roundedSkull = true
    expect(render().skeleton).toBe(chunkySkeleton) // stored flag cannot change the chunky skull style
    character.bodyModification = 'none'
    const plain = render()
    expect(plain.skeleton).toBeUndefined(); expect(plain.backShell).toBeUndefined()
    const plainPositions = plain.face.geometry.attributes.position!
    for (let i = 0; i < plainPositions.count; i++) {
      expect(plainPositions.getX(i)).toBe(facePositions[i * 3])
      expect(plainPositions.getY(i) + .2).toBeCloseTo(facePositions[i * 3 + 1]!, 6)
    }
    expect(plain.sample.pose).toEqual(sample.pose)
    expect(plain.body.material.transparent).toBe(false); expect(plain.body.material.uniforms.bodyOpacity!.value).toBe(1)

    character.shape = 'capsule'; character.bodyModification = 'skeleton'
    const capsule = render()
    expect(capsule.skeleton).toBeUndefined(); expect(capsule.backShell).toBeUndefined()
    character.shape = 'chunky-pill'
    expect(render().skeleton).toBe(chunkySkeleton)
    chunkyEvents.forEach(event => expect(event).not.toHaveBeenCalled())

    character.shape = 'cap'; character.roundedSkull = false
    const restored = render(), restoredSkeleton = restored.skeleton!, restoredEvents = observeDisposal(restoredSkeleton)
    expect(restoredSkeleton).not.toBe(chunkySkeleton)
    chunkyEvents.forEach(event => expect(event).toHaveBeenCalledOnce())
    expect(restoredSkeleton.getObjectByName('rounded-jaw')).toBeUndefined()
    const finalBodyDisposed = vi.fn(), backMaterialDisposed = vi.fn()
    restored.body.geometry.addEventListener('dispose', finalBodyDisposed); backShell.material.addEventListener('dispose', backMaterialDisposed)
    renderer.dispose(); renderer.dispose()
    expect(finalBodyDisposed).toHaveBeenCalledOnce(); expect(backMaterialDisposed).toHaveBeenCalledOnce()
    restoredEvents.forEach(event => expect(event).toHaveBeenCalledOnce())
  })

  it('keeps chunky bones attached under camera/pose changes and inside the padded preview', () => {
    const renderer = new CharacterRenderer(document.createElement('canvas'), { width: 96, height: 96, displaySize: 96, pixelRatio: 1 })
    renderers.push(renderer)
    const character: Character = { ...defaultProject().characters[0]!, shape: 'chunky-pill', bodyModification: 'skeleton', roundedSkull: false, trueFront: false }
    for (const rotation of [{ x: 0, y: 0, z: 0 }, { x: 35, y: 65, z: 20 }, { x: -65, y: 140, z: 90 }]) {
      renderer.render(character, sample, { rotation })
      const snapshot = renderer.snapshotScene()
      expect(snapshot.skeleton!.parent).toBe(snapshot.body.parent)
      expect(snapshot.backShell!.parent).toBe(snapshot.body.parent)
      const left = projectedEye(character, sample.pose, 0, -1, snapshot.face.matrixWorld, snapshot.camera)
      const right = projectedEye(character, sample.pose, 0, 1, snapshot.face.matrixWorld, snapshot.camera)
      const middle = left.center.clone().add(right.center).multiplyScalar(.5)
      const gazes = resolveEyeGazes(character, sample.pose, 0, snapshot.face.matrixWorld, snapshot.camera, { x: 0, y: 0 }, { ...middle, weight: 1 })
      expect(gazes.left.x).toBeGreaterThan(0); expect(gazes.right.x).toBeLessThan(0)
      expect(snapshot.sample.pose).toEqual(sample.pose)
      const positions = snapshot.body.geometry.attributes.position!
      for (let i = 0; i < positions.count; i += 13) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(snapshot.body.matrixWorld).project(snapshot.camera)
        expect(Math.abs(point.x)).toBeLessThan(1); expect(Math.abs(point.y)).toBeLessThan(1)
      }
    }
    renderer.render(character, sample, { displaySize: 24 })
    const compact = renderer.snapshotScene()
    expect(compact.character.trueFront).toBe(true)
    expect(compact.character.toon).toBe(false)
    expect(renderer.orientation().angleTo(new THREE.Quaternion())).toBeCloseTo(0)
    expect(compact.backShell!.geometry).toBe(compact.body.geometry)
  })
})
