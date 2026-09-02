import { describe, expect, it } from 'vitest'
import { BotEngine } from './engine'
import { EYE_STYLE_BY_ID } from './eyes'
import { REST_GAZE } from './face'
import { DEFAULT_RELIEF, RELIEFS, RELIEF_BY_ID, shadeFor } from './relief'

const R = 100
const style = EYE_STYLE_BY_ID.get('iris')!

describe('relief du corps', () => {
  it('coupe : force nulle ne rend aucun degrade', () => {
    expect(shadeFor(REST_GAZE, R, 0)).toBeNull()
    const e = new BotEngine(R, 'idle', null, null, style, 0)
    expect(e.sample(1).shade).toBeNull()
  })

  /**
   * Le point de la phase 3 : le corps et le visage doivent raconter la meme
   * chose. Le degrade suit donc l'orientation de tete, et pas une lumiere fixe.
   */
  it('le clair part du cote ou la tete pointe', () => {
    const droite = shadeFor({ yaw: 35, pitch: 0, roll: 0 }, R)!
    const gauche = shadeFor({ yaw: -35, pitch: 0, roll: 0 }, R)!
    expect(droite.cx).toBeGreaterThan(5)
    expect(gauche.cx).toBeLessThan(-5)
    // tangage positif = regarde en haut, donc y ecran negatif
    const haut = shadeFor({ yaw: 0, pitch: 35, roll: 0 }, R)!
    const bas = shadeFor({ yaw: 0, pitch: -35, roll: 0 }, R)!
    expect(haut.cy).toBeLessThan(-5)
    expect(bas.cy).toBeGreaterThan(5)
  })

  /**
   * Le centre clair doit rester DANS la silhouette : pose dehors, la bande se
   * coupe net au bord au lieu de tourner autour du volume.
   */
  it('le centre clair ne sort jamais du corps', () => {
    for (let yaw = -90; yaw <= 90; yaw += 5) {
      for (let pitch = -90; pitch <= 90; pitch += 5) {
        const s = shadeFor({ yaw, pitch, roll: 0 }, R)!
        expect(Math.hypot(s.cx, s.cy)).toBeLessThan(R * 0.75)
      }
    }
  })

  /**
   * Cuisable : un degrade n'est pas un chemin, donc rien ne peut changer de
   * signature de commandes d'une image a l'autre. Reste a verifier que ses
   * nombres sont bien des nombres a tout instant — une seule valeur non finie
   * et SMIL laisse tomber la piste entiere.
   */
  it('ne produit que des nombres finis, sur toute une lecture', () => {
    const e = new BotEngine(R, 'idle', null, null, style)
    for (let i = 0; i < 200; i++) {
      const s = e.sample(i / 10).shade!
      for (const v of [s.cx, s.cy, s.r, s.lift, s.drop]) expect(Number.isFinite(v)).toBe(true)
      expect(s.r).toBeGreaterThan(0)
    }
  })

  /**
   * Ce que le basculement doit garantir, et la seule chose qu'il garantit : passer
   * a plat retire le SHADER, pas la 3D.
   *
   * Les yeux restent sur leur sphere, gardent leur compression de profondeur et
   * suivent la meme orientation de tete ; le corps garde son chemin. Autrement
   * dit, tout ce qui fait le volume pseudo-3D est GEOMETRIQUE et survit a l'aplat.
   * Une image rendue avec et sans doit donc etre identique partout sauf `shade`.
   */
  it('a plat, seul le degrade disparait : la geometrie ne bouge pas', () => {
    const volume = new BotEngine(R, 'idle', null, null, style, 1)
    const plat = new BotEngine(R, 'idle', null, null, style, 0)
    for (const t of [0, 0.7, 1.45, 2.6, 4.1]) {
      const a = volume.sample(t)
      const b = plat.sample(t)
      expect(b.shade).toBeNull()
      expect(a.shade).not.toBeNull()
      // tout le reste, au byte
      expect({ ...b, shade: null }).toEqual({ ...a, shade: null })
    }
  })

  /** Et les deux modes du catalogue sont bien ces deux-la. */
  it('le catalogue offre un volume et un aplat, et le defaut existe', () => {
    expect(RELIEF_BY_ID.get(DEFAULT_RELIEF)).toBeDefined()
    expect(RELIEFS.map((r) => r.id).sort()).toEqual(['plat', 'volume'])
    expect(RELIEF_BY_ID.get('plat')!.force).toBe(0)
    expect(RELIEF_BY_ID.get('volume')!.force).toBeGreaterThan(0)
  })

  it('ne rend pas le moteur non rejouable', () => {
    const dates = [0.4, 1.3, 2.2, 3.9]
    const a = new BotEngine(R, 'idle', null, null, style)
    const suite = dates.map((t) => JSON.stringify(a.sample(t).shade))
    const b = new BotEngine(R, 'idle', null, null, style)
    b.sample(3.9)
    b.sample(0.4)
    expect(dates.map((t) => JSON.stringify(b.sample(t).shade))).toEqual(suite)
  })
})
