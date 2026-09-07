import { defaultProject, definitionOf, type Sample } from '../src/studio/model'
import { CharacterRenderer } from '../src/studio/renderer'
import { demoZip, renderMedia } from '../src/studio/export'
import { unzipSync } from 'fflate'

const results: Record<string, unknown> = {}
const host = document.querySelector('#results')!
const project = defaultProject()
const definition = definitionOf(project, project.characters[1]!)
const opts = { width: 128, height: 128, fps: 20, duration: 1, animationId: 'happy', background: null, rotation: { x: -5, y: -12, z: -7 }, zoom: 1 }
const sample: Sample = { pose: project.expressions.find(e => e.id === 'happy')!.beats[0]!.pose, blink: 0, bob: 0, breathe: 0, expressionId: 'happy', beatIndex: 0, stepIndex: 0 }
function report() { document.querySelector('#report')!.textContent = JSON.stringify(results, null, 2) }
async function check(name: string, fn: () => Promise<unknown>) {
  try { results[name] = { status: 'pass', result: await fn() } } catch (error) { results[name] = { status: 'fail', error: error instanceof Error ? error.message : String(error) } }
  report()
}
function append(name: string, element: HTMLElement) { const article = document.createElement('article'); const title = document.createElement('h2'); title.textContent = name; title.style.fontSize = '14px'; article.append(title, element); host.append(article) }
async function imageFrom(blob: Blob) { const image = new Image(); image.src = URL.createObjectURL(blob); await image.decode(); return image }
function pixels(image: CanvasImageSource, width: number, height: number) { const c = document.createElement('canvas'); c.width = width; c.height = height; const ctx = c.getContext('2d')!; ctx.drawImage(image, 0, 0, width, height); return ctx.getImageData(0, 0, width, height).data }
await check('portrait PNG keeps the whole character and alpha', async () => {
  const blob = await renderMedia(definition, { ...opts, width: 128, height: 224, format: 'png', sample })
  const image = await imageFrom(blob); append('Portrait PNG', image)
  const px = pixels(image, 128, 224)
  let left = 128, right = -1, top = 224, bottom = -1
  for (let y = 0; y < 224; y++) for (let x = 0; x < 128; x++) if (px[(y * 128 + x) * 4 + 3]! > 200) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y) }
  if (!(left > 0 && right < 127 && top > 0 && bottom < 223 && right > left)) throw new Error('Body is cropped or empty')
  if (px[3] !== 0) throw new Error('PNG corner lost transparency')
  return { bytes: blob.size, width: image.naturalWidth, height: image.naturalHeight, bounds: [left, top, right, bottom] }
})
await check('GIF', async () => {
  const blob = await renderMedia(definition, { ...opts, format: 'gif' }); const image = await imageFrom(blob); append('Animated GIF', image)
  const header = new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 6)); if (!header.startsWith('GIF')) throw new Error('Invalid GIF')
  return { bytes: blob.size, width: image.naturalWidth, height: image.naturalHeight }
})
for (const format of ['mp4', 'webm'] as const) await check(format, async () => {
  const blob = await renderMedia(definition, { ...opts, format })
  const video = document.createElement('video'); video.controls = true; video.muted = true; video.loop = true; video.src = URL.createObjectURL(blob); video.preload = 'auto'
  append(format === 'webm' ? 'Transparent WebM' : 'MP4', video)
  await new Promise<void>((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('Video did not decode')), 12000); video.onloadeddata = () => { clearTimeout(timeout); resolve() }; video.onerror = () => { clearTimeout(timeout); reject(new Error(video.error?.message || 'Video decoding failed')) } })
  await new Promise<void>((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('Video frame did not become available')), 12000); video.onseeked = () => { clearTimeout(timeout); resolve() }; video.currentTime = .2 })
  const framePixels = pixels(video, 128, 128)
  const alpha = framePixels[3]
  if (!framePixels.some((value, i) => i % 4 === 3 && value > 128)) throw new Error('Decoded video frame is empty')
  if (format === 'mp4' && alpha !== 255) throw new Error('MP4 frame did not have an opaque background')
  if (format === 'webm' && alpha !== 0) throw new Error(`WebM transparency did not survive decoding (alpha=${alpha})`)
  await video.play().catch(() => {})
  return { bytes: blob.size, duration: video.duration, width: video.videoWidth, height: video.videoHeight, cornerAlpha: alpha }
})
for (const react of [false, true]) await check(react ? 'React package' : 'JavaScript package', async () => { const blob = await demoZip(definition, react); const files = unzipSync(new Uint8Array(await blob.arrayBuffer())); return { bytes: blob.size, files: Object.keys(files) } })
await check('exported runtime integration', async () => {
  const runtimeURL = new URL('/runtime/cliplab.js', window.location.origin).href
  const { createCharacter } = await import(/* @vite-ignore */ runtimeURL)
  const target = document.createElement('div'); target.style.cssText = 'width:160px;height:160px'; append('Standalone app player', target)
  const player = createCharacter(target, definition, { animation: 'happy', autoplay: false })
  player.seek(.8)
  const px = pixels(player.canvas, 160, 160)
  if (!px.some((value, i) => i % 4 === 3 && value > 128)) throw new Error('Exported runtime did not draw a character')
  player.setExpression('sleepy'); player.seek(1); player.setGaze(.5, -.3); player.setSize(24)
  player.setDefinition(definition); player.setAnimation('playful'); player.play(); player.pause()
  player.destroy()
  if (target.querySelector('canvas')) throw new Error('Runtime cleanup left its canvas behind')
  target.remove()
  return { render: true, stateChanges: true, cleanup: true }
})
await check('small sizes at high pixel density', async () => {
  const canvas = document.createElement('canvas'), renderer = new CharacterRenderer(canvas, { width: 192, height: 192, pixelRatio: 1, displaySize: 12 })
  try {
    const stats = []
    for (const size of [12, 16, 24, 25, 120]) {
      renderer.render({ ...definition.character, shadow: false, color: '#dddddd', gradient: false, toon: false }, sample, { displaySize: size, rotation: { x: 0, y: 0, z: 0 } })
      const px = pixels(canvas, 192, 192); let dark = 0
      for (let i = 0; i < px.length; i += 4) if (px[i + 3]! > 128 && px[i]! < 70 && px[i + 1]! < 70 && px[i + 2]! < 70) dark++
      stats.push({ size, darkPixels: dark })
    }
    if (stats[0]!.darkPixels !== 0 || stats[1]!.darkPixels === 0 || stats[2]!.darkPixels === 0) throw new Error('Responsive face rule failed')
    return stats
  } finally { renderer.dispose() }
})
document.querySelector('#status')!.textContent = Object.values(results).every(v => (v as { status: string }).status === 'pass') ? 'All checks passed.' : 'Some checks need attention.'
