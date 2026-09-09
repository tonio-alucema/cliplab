import { afterEach, describe, expect, it, vi } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import ts from 'typescript'
import { defaultProject, definitionOf } from './model'
import { demoZip, renderMedia, renderSvg } from './export'
const { draw, serialize, dispose } = vi.hoisted(() => ({ draw: vi.fn(), serialize: vi.fn(() => '<svg xmlns="http://www.w3.org/2000/svg"/>'), dispose: vi.fn() }))
vi.mock('./renderer', () => ({ CharacterRenderer: class { render = draw; dispose = dispose; snapshotScene() { return { current: true } } } }))
vi.mock('./svg-snapshot', () => ({ snapshotSvg: serialize }))
afterEach(() => vi.unstubAllGlobals())
describe('export contracts', () => {
  const p = defaultProject(), d = definitionOf(p, p.characters[0]!)
  const options = { width: 256, height: 256, fps: 20, duration: 5, animationId: 'idle', format: 'gif' as const, background: null, rotation: { x: 0, y: 0, z: 0 }, zoom: 1 }
  it('captures SVG from the supplied pose and eye directions and releases the renderer', () => {
    vi.stubGlobal('document', { createElement: () => ({}) })
    const sample = { pose: p.expressions[1]!.beats[1]!.pose, blink: .2, bob: .3, breathe: .1, expressionId: 'listening', beatIndex: 1, stepIndex: 0 }
    const cursor = { x: .2, y: -.5, eyes: { left: { x: .8, y: .1 }, right: { x: -.7, y: .1 } } }
    const rotation = { x: 12, y: -32, z: 8 }
    expect(renderSvg(d, { ...options, sample, cursor, rotation })).toContain('<svg')
    expect(draw.mock.calls.at(-1)![1]).toBe(sample)
    expect(draw.mock.calls.at(-1)![2]).toMatchObject({ rotation, cursor, eyeGazes: cursor.eyes })
    expect(serialize).toHaveBeenCalledWith({ current: true }); expect(dispose).toHaveBeenCalled()
    expect(() => renderSvg(d, { ...options, width: 0 })).toThrow('2048')
  })
  it('preserves the exact eye directions in PNG exports with different framing', async () => {
    const eyes = { left: { x: .91, y: .1 }, right: { x: -.87, y: -.1 } }
    vi.stubGlobal('document', { createElement: () => ({ toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['png'], { type: 'image/png' })) }) })
    for (const [width, height, zoom] of [[1080, 1920, .7], [1920, 1080, 1.4]]) {
      await renderMedia(d, { ...options, width: width!, height: height!, zoom: zoom!, format: 'png', cursor: { x: .5, y: .4, eyes } })
      expect(draw.mock.calls.at(-1)![2].eyeGazes).toEqual(eyes)
      expect(draw.mock.calls.at(-1)![2].pointerLook).toBeUndefined()
    }
  })
  it('rejects partial or oversized export requests before creating a renderer', async () => {
    await expect(renderMedia(d, { ...options, duration: 61 })).rejects.toThrow('60 seconds')
    await expect(renderMedia(d, { ...options, fps: 24 })).rejects.toThrow('20 fps')
    await expect(renderMedia(d, { ...options, width: 1000 })).rejects.toThrow('512 px')
    await expect(renderMedia(d, { ...options, format: 'mp4', width: 255 })).rejects.toThrow('even numbers')
  })
  it('packages the selected configuration with an actual standalone runtime', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost' } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('export function createCharacter() {}', { headers: { 'content-type': 'text/javascript' } })))
    const zipped = unzipSync(new Uint8Array(await (await demoZip(d, false)).arrayBuffer()))
    expect(strFromU8(zipped['cliplab.js']!)).toContain('createCharacter')
    expect(JSON.parse(strFromU8(zipped['character.json']!))).toEqual(d)
    expect(strFromU8(zipped['index.html']!)).toContain("from './cliplab.js'")
  })
  it('escapes imported animation identifiers in generated React code', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost' } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('export function createCharacter() {}', { headers: { 'content-type': 'text/javascript' } })))
    const def = structuredClone(d); def.animations[0]!.id = `hello'"</script>`
    const files = unzipSync(new Uint8Array(await (await demoZip(def, true)).arrayBuffer()))
    for (const path of ['src/Character.tsx', 'src/main.tsx']) {
      const code = strFromU8(files[path]!)
      const result = ts.transpileModule(code, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }, fileName: path, reportDiagnostics: true })
      expect(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error)).toEqual([])
      expect(code).not.toContain('</script>')
    }
  })
})
