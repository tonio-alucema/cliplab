import { PROFILE_SAMPLES } from './profiles'
import {
  hullOfCircles,
  profileFromPolygon,
  regularPolygonProfile,
  superellipseProfile,
  unionOfCirclesProfile
} from './shape'

/**
 * Formes et couleurs proposees par le personnalisateur du bot.
 *
 * A la difference des silhouettes d'animation (`profiles.ts`), celles-ci ne sont
 * PAS relevees sur la video : elles sont construites analytiquement d'apres la
 * grille du personnalisateur d'origine. Deux sources distinctes, donc, et c'est
 * volontaire — les etats animes doivent rester fideles a la video, les formes de
 * base sont un choix d'utilisateur.
 */

/**
 * Les identifiants sont enumeres plutot que deduits du tableau : c'est ce qui
 * permet a la couche i18n de verifier A LA COMPILATION que chaque forme a bien
 * sa traduction dans les trois langues (`t(\`shapes.${id}\`)` ne compile que si
 * la cle existe). Un `as const` sur le tableau aurait le meme effet mais
 * rendrait `radii` en lecture seule, alors que le moteur le passe tel quel.
 */
export type ShapeId =
  | 'cercle'
  | 'galet'
  | 'squircle'
  | 'capsule'
  | 'triangle'
  | 'hexagone'
  | 'nuage'
  | 'goutte'
  | 'oeuf'
  | 'poire'
  | 'fuseau'
  | 'tonneau'
  | 'dome'
  | 'haricot'
  | 'trefle'
  | 'fleur'
  | 'gemme'
  | 'losange'

export interface BotShape {
  id: ShapeId
  radii: number[]
}

/** Ramene le rayon maximal a `max` pour que toutes les formes pesent pareil a l'oeil. */
function normalize(radii: number[], max = 1): number[] {
  const peak = Math.max(...radii)
  if (peak <= 0) return radii
  const k = max / peak
  return radii.map((r) => r * k)
}

const ANGLES = Array.from({ length: PROFILE_SAMPLES }, (_, i) => (i / PROFILE_SAMPLES) * Math.PI * 2)

/** Galet : cercle deforme par deux harmoniques basses, donc irregulier mais lisse. */
const pebble = normalize(
  ANGLES.map((a) => 1 + 0.075 * Math.cos(2 * a + 0.5) + 0.035 * Math.cos(3 * a + 2.1)),
  1.02
)

/** Nuage : union de bosses, large en bas, deux lobes en haut. */
const cloud = normalize(
  unionOfCirclesProfile([
    { x: -0.44, y: 0.2, r: 0.54 },
    { x: 0.46, y: 0.2, r: 0.5 },
    { x: 0.02, y: 0.3, r: 0.6 },
    { x: -0.24, y: -0.3, r: 0.48 },
    { x: 0.3, y: -0.24, r: 0.44 }
  ]),
  1.02
)

/** Goutte : gros disque en bas, pointe effilee en haut. */
const droplet = normalize(
  profileFromPolygon(hullOfCircles(0, 0.28, 0.66, 0, -0.96, 0.05), 0, 0),
  1.04
)

/** Capsule couchee : enveloppe de deux disques cote a cote. */
const capsule = profileFromPolygon(hullOfCircles(-0.42, 0, 0.62, 0.42, 0, 0.62), 0, 0)

/* ------------------------------------------------------ formes a axe vertical
 *
 * Elles ont toutes un HAUT et un BAS distincts, ce que les huit premieres
 * n'avaient qu'avec la goutte et le triangle. C'est ce que la phase 1 demande :
 * un axe lisible est ce qui donne au corps une orientation, donc un visage.
 *
 * Rappel de contrainte : le rayon maximal de TOUTES les formes fixe le cadre
 * d'export (`RAYON_MAX`, `export.ts`). On reste donc sous 1,15, le pic actuel
 * du squircle — au-dela, chaque image exportee serait recadree.
 */

/** Points d'un arc de cercle, en coordonnees ecran (y vers le bas). */
function arcPoints(cx: number, cy: number, r: number, de: number, a: number, pas = 24) {
  return Array.from({ length: pas + 1 }, (_, i) => {
    const t = de + ((a - de) * i) / pas
    return { x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r }
  })
}

const TOUR = Math.PI * 2

/** Oeuf : enveloppe de deux disques inegaux, le petit en haut. */
const egg = normalize(
  profileFromPolygon(hullOfCircles(0, 0.24, 0.72, 0, -0.42, 0.46), 0, 0),
  1.04
)

/**
 * Poire : trois disques alignes, decroissants vers le haut.
 *
 * Une ENVELOPPE serait convexe et redonnerait un oeuf ; c'est l'union qui laisse
 * la taille se creuser, et c'est elle qui fait la poire.
 */
const pear = normalize(
  unionOfCirclesProfile([
    { x: 0, y: 0.34, r: 0.62 },
    { x: 0, y: -0.02, r: 0.46 },
    { x: 0, y: -0.42, r: 0.34 }
  ]),
  1.06
)

/**
 * Fuseau : superellipse d'exposant INFERIEUR a 2, donc a bouts pointus, etiree
 * en hauteur. n = 2 donnerait une ellipse, n > 2 un squircle.
 */
const spindle = normalize(superellipseProfile(1.5, 0.68, 1.02), 1.06)

/** Tonneau : trois disques empiles, donc des flancs bombes et des bouts plats. */
const barrel = normalize(
  unionOfCirclesProfile([
    { x: 0, y: -0.28, r: 0.6 },
    { x: 0, y: 0, r: 0.64 },
    { x: 0, y: 0.28, r: 0.6 }
  ]),
  1.04
)

/**
 * Dome : calotte ronde sur une base plate.
 *
 * Pas exprimable en r(theta) d'une seule piece — d'ou le passage par un polygone,
 * exactement le role de `profileFromPolygon`. Les deux coins bas sont adoucis par
 * un quart de tour, sans quoi ils accrochent l'oeil sur une silhouette qui est
 * ronde partout ailleurs.
 */
const RC_DOME = 0.18
const dome = normalize(
  profileFromPolygon(
    [
      ...arcPoints(0, -0.06, 0.98, Math.PI, TOUR),
      ...arcPoints(0.98 - RC_DOME, 0.5 - RC_DOME, RC_DOME, 0, Math.PI / 2, 8),
      ...arcPoints(-0.98 + RC_DOME, 0.5 - RC_DOME, RC_DOME, Math.PI / 2, Math.PI, 8)
    ],
    0,
    0
  ),
  1.04
)

/**
 * Haricot : quatre disques sur un arc ouvert vers le bas, donc un dos rond et un
 * ventre creuse.
 *
 * Les disques sont poses A LA MAIN et non sur un arc parametre : la premiere
 * version en calculait les centres, et les quatre se retrouvaient dans la moitie
 * HAUTE du cadre. Le profil, lu depuis l'origine, sortait donc court en haut et
 * l'oeil exterieur de `wide` passait au travers de 4,1 unites. Une forme lue en
 * r(theta) doit etre centree sur son origine, sinon elle est fausse a moitie.
 */
const bean = normalize(
  unionOfCirclesProfile([
    { x: -0.44, y: 0.14, r: 0.5 },
    { x: -0.15, y: -0.1, r: 0.56 },
    { x: 0.15, y: -0.1, r: 0.56 },
    { x: 0.44, y: 0.14, r: 0.5 }
  ]),
  1.05
)

/** Trefle : trois lobes a 120 degres, plus un coeur qui les relie. */
const clover = normalize(
  unionOfCirclesProfile([
    { x: 0, y: 0, r: 0.52 },
    ...[0, 1, 2].map((i) => {
      const a = -Math.PI / 2 + (i / 3) * TOUR
      return { x: Math.cos(a) * 0.46, y: Math.sin(a) * 0.46, r: 0.44 }
    })
  ]),
  1.04
)

/** Fleur : six lobes PEU marques — creuses davantage, ils avalent les yeux. */
const flower = normalize(
  unionOfCirclesProfile([
    { x: 0, y: 0, r: 0.68 },
    ...Array.from({ length: 6 }, (_, i) => {
      const a = -Math.PI / 2 + (i / 6) * TOUR
      return { x: Math.cos(a) * 0.42, y: Math.sin(a) * 0.42, r: 0.36 }
    })
  ]),
  1.03
)

/**
 * Gemme : octogone a chanfreins COURTS. C'est le meme constructeur que
 * l'hexagone, avec un rayon de coin cinq fois plus petit — ce qui separe une
 * pierre taillee d'un galet, c'est la nettete de l'arete, pas le nombre de cotes.
 * Tournee d'un demi-pas pour poser une facette a plat en haut.
 */
const gem = regularPolygonProfile(8, 1.06, 0.07, -90 + 360 / 16)

/** Losange : carre sur la pointe, coins juste adoucis. */
const rhombus = regularPolygonProfile(4, 1.12, 0.15, -90)

export const SHAPES: BotShape[] = [
  { id: 'cercle', radii: new Array(PROFILE_SAMPLES).fill(1) },
  { id: 'galet', radii: pebble },
  // 1.15 et pas 1.02 : sur une superellipse le rayon maximal est la diagonale,
  // donc normaliser dessus donne une forme qui parait plus petite que le cercle.
  { id: 'squircle', radii: normalize(superellipseProfile(4.2), 1.15) },
  { id: 'capsule', radii: capsule },
  // -90deg : un sommet vers le haut de l'ecran (y est oriente vers le bas)
  { id: 'triangle', radii: regularPolygonProfile(3, 1.12, 0.34, -90) },
  // 0deg : sommets a gauche et a droite, donc aretes du haut et du bas plates
  { id: 'hexagone', radii: regularPolygonProfile(6, 1.04, 0.26, 0) },
  { id: 'nuage', radii: cloud },
  { id: 'goutte', radii: droplet },
  { id: 'oeuf', radii: egg },
  { id: 'poire', radii: pear },
  { id: 'fuseau', radii: spindle },
  { id: 'tonneau', radii: barrel },
  { id: 'dome', radii: dome },
  { id: 'haricot', radii: bean },
  { id: 'trefle', radii: clover },
  { id: 'fleur', radii: flower },
  { id: 'gemme', radii: gem },
  { id: 'losange', radii: rhombus }
]

// Map indexee par `string` et non par `ShapeId` : les appelants interrogent avec
// une valeur relue du localStorage ou d'une prop, donc non validee.
export const SHAPE_BY_ID = new Map<string, BotShape>(SHAPES.map((s) => [s.id, s]))
export const DEFAULT_SHAPE = 'cercle'

export type ColorId =
  | 'encre'
  | 'creme'
  | 'brun'
  | 'rouge'
  | 'orange'
  | 'ambre'
  | 'vert'
  | 'turquoise'
  | 'bleu'
  | 'violet'
  | 'rose'
  | 'gris'

export interface BotColor {
  id: ColorId
  hex: string
}

/** Palette du personnalisateur d'origine. */
export const COLORS: BotColor[] = [
  { id: 'encre', hex: '#0a0a0c' },
  { id: 'brun', hex: '#8b5e3c' },
  { id: 'rouge', hex: '#e8483f' },
  { id: 'orange', hex: '#f08a24' },
  { id: 'ambre', hex: '#f0b429' },
  { id: 'vert', hex: '#3ecf8e' },
  { id: 'turquoise', hex: '#2fbfa0' },
  { id: 'bleu', hex: '#3b93f0' },
  { id: 'violet', hex: '#8b5cf6' },
  { id: 'rose', hex: '#e152b0' },
  { id: 'gris', hex: '#a3a3a3' },
  { id: 'creme', hex: '#f1efe9' }
]

export const COLOR_BY_ID = new Map<string, BotColor>(COLORS.map((c) => [c.id, c]))
export const DEFAULT_COLOR = 'encre'

/** Melange deux couleurs hex. Sert a la brume de profondeur des particules. */
export function mixHex(from: string, to: string, t: number): string {
  const parse = (h: string) => {
    const v = parseInt(h.slice(1), 16)
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
  }
  const a = parse(from)
  const b = parse(to)
  const c = a.map((x, i) => Math.round(x + (b[i]! - x) * t))
  return `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`
}
