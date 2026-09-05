import { r2 } from './math'

/**
 * La bouche : le premier trait du visage qui ne soit pas un oeil.
 *
 * Elle est decrite par une COURBE et une epaisseur, pas par un dessin. Trois
 * nombres suffisent a couvrir ce que la direction demande — le renfrogne, le
 * trait plat, le sourire — et un quatrieme ouvre la bouche. Les seize
 * expressions en declarent une chacune, comme elles declarent deja leurs yeux.
 *
 * Le contour est une POLYLIGNE a nombre de points FIXE, et c'est deliberé : le
 * chemin garde donc la meme signature de commandes d'une image a l'autre, quelle
 * que soit la courbe. C'est la condition que la phase 1 a etablie pour qu'un trait
 * soit cuisable, et celle que les anneaux d'orbite ratent. Des arcs `A` auraient
 * ete plus courts a ecrire et auraient tenu aussi, mais la polyligne rend la
 * garantie evidente au lieu de la rendre plausible.
 */

/** Echantillons le long d'une levre. Fixe : c'est ce qui fige la signature. */
const LEVRE = 14
/** Points par embout arrondi. Fixe pour la meme raison. */
const EMBOUT = 6

export interface MouthCfg {
  /** largeur totale, en unites de rayon de boule */
  w: number
  /**
   * Courbure. Negatif = les coins tombent (renfrogne), 0 = trait, positif =
   * sourire. Exprimee en fraction de la demi-largeur, donc une bouche large
   * garde la meme allure qu'une etroite a courbure egale.
   */
  courbe: number
  /** epaisseur du trait, en unites de rayon de boule */
  epaisseur: number
  /** 0 = fermee ; au-dela la levre basse descend et la bouche s'ouvre */
  ouverture?: number
  /** part de la bouche occupee par la langue, 0 = aucune */
  langue?: number
}

export interface Point {
  x: number
  y: number
}

/**
 * Hauteur de la courbe au centre, pour une courbure et une demi-largeur.
 *
 * Le signe compte et il etait faux : l'ecran a le y VERS LE BAS, donc un
 * sourire — coins releves — veut un centre POSITIF, plus bas que les coins.
 * Avec le signe inverse, `heureux` boudait et `colere` souriait, sur seize
 * expressions dont les valeurs etaient pourtant justes.
 */
const fleche = (courbe: number, hw: number) => courbe * hw * 0.55

/**
 * Contour de la bouche, en repere BOUCHE (origine au centre du trait).
 *
 * Les levres sont decalees VERTICALEMENT et non perpendiculairement a la courbe.
 * Sur les courbures qu'on emploie l'ecart est invisible, et la version
 * perpendiculaire demandait une normale par echantillon pour un gain nul.
 */
export function mouthOutline(cfg: MouthCfg, scale: number): Point[] {
  const hw = (cfg.w * scale) / 2
  const t = Math.max((cfg.epaisseur * scale) / 2, 0.01)
  const k = fleche(cfg.courbe, hw)
  const ouvre = (cfg.ouverture ?? 0) * scale

  /** Courbe centrale : une parabole, nulle aux extremites. */
  const centre = (x: number) => k * (1 - (x / hw) ** 2)
  /** L'ouverture est maximale au centre et nulle aux coins, comme une bouche. */
  const bas = (x: number) => ouvre * (1 - (x / hw) ** 2)

  const haut: Point[] = []
  const basse: Point[] = []
  for (let i = 0; i < LEVRE; i++) {
    const x = -hw + (2 * hw * i) / (LEVRE - 1)
    haut.push({ x, y: centre(x) - t })
    basse.push({ x, y: centre(x) + t + bas(x) })
  }

  /** Embout : un demi-tour de rayon `t` autour du coin. */
  const cap = (cx: number, cy: number, de: number, a: number) =>
    Array.from({ length: EMBOUT }, (_, i) => {
      const th = de + ((a - de) * i) / (EMBOUT - 1)
      return { x: cx + Math.cos(th) * t, y: cy + Math.sin(th) * t }
    })

  const droite = haut[haut.length - 1]!
  const gauche = haut[0]!
  return [
    ...haut,
    ...cap(hw, centre(hw), -Math.PI / 2, Math.PI / 2),
    ...basse.slice().reverse(),
    ...cap(-hw, centre(-hw), Math.PI / 2, (3 * Math.PI) / 2),
    { x: gauche.x, y: gauche.y },
    { x: droite.x, y: droite.y }
  ].slice(0, LEVRE * 2 + EMBOUT * 2)
}

/** Contour -> chemin ferme. Que des `L` : la signature ne peut pas bouger. */
export function mouthPath(cfg: MouthCfg, scale: number): string {
  const pts = mouthOutline(cfg, scale)
  const first = pts[0]!
  let d = `M${r2(first.x)} ${r2(first.y)}`
  for (let i = 1; i < pts.length; i++) d += `L${r2(pts[i]!.x)} ${r2(pts[i]!.y)}`
  return `${d}Z`
}

/**
 * La langue : un disque pose au fond de la bouche, rogne par elle.
 *
 * Rogne et non ajuste : lui donner la forme exacte du fond demanderait de
 * recalculer un contour a chaque image, alors que le rognage est gratuit et
 * donne le meme resultat.
 */
export function tonguePos(cfg: MouthCfg, scale: number): { cx: number; cy: number; r: number } | null {
  const part = cfg.langue ?? 0
  const ouvre = (cfg.ouverture ?? 0) * scale
  if (part <= 0 || ouvre <= 0) return null
  const hw = (cfg.w * scale) / 2
  const k = fleche(cfg.courbe, hw)
  const r = ouvre * part
  return { cx: 0, cy: k + ouvre - r * 0.35, r }
}
