// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import Studio from './StudioApp.vue'
const { renderSvg, saveBlob, writeText } = vi.hoisted(() => ({ renderSvg: vi.fn((..._args: Parameters<typeof import('./export')['renderSvg']>) => '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#abcdef"/></svg>'), saveBlob: vi.fn(), writeText: vi.fn(async (_text: string) => {}) }))
vi.mock('./CharacterStage.vue', () => ({ default: { render: () => null } }))
vi.mock('./CharacterThumb.vue', () => ({ default: { render: () => null } }))
vi.mock('./export', async original => ({ ...await original<typeof import('./export')>(), renderSvg, saveBlob }))
let app: App
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear()
  vi.stubGlobal('requestAnimationFrame', () => 0); vi.stubGlobal('cancelAnimationFrame', () => {})
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
})
afterEach(() => { app?.unmount(); document.body.innerHTML = ''; vi.unstubAllGlobals() })
async function mountImageExport() {
  const host = document.createElement('div'); document.body.appendChild(host); app = createApp(Studio); app.mount(host)
  const click = async (selector: string, text: string) => { [...host.querySelectorAll<HTMLButtonElement>(selector)].find(b => b.textContent?.trim() === text)!.click(); await nextTick() }
  await click('.inspector-tabs button', 'Export'); await click('.export-tabs button', 'Image')
  return { host, click }
}
describe('SVG image export controls', () => {
  it('downloads and copies SVG snapshots with matching export settings and updated helper text', async () => {
    const { host, click } = await mountImageExport()
    expect(host.querySelector('.photo-note')!.textContent).toContain('PNG or SVG')
    await click('.export-actions button', 'Download SVG')
    const [blob, filename] = saveBlob.mock.calls[0]!
    expect(blob.type).toBe('image/svg+xml;charset=utf-8'); expect(filename).toMatch(/\.svg$/)
    expect(await blob.text()).toBe(renderSvg.mock.results[0]!.value)
    expect(renderSvg.mock.calls[0]![1]).toMatchObject({ width: 1080, height: 1080, background: null, zoom: 1, rotation: { x: -5, y: -12, z: -7 } })
    expect(renderSvg.mock.calls[0]![1].sample!.pose).toBeDefined()
    host.querySelector<HTMLButtonElement>('[aria-label="Copy SVG to clipboard"]')!.click(); await nextTick()
    expect(writeText).toHaveBeenCalledWith(renderSvg.mock.results[1]!.value)
    await vi.waitFor(() => expect(host.textContent).toContain('SVG snapshot copied'))
  })
  it('offers the download fallback when clipboard access is denied', async () => {
    writeText.mockRejectedValueOnce(new Error('Denied'))
    const { host } = await mountImageExport()
    host.querySelector<HTMLButtonElement>('[aria-label="Copy SVG to clipboard"]')!.click(); await nextTick()
    await vi.waitFor(() => expect(host.textContent).toContain('Use Download SVG instead'))
    expect(saveBlob).not.toHaveBeenCalled()
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Copy SVG to clipboard"]')!.disabled).toBe(false)
  })
})
