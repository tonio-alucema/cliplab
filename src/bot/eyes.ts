/**
 * Styles d'oeil : la sclere reste un TROU dans le masque, les couches internes
 * sont peintes DERRIERE le corps et le trou les revele.
 *
 * C'est ce qui rend la phase 2 bon marche : aucun code de rognage n'est ajoute.
 * Une couche deborde-t-elle de la sclere ? Le corps la recouvre. La paupiere se
 * ferme-t-elle ? C'est le TROU qui s'ecrase — les couches, elles, ne bougent pas
 * et se font rogner par lui, ce qui est exactement ce que fait une vraie
 * paupiere. Un iris qu'on ecraserait avec la sclere aurait l'air en caoutchouc.
 *
 * Deux reperes a ne pas confondre :
 *
 * - la sclere est dessinee par `capsulePath(w, h)`, donc centree sur l'origine et
 *   large de `w`, haute de `h`, EN UNITES DE VIEWBOX ;
 * - une couche donne son rayon en fraction du PLUS GRAND DISQUE INSCRIT dans la
 *   sclere, soit `min(w, h) / 2`. Pas de la demi-largeur : plusieurs expressions
 *   ont l'oeil plus LARGE que haut — « hilare » descend a 0,089 de haut pour
 *   0,447 de large — et un rayon pris sur la largeur y sortait du haut et du bas
 *   d'un facteur cinq. Le disque inscrit est la seule borne vraie des deux cotes.
 */

/** Amplitude de regard, en degres, qui amene une couche au bout de sa course. */
export const GAZE_RANGE = 34

export interface EyeLayer {
  /** rayon, en fraction du rayon du disque inscrit dans la sclere */
  r: number
  fill: string
  /**
   * Part de la course suivie. 1 = suit le regard, 0 = fixe au centre,
   * negatif = part a l'oppose — c'est ce qui fait lire un REFLET plutot qu'une
   * tache : une lumiere ne suit pas l'oeil, elle vient d'ailleurs.
   */
  follow: number
}

export interface EyeStyle {
  id: EyeStyleId
  /** de l'exterieur vers l'interieur : sclere d'abord, reflet en dernier */
  layers: EyeLayer[]
}

/**
 * Les identifiants sont enumeres et pas deduits du tableau, meme raison que dans
 * `skins.ts` : c'est ce qui permettra a la couche i18n de verifier a la
 * compilation que chaque style a sa traduction dans les trois langues.
 */
export type EyeStyleId = 'fente' | 'optique' | 'gemme' | 'vinyle'

/* Teintes des couches. Ce sont des CHOIX, pas des mesures — rien de tout ceci
   n'existe sur la video de reference, dont l'oeil est un aplat unique. */
const IRIS = '#3b93f0'
const PUPILLE = '#0a0a0c'
const REFLET = '#ffffff'

export const EYE_STYLES: EyeStyle[] = [
  /**
   * La fente : aucune couche, donc le trou montre le fond et rien d'autre.
   * C'est l'oeil d'origine, garde comme point de comparaison et comme defaut —
   * tant qu'un style n'est pas choisi, rien ne doit changer a l'ecran.
   */
  { id: 'fente', layers: [] },

  /**
   * Optique : iris, pupille, reflet. Le reflet part a l'oppose du regard et
   * pese 0,3 — assez pour attraper la lumiere, pas assez pour devenir un oeil
   * a lui tout seul.
   */
  {
    id: 'optique',
    layers: [
      { r: 0.86, fill: IRIS, follow: 0.55 },
      { r: 0.44, fill: PUPILLE, follow: 0.72 },
      { r: 0.22, fill: REFLET, follow: -0.3 }
    ]
  },

  /**
   * Gemme : pupille etroite et tres mobile sur un iris presque immobile. La
   * lecture « taillee » vient du contraste de course entre les deux, pas d'une
   * couleur.
   */
  {
    id: 'gemme',
    layers: [
      { r: 0.94, fill: '#2fbfa0', follow: 0.2 },
      { r: 0.3, fill: PUPILLE, follow: 0.95 },
      { r: 0.16, fill: REFLET, follow: -0.45 }
    ]
  },

  /**
   * Vinyle : jouet souple. Pupille large, reflet surdimensionne et decale, pas
   * d'iris — deux aplats suffisent, c'est ce qui fait le jouet.
   */
  {
    id: 'vinyle',
    layers: [
      { r: 0.92, fill: PUPILLE, follow: 0.5 },
      { r: 0.4, fill: REFLET, follow: -0.55 }
    ]
  }
]

export const EYE_STYLE_BY_ID = new Map<string, EyeStyle>(EYE_STYLES.map((s) => [s.id, s]))
export const DEFAULT_EYE_STYLE = 'fente'
