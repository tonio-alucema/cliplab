/**
 * Marge des yeux, forme par forme.
 *
 * `skins.test.ts` verifie que la gelule ne SORT pas. Ce n'est pas la meme
 * question qu'une revue d'art : un oeil qui reste dedans mais rase le bord se
 * lit quand meme comme une encoche. On mesure donc la marge, pas le debordement,
 * et on la compare au cercle, qui est la reference.
 */
import { BotEngine, type RenderedEye } from '@/bot/engine'
import { EXPRESSIONS } from '@/bot/expressions'
import { SHAPES } from '@/bot/skins'
import { STATES } from '@/bot/states'

const R = 100

function contourDuCorps(d: string) {
  const pts: Array<{ x: number; y: number }> = []
  for (const seg of d.slice(1).split('C')) {
    const n = seg.match(/-?\d+\.?\d*/g)?.map(Number) ?? []
    if (n.length >= 6) pts.push({ x: n[4]!, y: n[5]! })
    else if (n.length === 2) pts.push({ x: n[0]!, y: n[1]! })
  }
  return pts
}

function contourDeLOeil(eye: RenderedEye, N = 32) {
  const g = eye.d.match(/-?\d+\.?\d*/g)!.map(Number)
  const hw = Math.abs(g[0]!)
  const r = Math.abs(g[2]!)
  const droit = Math.abs(g[1]!)
  const m = eye.matrix.match(/-?\d+\.?\d*/g)!.map(Number)
  const [a, b, c, d, e, f] = m as [number, number, number, number, number, number]
  const out: Array<{ x: number; y: number }> = []
  for (let i = 0; i < N; i++) {
    const u = (i / N) * 4
    let x: number
    let y: number
    if (u < 1) {
      const t = Math.PI * (u - 0.5)
      x = Math.cos(t) * r
      y = -droit + Math.sin(t) * r
    } else if (u < 2) {
      x = hw
      y = -droit + (u - 1) * 2 * droit
    } else if (u < 3) {
      const t = Math.PI * (u - 2 + 0.5)
      x = Math.cos(t) * r
      y = droit + Math.sin(t) * r
    } else {
      x = -hw
      y = droit - (u - 3) * 2 * droit
    }
    out.push({ x: a * x + c * y + e, y: b * x + d * y + f })
  }
  return out
}

const CORPS_DE_BASE = STATES.filter((s) => s.baseBody).map((s) => s.id)

console.log('forme       marge min (u)   ou')
const lignes: Array<[string, number, string]> = []
for (const forme of SHAPES) {
  let pire = Infinity
  let ou = ''
  for (const state of CORPS_DE_BASE) {
    for (const expr of [null, ...EXPRESSIONS]) {
      const e = new BotEngine(R, state, forme.radii, expr)
      for (let i = 0; i < 60; i++) {
        const f = e.sample(i / 20)
        const corps = contourDuCorps(f.bodyPath)
        for (const eye of f.eyes) {
          for (const p of contourDeLOeil(eye)) {
            const d = Math.min(...corps.map((q) => Math.hypot(q.x - p.x, q.y - p.y)))
            if (d < pire) {
              pire = d
              ou = `${state}/${expr?.id ?? 'pose'}`
            }
          }
        }
      }
    }
  }
  lignes.push([forme.id, pire, ou])
}
const ref = lignes.find((l) => l[0] === 'cercle')![1]
for (const [id, m, ou] of lignes.sort((a, b) => a[1] - b[1])) {
  const drapeau = m < ref * 0.55 ? '  <-- rase le bord' : ''
  console.log(`${id.padEnd(11)} ${m.toFixed(2).padStart(8)}   ${ou}${drapeau}`)
}
console.log(`\ncercle (reference) = ${ref.toFixed(2)} u`)
