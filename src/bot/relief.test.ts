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

  /* ------------------------------------------------------------- raccourci */

  /** Hauteur de l'empreinte du corps, lue sur le chemin rendu. */
  const hauteur = (f: { bodyPath: string }) => {
    const n = f.bodyPath.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    const ys = n.filter((_, i) => i % 2 === 1)
    return Math.max(...ys) - Math.min(...ys)
  }

  /** Rend `idle` avec un regard impose, sans derive ni clignement parasites. */
  const avecRegard = (yaw: number, pitch: number, force = 1, raccourciForce = 1) => {
    const e = new BotEngine(R, 'idle', null, null, style, force)
    ;(e as unknown as { raccourci: number }).raccourci = raccourciForce
    e.setLook({ yaw, pitch, mix: 1, wander: 0, spin: 0 }, -10, 0.001)
    return e.sample(0)
  }

  it('le tangage raccourcit le corps, le lacet ne le touche pas', () => {
    const repos = hauteur(avecRegard(REST_GAZE.yaw, REST_GAZE.pitch))
    // un solide de revolution autour de la verticale : tourner ne change rien
    const tourne = hauteur(avecRegard(REST_GAZE.yaw + 40, REST_GAZE.pitch))
    expect(tourne).toBeCloseTo(repos, 6)
    // pencher, si — borne par le plancher, donc 6 % au plus
    const penche = hauteur(avecRegard(REST_GAZE.yaw, REST_GAZE.pitch + 40))
    expect(penche).toBeLessThan(repos * 0.97)
    expect(penche).toBeGreaterThan(repos * 0.93)
    // et dans les deux sens de la meme facon
    const contre = hauteur(avecRegard(REST_GAZE.yaw, REST_GAZE.pitch - 40))
    expect(contre).toBeCloseTo(penche, 4)
  })

  it('ne raccourcit quasiment pas au repos : la forme dessinee est celle qu on voit', () => {
    const sans = hauteur(new BotEngine(R, 'idle', null, null, style).sample(0))
    const repos = hauteur(avecRegard(REST_GAZE.yaw, REST_GAZE.pitch))
    // pas EXACTEMENT egal : la derive du regard vit meme au repos, donc elle
    // raccourcit d'un cheveu. Un dixieme de pour cent, ce qui est le but.
    expect(Math.abs(repos - sans) / sans).toBeLessThan(0.005)
  })

  /**
   * La frontiere demandee : le raccourci est de la GEOMETRIE, donc il survit a
   * l'aplat. Un corps a plat penche toujours.
   */
  it('le raccourci vaut aussi a plat : ce n est pas du shader', () => {
    const volume = avecRegard(REST_GAZE.yaw, REST_GAZE.pitch + 40, 1)
    const plat = avecRegard(REST_GAZE.yaw, REST_GAZE.pitch + 40, 0)
    expect(plat.shade).toBeNull()
    expect(plat.bodyPath).toBe(volume.bodyPath)
    expect(hauteur(plat)).toBeLessThan(hauteur(avecRegard(REST_GAZE.yaw, REST_GAZE.pitch, 0)) * 0.97)
  })

  /**
   * Ce que le correctif de `bodyRadius` achete : les yeux suivent le corps
   * ECRASE, donc le raccourci ne les rapproche pas du bord.
   *
   * Compare AVEC et SANS, et pas contre un seuil absolu : au-dela de 30 degres
   * d'ecart la sphere des yeux frole deja la silhouette toute seule — mesure
   * sans raccourci, la marge tombe a 1,5 unite a 30 degres et a 0,33 a 40. C'est
   * une propriete du modele, pas de ce cue, et un seuil absolu l'aurait mise sur
   * son dos. Ce qu'on lui demande, c'est de ne pas empirer les choses.
   */
  it('le raccourci ne rapproche pas les yeux du bord', () => {
    const marge = (d: number, force: number) => {
      const f = avecRegard(REST_GAZE.yaw, REST_GAZE.pitch + d, 1, force)
      const n = f.bodyPath.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
      const pts: Array<[number, number]> = []
      for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i]!, n[i + 1]!])
      let pire = Infinity
      for (const oeil of f.eyes) {
        const m = oeil.matrix.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
        const [a, b, c, dd, ex, ey] = m as number[]
        for (let k = 0; k < 16; k++) {
          const t = (k / 16) * Math.PI * 2
          const px = a! * Math.cos(t) * 15 + c! * Math.sin(t) * 15 + ex!
          const py = b! * Math.cos(t) * 15 + dd! * Math.sin(t) * 15 + ey!
          pire = Math.min(pire, Math.min(...pts.map(([x, y]) => Math.hypot(x - px, y - py))))
        }
      }
      return pire
    }
    for (const d of [0, 10, 20, 30, 40]) {
      expect(marge(d, 1), `tangage ${d}`).toBeGreaterThan(marge(d, 0) - 1.5)
    }
    // et dans la plage ou une tete va vraiment, la marge reste large
    for (const d of [-20, -10, 0, 10, 20]) {
      expect(marge(d, 1), `tangage ${d}`).toBeGreaterThan(5)
    }
  })

  /** Cuisable : le corps garde UNE signature de commandes malgre le raccourci. */
  it('le raccourci ne change pas la signature du chemin du corps', () => {
    const sigs = new Set<string>()
    for (let d = -60; d <= 60; d += 5) {
      const f = avecRegard(REST_GAZE.yaw, REST_GAZE.pitch + d)
      sigs.add(f.bodyPath.replace(/[-0-9.eE\s]+/g, ''))
    }
    expect(sigs.size).toBe(1)
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
