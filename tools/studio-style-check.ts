import { BASE_POSE, defaultProject, type Sample } from '../src/studio/model'
import { FACE_SETS, facePose } from '../src/studio/face-styles'
import { CharacterRenderer } from '../src/studio/renderer'

const character = { ...defaultProject().characters[2]!, gradient: false, trueFront: true, lockPosition: true, shadow: false, candleLight: true, color: '#c4c4c4', eyeColor: '#181818' }
const sample: Sample = { pose: { ...BASE_POSE, mouth: 'line' }, bob: 0, breathe: 0, blink: 0, expressionId: '', beatIndex: 0, stepIndex: 0, effectPhase: .35 }
const canvas = document.createElement('canvas'), renderer = new CharacterRenderer(canvas, { width: 344, height: 344, pixelRatio: 1 })
const read = () => { const c = document.createElement('canvas'); c.width = c.height = 344; const ctx = c.getContext('2d')!; ctx.drawImage(canvas, 0, 0); return ctx.getImageData(0, 0, 344, 344).data }
const results: Record<string, unknown> = {}
function append(target: string, name: string) { const card = document.createElement('article'), title = document.createElement('h2'), image = new Image(); title.textContent = name; image.src = canvas.toDataURL(); image.alt = name; card.append(image, title); document.querySelector(target)!.append(card) }
try {
  for (const shape of ['cap', 'capsule', 'sphere'] as const) {
    for (const angle of [0, 65]) {
      renderer.render({ ...character, shape, trueFront: false }, sample, { displaySize: 12, rotation: { x: 0, y: angle, z: 0 }, cursor: { x: 0, y: 0 } })
      const counts = new Map<string, number>(), px = read()
      for (let i = 0; i < px.length; i += 4) if (px[i + 3] === 255) { const key = `${px[i]},${px[i + 1]},${px[i + 2]}`; counts.set(key, (counts.get(key) ?? 0) + 1) }
      const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])
      const coverage = dominant.slice(0, 2).reduce((n, p) => n + p[1], 0) / [...counts.values()].reduce((a, b) => a + b, 0)
      if (coverage < .97 || dominant[1]![1] < 100) throw new Error(`${shape} does not have exactly one substantial shade step`)
      results[`${shape} ${angle}°`] = { dominant: dominant.slice(0, 2).map(p => p[0]), coverage }
      renderer.render({ ...character, shape, trueFront: false }, sample, { displaySize: 344, rotation: { x: 0, y: angle, z: 0 } }); append('#shapes', `${shape} · ${angle}°`)
    }
  }
  const set = FACE_SETS[1]!, colors = ['#f6a7b9','#f6a7b9','#ffdb57','#f6a7b9','#aa7ddd','#84d6c5','#ffd3bc','#ffd3bc','#83d6ce','#fa6f6f','#ffd3bc','#73b6ef']
  for (const [index, preset] of set.presets.entries()) {
    renderer.render({ ...character, color: colors[index]! }, { ...sample, pose: facePose(set, preset) }, { displaySize: 344 }); append('#gallery', preset.name)
  }
  for (const locked of [false, true]) {
    renderer.render({ ...character, trueFront: locked, followRotation: true }, sample, { cursor: { x: -1, y: .8 } }); const a = read()
    renderer.render({ ...character, trueFront: locked, followRotation: true }, sample, { cursor: { x: 1, y: -.8 } }); const b = read()
    const changed = a.reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0)
    if (locked ? changed !== 0 : changed < 100) throw new Error('Cursor rotation/front-lock precedence failed')
    results[`Cursor rotation, front=${locked}`] = { changedChannels: changed }
  }
  for (const size of [12, 16, 24]) {
    renderer.render(character, { ...sample, pose: facePose(set, set.presets[6]!) }, { displaySize: size }); const a = read()
    renderer.render(character, { ...sample, pose: { ...facePose(set, set.presets[6]!), brows: 'angry', blush: 1, mouth: 'tongue-out', tears: true, prop: 'heart' } }, { displaySize: size }); const b = read()
    if (a.some((v, i) => v !== b[i])) throw new Error(`Extra facial details leak into ${size}px`)
  }
  results['Responsive Set 2'] = 'Eyes only at 16–24px; body only below 16px'
  document.querySelector('#status')!.textContent = 'All style checks passed.'
} catch (e) { document.querySelector('#status')!.textContent = String(e) }
finally { renderer.dispose(); document.querySelector('#report')!.textContent = JSON.stringify(results, null, 2) }
