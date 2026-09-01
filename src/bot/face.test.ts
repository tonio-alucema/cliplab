import { describe, expect, it } from 'vitest'
import { EYE_H, EYE_SPLIT, EYE_W, REST_GAZE, eyePoses, type HeadGaze } from './face'

/**
 * La pose de repos RELEVEE sur la video, et l'oeil qui allait avec.
 *
 * Ce n'est plus ce que nous expedions — `REST_GAZE`, `EYE_SPLIT`, `EYE_W` et
 * `EYE_H` sont desormais des choix (cf. `face.ts`) — mais c'est toujours ce que
 * le MODELE doit savoir reproduire. Les deux questions sont distinctes et ce
 * fichier les separe : ici on verifie le modele contre la reference, avec les
 * nombres de la reference ; ce que porte le produit se juge a l'ecran.
 */
const REPOS_MESURE: HeadGaze = { yaw: 28.49, pitch: 28.62, roll: -13 }
const SPLIT_MESURE = 15.46
const W_MESURE = 0.186
const H_MESURE = 0.412

/**
 * Valeurs relevees image par image sur la video de reference (unites : rayon de
 * la boule au repos = 1, y vers le bas). Le modele de sphere doit les
 * reproduire : c'est lui qui garantit que l'oeil proche du bord se comprime
 * exactement comme dans l'original.
 */
const MESURES: Array<{
  nom: string
  gaze: HeadGaze
  split: number
  w: number
  h: number
  yeux: Array<{ x: number; y: number; court: number; long: number }>
}> = [
  {
    nom: 'repos',
    gaze: REPOS_MESURE,
    split: SPLIT_MESURE,
    w: W_MESURE,
    h: H_MESURE,
    yeux: [
      { x: 0.189, y: -0.412, court: 0.178, long: 0.39 },
      { x: 0.614, y: -0.51, court: 0.12, long: 0.395 }
    ]
  },
  {
    nom: 'yeux ecarquilles',
    gaze: { yaw: 6.92, pitch: -21.96, roll: 11.6 },
    split: 18.43,
    w: 0.356,
    h: 0.875,
    yeux: [
      { x: -0.198, y: 0.295, court: 0.353, long: 0.82 },
      { x: 0.412, y: 0.415, court: 0.315, long: 0.826 }
    ]
  },
  {
    nom: 'notification',
    gaze: { yaw: -21.94, pitch: -5.82, roll: -12.2 },
    split: 18.89,
    w: 0.505,
    h: 0.498,
    yeux: [
      { x: -0.675, y: 0.172, court: 0.39, long: 0.495 },
      { x: -0.059, y: 0.027, court: 0.495, long: 0.5 }
    ]
  }
]

const court = (e: ReturnType<typeof eyePoses>[number], w: number) => Math.hypot(e.a, e.b) * w
const long = (e: ReturnType<typeof eyePoses>[number], h: number) => Math.hypot(e.c, e.d) * h

describe('yeux poses sur une sphere', () => {
  for (const m of MESURES) {
    it(`reproduit la pose "${m.nom}" mesuree sur la video`, () => {
      const poses = eyePoses(m.gaze, 1, m.split)
      for (let i = 0; i < 2; i++) {
        const p = poses[i]!
        const attendu = m.yeux[i]!
        // 0.04 rayon = ~7 px sur la boule de 190 px de la video
        expect(p.x).toBeCloseTo(attendu.x, 1)
        expect(p.y).toBeCloseTo(attendu.y, 1)
        expect(Math.abs(court(p, m.w) - attendu.court)).toBeLessThan(0.04)
        expect(Math.abs(long(p, m.h) - attendu.long)).toBeLessThan(0.04)
      }
    })
  }

  /** Invariant du modele : vrai pour n'importe quel regard, pas seulement le notre. */
  it('comprime l oeil exactement du facteur de profondeur de la sphere', () => {
    const regards = [REST_GAZE, REPOS_MESURE, { yaw: -35, pitch: 12, roll: 8 }]
    for (const gaze of regards) {
      for (const e of eyePoses(gaze, 1)) {
        expect(e.a * e.d - e.b * e.c).toBeCloseTo(e.depth, 6)
      }
    }
  })

  /**
   * Et la reproduction de la MESURE, sur la pose mesuree. C'est elle qui a servi
   * a ajuster le modele : 0,663 d'aire et 0,674 de largeur entre l'oeil lointain
   * et l'oeil proche. Notre pose de repos donne d'autres nombres, ce qui est
   * normal — elle est moins tournee — et ne dit rien de la justesse du modele.
   */
  it('retrouve la compression relevee sur la video, a la pose de la video', () => {
    const [proche, loin] = eyePoses(REPOS_MESURE, 1, SPLIT_MESURE)
    expect(loin.depth / proche.depth).toBeCloseTo(0.663, 1)
    expect(court(loin, W_MESURE) / court(proche, W_MESURE)).toBeCloseTo(0.674, 1)
  })

  /** Notre pose garde un vrai trois-quarts : sans lui, plus de volume. */
  it('garde une compression visible sur la pose de repos expediee', () => {
    const [proche, loin] = eyePoses(REST_GAZE, 1)
    const rapport = court(loin, EYE_W) / court(proche, EYE_W)
    expect(rapport).toBeLessThan(0.95)
    expect(rapport).toBeGreaterThan(0.5)
  })

  it('garde la meme longueur pour les deux yeux (axe tangentiel non deforme)', () => {
    const [a, b] = eyePoses(REST_GAZE, 1)
    expect(long(a, EYE_H)).toBeCloseTo(long(b, EYE_H), 3)
  })

  it("conserve la separation angulaire de l'ecart demande, quel que soit le regard", () => {
    for (const split of [EYE_SPLIT, SPLIT_MESURE, 24]) {
      for (const gaze of [REST_GAZE, { yaw: -40, pitch: 10, roll: 5 }, { yaw: 0, pitch: 0, roll: 0 }]) {
        const [a, b] = eyePoses(gaze, 1, split)
        const dot = a.x * b.x + a.y * b.y + a.depth * b.depth
        expect((Math.acos(dot) * 180) / Math.PI).toBeCloseTo(split * 2, 4)
      }
    }
  })

  it('fait passer un oeil derriere la sphere quand la tete tourne fort', () => {
    const [, loin] = eyePoses({ yaw: 80, pitch: 0, roll: 0 }, 1)
    expect(loin.depth).toBeLessThan(0)
  })
})
