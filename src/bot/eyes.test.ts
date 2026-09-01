import { describe, expect, it } from 'vitest'
import { BotEngine } from './engine'
import { DEFAULT_EYE_STYLE, EYE_STYLES, EYE_STYLE_BY_ID } from './eyes'
import { EXPRESSIONS } from './expressions'
import { SHAPES } from './skins'

const R = 100

/** Les six nombres d'un `matrix(a,b,c,d,e,f)`. */
const mat = (m: string) => m.match(/-?\d+\.?\d*/g)!.map(Number)

/** Premier instant ou la paupiere est a mi-course. `BLINKS` commence a 1,4 s. */
const MI_CLIGNEMENT = 1.4 + 0.18 * 0.45

describe("styles d'oeil", () => {
  it('sans style, rien ne change : aucune couche', () => {
    const e = new BotEngine(R, 'idle', null, null, null)
    for (const oeil of e.sample(1).eyes) expect(oeil.layers).toEqual([])
  })

  /**
   * Le style par defaut du catalogue est celui que TOUT porte quand personne n'a
   * choisi — l'avatar, les vignettes, les exports, le favicon. Il doit donc
   * exister : `DEFAULT_EYE_STYLE` est une chaine, rien ne la relie au tableau a
   * la compilation.
   */
  it('le style par defaut existe au catalogue', () => {
    expect(EYE_STYLE_BY_ID.get(DEFAULT_EYE_STYLE)).toBeDefined()
  })

  /**
   * Le coeur du mecanisme. La sclere est un TROU qui s'ecrase ; les couches sont
   * peintes derriere et ne bougent pas, donc la paupiere les ROGNE. Partager la
   * matrice donnerait un iris en caoutchouc — c'est ce que ce test interdit.
   */
  it('le clignement ecrase la sclere et laisse les couches intactes', () => {
    const e = new BotEngine(R, 'idle', null, null, EYE_STYLE_BY_ID.get('iris')!)
    const ouvert = e.sample(1)
    const ferme = e.sample(MI_CLIGNEMENT)

    const oeilOuvert = ouvert.eyes[0]!
    const oeilFerme = ferme.eyes[0]!

    // b et d sont les sorties en y : c'est la que `blinkScale` s'applique
    const yOuvert = Math.hypot(mat(oeilOuvert.matrix)[1]!, mat(oeilOuvert.matrix)[3]!)
    const yFerme = Math.hypot(mat(oeilFerme.matrix)[1]!, mat(oeilFerme.matrix)[3]!)
    expect(yFerme).toBeLessThan(yOuvert * 0.75)

    // la matrice des couches, elle, ne porte aucun ecrasement
    const bOuvert = Math.hypot(mat(oeilOuvert.base)[1]!, mat(oeilOuvert.base)[3]!)
    const bFerme = Math.hypot(mat(oeilFerme.base)[1]!, mat(oeilFerme.base)[3]!)
    expect(bFerme).toBeCloseTo(bOuvert, 6)
  })

  /**
   * Une couche qui sort de la sclere se ferait recouvrir par le corps et
   * disparaitrait par morceaux. La course est donc bornee par ce qui RESTE entre
   * la couche et le bord, et ce test balaye les combinaisons ou elle est maximale.
   */
  it('aucune couche ne sort de sa sclere', () => {
    const fautifs: string[] = []
    for (const style of EYE_STYLES) {
      if (!style.layers.length) continue
      for (const expr of [null, ...EXPRESSIONS]) {
        for (const forme of [null, ...SHAPES.map((s) => s.radii)]) {
          const e = new BotEngine(R, 'idle', forme, expr, style)
          for (let i = 0; i < 40; i++) {
            for (const oeil of e.sample(i / 8).eyes) {
              const g = oeil.d.match(/-?\d+\.?\d*/g)!.map(Number)
              const hw = Math.abs(g[0]!)
              const hh = Math.abs(g[1]!) + Math.abs(g[2]!)
              oeil.layers.forEach((c, j) => {
                const debordeX = Math.abs(c.cx) + c.r - hw
                const debordeY = Math.abs(c.cy) + c.r - hh
                if (debordeX > 0.01 || debordeY > 0.01) {
                  fautifs.push(
                    `${style.id}/${expr?.id ?? 'pose'}/couche ${j} (${debordeX.toFixed(2)}, ${debordeY.toFixed(2)})`
                  )
                }
              })
            }
          }
        }
      }
    }
    expect([...new Set(fautifs)]).toEqual([])
  }, 30_000)

  /** Meme garde que pour le reste du moteur : `sample` ne doit pas muter. */
  it('les couches ne rendent pas le moteur non rejouable', () => {
    const style = EYE_STYLE_BY_ID.get('iris')!
    const a = new BotEngine(R, 'idle', null, null, style)
    const suite = [0.3, 1.1, MI_CLIGNEMENT, 2.4].map((t) => JSON.stringify(a.sample(t)))
    const b = new BotEngine(R, 'idle', null, null, style)
    // relu dans le desordre puis dans l'ordre : meme sortie
    b.sample(2.4)
    b.sample(0.3)
    const rejoue = [0.3, 1.1, MI_CLIGNEMENT, 2.4].map((t) => JSON.stringify(b.sample(t)))
    expect(rejoue).toEqual(suite)
  })
})
