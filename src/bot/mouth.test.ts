import { describe, expect, it } from 'vitest'
import { BotEngine } from './engine'
import { EXPRESSIONS } from './expressions'
import { SHAPES } from './skins'
import { VISAGE_BY_ID } from './visage'
import { mouthPath } from './mouth'

const R = 100
const trait = VISAGE_BY_ID.get('trait')!
const classique = VISAGE_BY_ID.get('classique')!

/** Les lettres d'un chemin, sans les nombres. */
const signature = (d: string) => d.replace(/[-0-9.eE\s]+/g, '')

describe('bouche', () => {
  it("n'existe pas sur un visage qui n'en declare pas", () => {
    const e = new BotEngine(R, 'idle', null, null, null, 1, classique)
    expect(e.sample(1).mouth).toBeNull()
    // ni sans visage du tout : c'est le defaut, rien ne doit changer
    expect(new BotEngine(R, 'idle').sample(1).mouth).toBeNull()
  })

  it('existe sur `trait`, et disparait avec le visage', () => {
    const e = new BotEngine(R, 'idle', null, null, null, 1, trait)
    expect(e.sample(1).mouth).not.toBeNull()
    // `alert` n'a pas de visage : eyeAlpha 0, donc pas de bouche non plus
    const nu = new BotEngine(R, 'alert', null, null, null, 1, trait)
    expect(nu.sample(0.2).mouth).toBeNull()
  })

  /**
   * Cuisable. Le contour est une polyligne a nombre de points FIXE, donc sa
   * signature ne peut pas bouger — ni d'une humeur a l'autre, ni pendant un
   * morph, ni quand la bouche s'ouvre. C'est le test que la phase 1 a rendu
   * concret, applique a un trait neuf.
   */
  it('garde UNE signature de commandes sur toutes les humeurs et tout un morph', () => {
    const sigs = new Set<string>()
    for (const expr of EXPRESSIONS) {
      sigs.add(signature(mouthPath(expr.mouth, R)))
      const e = new BotEngine(R, 'idle', null, expr, null, 1, trait)
      for (let i = 0; i < 20; i++) {
        const m = e.sample(i / 8).mouth
        if (m) sigs.add(signature(m.d))
      }
    }
    // et pendant un fondu d'expression, ou les nombres sont interpoles
    const e = new BotEngine(R, 'idle', null, EXPRESSIONS[0]!, null, 1, trait)
    e.setExpression(EXPRESSIONS[5]!, 1)
    for (let i = 0; i < 20; i++) {
      const m = e.sample(1 + i / 40).mouth
      if (m) sigs.add(signature(m.d))
    }
    expect(sigs.size).toBe(1)
  })

  /**
   * La bouche est posee sur la sphere et recollee au contour reel comme les
   * yeux. Elle ne doit donc pas depasser la silhouette, sur aucune des deux
   * formes ni aucune humeur — sinon elle serait rognee et lirait comme un trou.
   */
  it('reste dans la silhouette, sur les deux formes et les seize humeurs', () => {
    const fautifs: string[] = []
    for (const forme of [null, ...SHAPES.map((s) => s.radii)]) {
      for (const expr of EXPRESSIONS) {
        const e = new BotEngine(R, 'idle', forme, expr, null, 1, trait)
        for (let i = 0; i < 24; i++) {
          const f = e.sample(i / 8)
          if (!f.mouth) continue
          const n = f.bodyPath.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
          const poly: Array<[number, number]> = []
          for (let k = 0; k + 1 < n.length; k += 2) poly.push([n[k]!, n[k + 1]!])
          const m = f.mouth.matrix.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
          const [a, b, c, d, tx, ty] = m as number[]
          const pts = f.mouth.d.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
          for (let k = 0; k + 1 < pts.length; k += 2) {
            const lx = pts[k]!
            const ly = pts[k + 1]!
            const px = a! * lx + c! * ly + tx!
            const py = b! * lx + d! * ly + ty!
            if (!dedans(poly, px, py)) fautifs.push(`${expr.id} @${(i / 8).toFixed(2)}`)
          }
        }
      }
    }
    expect([...new Set(fautifs)]).toEqual([])
  }, 30_000)

  it('ne rend pas le moteur non rejouable', () => {
    const dates = [0.4, 1.3, 2.2, 3.9]
    const a = new BotEngine(R, 'idle', null, null, null, 1, trait)
    const suite = dates.map((t) => JSON.stringify(a.sample(t).mouth))
    const b = new BotEngine(R, 'idle', null, null, null, 1, trait)
    b.sample(3.9)
    b.sample(0.4)
    expect(dates.map((t) => JSON.stringify(b.sample(t).mouth))).toEqual(suite)
  })
})

/** Le point est-il dans le polygone ? Lancer de rayon, comme `skins.test.ts`. */
function dedans(poly: Array<[number, number]>, x: number, y: number) {
  let on = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[i]!
    const [bx, by] = poly[j]!
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) on = !on
  }
  return on
}
