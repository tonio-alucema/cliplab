import { PROFILE_SAMPLES } from './profiles'
import { hullOfCircles, profileFromPolygon } from './shape'

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
export type ShapeId = 'dome' | 'capsule'

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

/**
 * Deux formes, et c'est un choix de casting plutot qu'une reduction.
 *
 * Dix-huit formes faisaient un selecteur, pas un personnage : une identite tient
 * a ce qu'on ecarte. Les deux gardees ont toutes deux un HAUT et un BAS nets,
 * ce qui donne au corps une orientation et donc un visage — c'est ce qui manquait
 * au cercle, au galet et au squircle, qui n'ont pas de sens de lecture.
 *
 * Le CERCLE reste malgre tout, hors catalogue : c'est le corps des etats releves
 * sur la video, la cible du fondu, et la boule de l'arrivee (qui doit etre ronde
 * le temps du tour, sinon les yeux sautent — cf. `docs/intro.md`). Il n'est
 * simplement plus proposable.
 */

/** Points d'un arc de cercle, en coordonnees ecran (y vers le bas). */
function arcPoints(cx: number, cy: number, r: number, de: number, a: number, pas = 24) {
  return Array.from({ length: pas + 1 }, (_, i) => {
    const t = de + ((a - de) * i) / pas
    return { x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r }
  })
}

const TOUR = Math.PI * 2

/**
 * Capsule DEBOUT : enveloppe de deux disques empiles.
 *
 * Debout et non couchee, contrairement a la version d'origine — une capsule
 * couchee n'a pas de haut ni de bas, or c'est l'axe vertical qui donne au corps
 * une orientation, donc un visage. Les deux disques sont ecartes de 0,42 et
 * larges de 0,58 : le stade fait ainsi deux fois plus haut que large, ce qui le
 * garde franchement debout sans l'etirer au point que les yeux flottent.
 */
const capsule = normalize(
  profileFromPolygon(hullOfCircles(0, -0.42, 0.58, 0, 0.42, 0.58), 0, 0),
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
 * Le cercle, HORS catalogue mais toujours la.
 *
 * Ce n'est plus une forme proposable, c'est le corps NEUTRE : celui des etats
 * releves sur la video, la cible des fondus, et la boule de l'arrivee, qui doit
 * etre ronde le temps du tour sous peine de faire sauter les yeux. Passer `null`
 * au moteur revient exactement a passer ceci — et un test le verifie, parce que
 * c'est ce qui garantit que le catalogue ne deforme pas la reference.
 */
export const CERCLE: number[] = new Array(PROFILE_SAMPLES).fill(1)

export const SHAPES: BotShape[] = [
  { id: 'dome', radii: dome },
  { id: 'capsule', radii: capsule }
]

// Map indexee par `string` et non par `ShapeId` : les appelants interrogent avec
// une valeur relue du localStorage ou d'une prop, donc non validee.
export const SHAPE_BY_ID = new Map<string, BotShape>(SHAPES.map((s) => [s.id, s]))
export const DEFAULT_SHAPE = 'dome'

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
