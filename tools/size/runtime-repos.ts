/**
 * Cible « runtime JS », variante AVATAR AU REPOS : `sample(t)` plus un peintre DOM.
 *
 * C'est le minimum utile embarquable : une boule qui respire, cligne et suit le
 * pointeur. Pas de montage, donc `cycles.ts` n'entre pas.
 */
import { BotEngine, type BotFrame } from '@/bot/engine'
import { DEMI_VIEWBOX, RAYON } from '@/bot/repere'
import { SHAPE_BY_ID } from '@/bot/skins'
import { EXPRESSION_BY_ID } from '@/bot/expressions'

const SVG = 'http://www.w3.org/2000/svg'

export interface Options {
  taille?: number
  forme?: string
  expression?: string
  encre?: string
  papier?: string
}

export function monte(hote: Element, o: Options = {}) {
  const taille = o.taille ?? 320
  const encre = o.encre ?? '#0a0a0c'
  const papier = o.papier ?? '#f9f9f9'
  const VB = DEMI_VIEWBOX

  const eng = new BotEngine(
    RAYON,
    'idle',
    SHAPE_BY_ID.get(o.forme ?? 'dome')?.radii ?? null,
    EXPRESSION_BY_ID.get(o.expression ?? 'neutre') ?? null
  )

  const el = (n: string, a: Record<string, string>) => {
    const e = document.createElementNS(SVG, n)
    for (const k in a) e.setAttribute(k, a[k]!)
    return e
  }

  const svg = el('svg', {
    width: String(taille),
    height: String(taille),
    viewBox: `${-VB} ${-VB} ${VB * 2} ${VB * 2}`
  })
  const uid = `m${Math.random().toString(36).slice(2, 8)}`
  const defs = el('defs', {})
  const mask = el('mask', {
    id: uid,
    maskUnits: 'userSpaceOnUse',
    x: String(-VB),
    y: String(-VB),
    width: String(VB * 2),
    height: String(VB * 2)
  })
  const corpsMasque = el('path', { fill: '#fff' })
  mask.append(corpsMasque)
  const yeux: SVGPathElement[] = []
  defs.append(mask)
  const fond = el('path', { fill: papier })
  const groupe = el('g', { mask: `url(#${uid})` })
  groupe.append(
    el('rect', {
      x: String(-VB),
      y: String(-VB),
      width: String(VB * 2),
      height: String(VB * 2),
      fill: encre
    })
  )
  svg.append(defs, fond, groupe)
  hote.append(svg)

  const peins = (f: BotFrame) => {
    corpsMasque.setAttribute('d', f.bodyPath)
    fond.setAttribute('d', f.bodyPath)
    while (yeux.length < f.eyes.length) {
      const p = el('path', { fill: '#000' })
      mask.append(p)
      yeux.push(p as SVGPathElement)
    }
    f.eyes.forEach((e, i) => {
      const p = yeux[i]!
      p.setAttribute('d', e.d)
      p.setAttribute('transform', e.matrix)
      p.setAttribute('opacity', String(e.alpha))
    })
  }

  const depart = performance.now()
  const boucle = () => {
    peins(eng.sample((performance.now() - depart) / 1000))
    requestAnimationFrame(boucle)
  }
  boucle()

  return { engine: eng, svg }
}
