// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCharacter } from './runtime'
import { defaultProject, definitionOf } from './model'

const { render, dispose } = vi.hoisted(() => ({ render: vi.fn(), dispose: vi.fn() }))
vi.mock('./renderer', () => ({ CharacterRenderer: class { render = render; dispose = dispose; resize() {} } }))

let now = 0, nextId = 0
const frames = new Map<number, FrameRequestCallback>()
const players: ReturnType<typeof createCharacter>[] = []
const project = defaultProject()
const definition = definitionOf(project, { ...project.characters[0]!, iris: true, followCursor: true })
function tick(count = 1) {
  for (let i = 0; i < count; i++) {
    now += 1000 / 60
    const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(now))
  }
}
function player(options = {}) {
  const host = document.createElement('div'); document.body.appendChild(host)
  const value = createCharacter(host, definition, { autoplay: false, ...options }); players.push(value)
  vi.spyOn(value.canvas, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 100, width: 200, height: 200 } as DOMRect)
  return value
}
const pointRight = () => window.dispatchEvent(new PointerEvent('pointermove', { clientX: 600, clientY: 200 }))
const renderedGaze = () => render.mock.calls.at(-1)![3] as { x: number; y: number }

beforeEach(() => {
  now = 0; nextId = 0; frames.clear(); vi.clearAllMocks()
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextId, callback); return nextId })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} })
})
afterEach(() => { players.splice(0).forEach(value => value.destroy()); document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('iris following in exported players', () => {
  it('eases toward the cursor and returns to center while playback is paused', () => {
    player(); pointRight(); tick()
    expect(renderedGaze().x).toBeGreaterThan(0); expect(renderedGaze().x).toBeLessThan(1)
    expect(render.mock.calls.at(-1)![2].pointerLook.weight).toBeGreaterThan(0)
    expect(render.mock.calls.at(-1)![2].pointerLook.weight).toBeLessThan(1)
    tick(40); expect(renderedGaze()).toEqual({ x: 1, y: -0 })
    expect(render.mock.calls.at(-1)![1]).toEqual(render.mock.calls[0]![1])
    document.documentElement.dispatchEvent(new PointerEvent('pointerleave')); tick(40)
    expect(renderedGaze()).toEqual({ x: 0, y: 0 })
    expect(render.mock.calls.at(-1)![2].pointerLook.weight).toBe(0)
  })

  it('honors explicit tracking off while keeping manual gaze independent of body following', () => {
    const value = player({ followCursor: false, followRotation: true })
    value.setGaze(-.6, .3); pointRight(); tick(40)
    expect(renderedGaze()).toEqual({ x: -.6, y: .3 })
    expect(render.mock.calls.at(-1)![2].cursor.x).toBe(1)
    expect(render.mock.calls.at(-1)![2].pointerLook).toBeUndefined()
    document.documentElement.dispatchEvent(new PointerEvent('pointerleave')); tick(40)
    expect(renderedGaze()).toEqual({ x: -.6, y: .3 })
  })

  it('lets manual gaze take over and recalculates focus after resizing or scrolling', () => {
    const value = player(); pointRight(); tick(40)
    expect(render.mock.calls.at(-1)![2].pointerLook).toMatchObject({ x: 4, y: 0, weight: 1 })
    value.setGaze(-.4, .2); tick(40)
    expect(renderedGaze()).toEqual({ x: -.4, y: .2 })
    expect(render.mock.calls.at(-1)![2].pointerLook.weight).toBe(0)
    pointRight(); tick(40)
    vi.mocked(value.canvas.getBoundingClientRect).mockReturnValue({ left: 100, top: 100, width: 400, height: 400 } as DOMRect)
    value.setSize(400); tick(60)
    expect(render.mock.calls.at(-1)![2].pointerLook).toMatchObject({ x: 1.5, y: .5, weight: 1 })
    vi.mocked(value.canvas.getBoundingClientRect).mockReturnValue({ left: 200, top: 100, width: 400, height: 400 } as DOMRect)
    window.dispatchEvent(new Event('scroll')); tick(40)
    expect(render.mock.calls.at(-1)![2].pointerLook).toMatchObject({ x: 1, y: .5, weight: 1 })
  })

  it('clears pending tracking on definition replacement and stops rendering after destroy', () => {
    const value = player(); pointRight(); tick(2)
    value.setDefinition({ ...definition, character: { ...definition.character, followCursor: false } }); tick(40)
    expect(renderedGaze()).toEqual({ x: 0, y: 0 })
    value.destroy(); render.mockClear(); pointRight(); tick(40)
    expect(render).not.toHaveBeenCalled()
  })
})
