import { zipSync, strToU8 } from 'fflate'
import { gifIndexe, indexe, nouvellePalette, recense } from '../ui/anime'
import { versMp4 } from '../ui/video'
import { CharacterRenderer } from './renderer'
import { sampleDefinition, type Definition, type Sample } from './model'

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a')
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const fileName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'character'
export function jsonBlob(value: unknown) { return new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }) }
export interface MediaOptions {
  width: number; height: number; fps: number; duration: number; animationId: string
  format: 'png' | 'gif' | 'mp4' | 'webm'; background: string | null; rotation: { x: number; y: number; z: number }
  zoom: number; sample?: Sample; signal?: AbortSignal; onProgress?: (progress: number) => void
}
function cancelled(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError') }
const breathe = () => new Promise<void>(resolve => setTimeout(resolve, 0))
export async function renderMedia(definition: Definition, options: MediaOptions): Promise<Blob> {
  const { width, height, fps, format, signal } = options
  if (![width, height, fps, options.duration].every(Number.isFinite) || width < 1 || height < 1 || width > 2048 || height > 2048 || fps < 1 || fps > 60 || options.duration <= 0 || options.duration > 60) throw new Error('Choose dimensions up to 2048 px and a duration up to 60 seconds.')
  if (format === 'mp4' && (width % 2 || height % 2)) throw new Error('MP4 dimensions must be even numbers.')
  if (format === 'gif' && (width > 512 || height > 512 || fps !== 20)) throw new Error('GIF exports use 20 fps and support up to 512 px. Use video for larger assets or other frame rates.')
  const canvas = document.createElement('canvas')
  const renderer = new CharacterRenderer(canvas, { width, height, pixelRatio: 1, displaySize: Math.min(width, height), background: format === 'mp4' ? options.background ?? '#f2f4f7' : options.background })
  const frames = Math.max(1, Math.round(options.duration * fps))
  const draw = (i: number) => {
    cancelled(signal)
    renderer.render(definition.character, format === 'png' && options.sample ? options.sample : sampleDefinition(definition, options.animationId, i * options.duration / frames), { rotation: options.rotation, zoom: options.zoom })
  }
  try {
    if (format === 'png') {
      draw(0)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('The image could not be captured.')), 'image/png'))
      cancelled(signal); options.onProgress?.(1); return blob
    }
    if (format === 'mp4') return await versMp4(canvas, frames, fps, draw, (n, total) => options.onProgress?.(n / total), signal)
    if (format === 'webm') {
      const { BufferTarget, CanvasSource, Output, WebMOutputFormat, canEncodeVideo } = await import('mediabunny')
      const transparent = !options.background
      if (!await canEncodeVideo('vp9', { width, height })) throw new Error('This browser cannot encode VP9 video. Try MP4 or a Chromium browser.')
      const target = new BufferTarget()
      const output = new Output({ format: new WebMOutputFormat(), target })
      const source = new CanvasSource(canvas, { codec: 'vp9', bitrate: 6_000_000, alpha: transparent ? 'keep' : 'discard' })
      output.addVideoTrack(source, { frameRate: fps })
      try {
        await output.start()
        for (let i = 0; i < frames; i++) { draw(i); await source.add(i / fps, 1 / fps); options.onProgress?.((i + 1) / frames * .96); if (i % 5 === 0) await breathe() }
        cancelled(signal); source.close(); await output.finalize(); options.onProgress?.(1)
        return new Blob([target.buffer!], { type: 'video/webm' })
      } catch (error) { try { await output.cancel() } catch { /* Preserve the original encoding error. */ } throw error }
    }
    const copy = document.createElement('canvas'); copy.width = width; copy.height = height
    const ctx = copy.getContext('2d', { willReadFrequently: true })!
    const pixels = (i: number) => { draw(i); ctx.clearRect(0, 0, width, height); ctx.drawImage(canvas, 0, 0); return ctx.getImageData(0, 0, width, height).data }
    const palette = nouvellePalette()
    for (let i = 0; i < frames; i++) { recense(palette, pixels(i)); options.onProgress?.((i + 1) / frames * .45); if (i % 4 === 0) await breathe() }
    const indexed: Uint8Array[] = []
    for (let i = 0; i < frames; i++) { indexed.push(indexe(palette, pixels(i))); options.onProgress?.(.45 + (i + 1) / frames * .5); if (i % 4 === 0) await breathe() }
    cancelled(signal)
    const bytes = gifIndexe(palette, indexed, width, height, 1000 / fps); options.onProgress?.(1)
    return new Blob([bytes], { type: 'image/gif' })
  } finally { renderer.dispose() }
}

export function setupInstructions(definition: Definition, react: boolean) {
  const id = definition.animations[0]?.id ?? 'idle'
  return `Integrate the attached ClipLab character definition using the supplied cliplab.js runtime. ${react ? 'Use Character.tsx as the React component and pass the animation prop.' : 'Import createCharacter, pass a container, the definition, and options.'} Start with animation "${id}". Available animations: ${definition.animations.map(a => a.id).join(', ')}. Keep the container square and set its CSS size. The runtime automatically shows the full face above 24 px, only eyes from 16 to 24 px, and only the body below 16 px. Set followCursor to true to track the pointer. Call destroy() when removing the component. The JSON is configuration; it requires the included JavaScript runtime. Marketing assets are rendered separately.`
}
const declaration = `export interface CharacterOptions { animation?: string; size?: number; autoplay?: boolean; followCursor?: boolean; background?: string | null; respectReducedMotion?: boolean }
export declare function createCharacter(target: HTMLElement, definition: unknown, options?: CharacterOptions): { canvas: HTMLCanvasElement; play(): void; pause(): void; setAnimation(id: string): void; setExpression(id: string): void; seek(seconds: number): void; setGaze(x: number, y: number): void; setSize(size: number): void; setDefinition(value: unknown): void; destroy(): void };
`
export async function demoZip(definition: Definition, react: boolean): Promise<Blob> {
  const response = await fetch(new URL(`${import.meta.env.BASE_URL}runtime/cliplab.js`, window.location.origin))
  if (!response.ok || !response.headers.get('content-type')?.includes('javascript')) throw new Error('The app runtime is not available yet. Rebuild the studio and try again.')
  const runtime = new Uint8Array(await response.arrayBuffer())
  const id = definition.animations[0]?.id ?? 'idle'
  const idLiteral = JSON.stringify(id).replace(/</g, '\\u003c')
  const files: Record<string, Uint8Array> = {
    'README.md': strToU8(`# ${definition.character.name} — ClipLab\n\n${setupInstructions(definition, react)}\n\n${react ? 'Run npm install, then npm run dev.' : 'Serve this folder with any local static web server and open index.html. JavaScript modules require HTTP; opening the file directly is not supported.'}\n\nThe runtime includes Three.js under its MIT license. See THIRD-PARTY-LICENSES.txt.\n`),
    'THIRD-PARTY-LICENSES.txt': strToU8('Three.js — MIT License\nCopyright © 2010–2026 three.js authors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the Software), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED AS IS, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n')
  }
  if (react) {
    files['package.json'] = strToU8(JSON.stringify({ name: 'cliplab-character-demo', private: true, type: 'module', scripts: { dev: 'vite', build: 'vite build' }, dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' }, devDependencies: { vite: '^8.2.1', typescript: '^5.9.3', '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0' } }, null, 2))
    files['index.html'] = strToU8('<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ClipLab character</title></head><body style="margin:0;background:#f2f4f7"><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>')
    files['src/cliplab.js'] = runtime; files['src/cliplab.d.ts'] = strToU8(declaration); files['src/definition.json'] = strToU8(JSON.stringify(definition, null, 2))
    files['src/Character.tsx'] = strToU8(`import React, { useEffect, useRef } from 'react';\nimport { createCharacter } from './cliplab.js';\nimport definition from './definition.json';\n\nexport function Character({ animation = ${idLiteral}, size = 160, followCursor = false }) {\n  const target = useRef<HTMLDivElement>(null);\n  const player = useRef<ReturnType<typeof createCharacter> | null>(null);\n  useEffect(() => {\n    player.current = createCharacter(target.current!, definition, { animation, followCursor });\n    return () => { player.current?.destroy(); player.current = null; };\n  }, [followCursor]);\n  useEffect(() => { player.current?.setAnimation(animation); }, [animation]);\n  return <div ref={target} style={{ width: size, height: size }} />;\n}\n`)
    files['src/main.tsx'] = strToU8(`import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport { Character } from './Character';\ncreateRoot(document.getElementById('root')!).render(<main style={{minHeight:'100vh',display:'grid',placeItems:'center'}}><Character size={320} animation={${idLiteral}} followCursor /></main>);\n`)
    files['tsconfig.json'] = strToU8(JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx', resolveJsonModule: true, esModuleInterop: true, strict: true, skipLibCheck: true }, include: ['src'] }, null, 2))
  } else {
    files['cliplab.js'] = runtime; files['cliplab.d.ts'] = strToU8(declaration); files['character.json'] = strToU8(JSON.stringify(definition, null, 2))
    files['index.html'] = strToU8(`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ClipLab character</title></head><body style="margin:0;background:#f2f4f7;min-height:100vh;display:grid;place-items:center"><div id="character" style="width:320px;height:320px"></div><script type="module">import { createCharacter } from './cliplab.js'; const definition = await fetch('./character.json').then(r => r.json()); const player = createCharacter(document.querySelector('#character'), definition, { animation: ${idLiteral}, followCursor: true }); window.addEventListener('pagehide', () => player.destroy());</script></body></html>`)
  }
  return new Blob([zipSync(files, { level: 6 })], { type: 'application/zip' })
}
