// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive, type App } from 'vue'
import { Quaternion } from 'three'
import Stage from './CharacterStage.vue'
import { BASE_POSE, defaultProject } from './model'

vi.mock('./renderer', () => ({ CharacterRenderer: class {
  render() {} resize() {} dispose() {}
  orientation() { return new Quaternion() }
  eyeGazes() { return { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } } }
} }))
vi.mock('./orbit', () => ({ drawOrbit: vi.fn() }))

let app: App
let now = 0, frameId = 0
const frames = new Map<number, FrameRequestCallback>()
beforeEach(() => {
  now = 0; frameId = 0; frames.clear()
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
})
afterEach(() => { app?.unmount(); document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals() })
function tick(count = 40) {
  for (let i = 0; i < count; i++) {
    now += 1000 / 60
    const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(now))
  }
}

function mount(front = false) {
  const state = reactive({
    character: { ...defaultProject().characters[0]!, trueFront: front, followCursor: false, followRotation: false },
    sample: { pose: { ...BASE_POSE, rotationX: 10, rotationY: 20, rotationZ: 30 }, blink: 0, bob: 0, breathe: 0, expressionId: 'idle', beatIndex: 0, stepIndex: 0 },
    rotation: { x: 17, y: 23, z: -8 }
  })
  const reset = vi.fn()
  const host = document.createElement('div'); document.body.appendChild(host)
  app = createApp(() => h(Stage, { ...state, zoom: 1, background: '', previewSize: null, playing: false,
    onRotate: rotation => { state.character.trueFront = false; state.character.followRotation = false; state.rotation = rotation }, onReset: reset
  }))
  app.mount(host)
  const dial = host.querySelector<HTMLCanvasElement>('.orbit-globe')!
  dial.setPointerCapture = vi.fn()
  const point = async (type: string, x: number, y: number, options = {}) => {
    dial.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, button: 0, ...options })); await nextTick()
  }
  return { state, dial, point, reset, host }
}

describe('restored orbit controls', () => {
  it('takes over from True front without restoring a hidden camera angle or editing the pose', async () => {
    const { state, point } = mount(true)
    const authored = { ...state.sample.pose }
    await point('pointerdown', 50, 50)
    await point('pointermove', 60, 70)
    expect(state.character.trueFront).toBe(false)
    expect(state.rotation.x + authored.rotationX).toBeCloseTo(8)
    expect(state.rotation.y + authored.rotationY).toBeCloseTo(4)
    expect(state.rotation.z + authored.rotationZ).toBeCloseTo(0)
    expect(state.sample.pose).toEqual(authored)
  })

  it('supports orbit, roll and reset, and ignores other pointers and lost captures', async () => {
    const { state, dial, point, reset, host } = mount()
    await point('pointerdown', 50, 50, { shiftKey: true })
    await point('pointermove', 70, 50, { pointerId: 2 })
    expect(state.rotation.z).toBe(-8)
    await point('pointermove', 70, 50)
    expect(state.rotation).toEqual({ x: 17, y: 23, z: -18 })
    await point('lostpointercapture', 70, 50)
    await point('pointermove', 90, 80)
    expect(state.rotation.z).toBe(-18)
    dial.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })); await nextTick()
    expect(state.rotation.y).toBe(28)
    dial.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true })); await nextTick()
    expect(state.rotation.z).toBe(-13)
    dial.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }))
    host.querySelector<HTMLButtonElement>('[aria-label="Reset orientation"]')!.click()
    expect(reset).toHaveBeenCalledTimes(2)
  })

  it('takes over cursor-following immediately when the dial is held before dragging', async () => {
    const { state, host, point } = mount()
    state.character.followRotation = true; await nextTick()
    vi.spyOn(host.querySelector<HTMLCanvasElement>('.stage-canvas')!, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 100, width: 200, height: 200 } as DOMRect)
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 600, clientY: 200 }))
    tick(); await nextTick()
    await point('pointerdown', 50, 50)
    expect(state.character.followRotation).toBe(false)
    expect(state.rotation.y).toBeCloseTo(51)
    tick(); await nextTick()
    expect(state.rotation.y).toBeCloseTo(51)
    await point('pointermove', 60, 50)
    expect(state.rotation.y).toBeCloseTo(55)
  })
})
