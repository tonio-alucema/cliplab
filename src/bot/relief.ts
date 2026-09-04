/**
 * Relief : le corps lu comme un volume, sans passer a la 3D.
 *
 * Le corps reste un profil r(theta). Ce qui donne le volume, c'est que
 * l'eclairement suive la MEME orientation de tete que les yeux — un repere
 * partagé est ce qui fait que le corps et le visage racontent la meme chose. Un
 * degrade oriente au hasard donnerait une tache, pas une forme.
 *
 * Le moteur n'emet ici que de la GEOMETRIE et des intensites : il ignore la
 * couleur du corps, que l'utilisateur choisit. Le melange se fait au rendu, comme
 * pour la brume de profondeur des particules (`DotRender.depth`).
 *
 * Bakeable par construction : un degrade n'est pas un chemin, donc il n'a pas de
 * signature de commandes qui puisse changer d'une image a l'autre. Ses centres,
 * son rayon et ses teintes sont des nombres, et des nombres s'interpolent. C'est
 * le test que la phase 1 a rendu concret, et ce cue le passe sans effort — ce qui
 * n'etait pas gagne : les anneaux d'orbite, eux, le ratent.
 */
import { REST_GAZE, eyePoses, type HeadGaze } from './face'
import { clamp } from './math'

/**
 * Ou se pose le centre clair, en fraction du rayon de boule.
 *
 * 0,42 : assez pour que le degrade soit franchement decentré — c'est le decentrage
 * qui fait le volume, un degrade centre ne fait qu'un halo — sans sortir de la
 * silhouette, ce qui couperait la bande net au bord.
 */
const DISTANCE = 0.42

/** Etendue du degrade, en rayons de boule. Au-dela, la derniere teinte tient. */
const ETENDUE = 1.25

/** Fraction de blanc au centre, et de noir au bord oppose. */
export const RELIEF_CLAIR = 0.16
export const RELIEF_SOMBRE = 0.28

/**
 * Les deux rendus proposes. C'est un choix de SHADER, pas de modele : le volume
 * pseudo-3D vit dans la geometrie — les yeux sur une sphere, leur compression de
 * profondeur, l'orientation de tete que le corps et le visage partagent — et rien
 * de tout cela ne bouge quand on passe a plat. Seul le degrade s'en va.
 *
 * Un catalogue et pas un booleen, pour la meme raison que les styles d'oeil : les
 * identifiants sont enumeres, donc la couche i18n verifie a la compilation que
 * chacun a son libelle dans les trois langues. Et une troisieme intensite se
 * range ici sans toucher a une seule signature.
 */
export type ReliefId = 'volume' | 'plat'

export interface ReliefMode {
  id: ReliefId
  /** multiplie `RELIEF_CLAIR` et `RELIEF_SOMBRE` ; 0 = aplat */
  force: number
}

export const RELIEFS: ReliefMode[] = [
  { id: 'volume', force: 1 },
  { id: 'plat', force: 0 }
]

export const RELIEF_BY_ID = new Map<string, ReliefMode>(RELIEFS.map((r) => [r.id, r]))
export const DEFAULT_RELIEF = 'volume'

/* --------------------------------------------------------------- raccourci */

/**
 * Raccourci : le corps s'ecrase verticalement quand la tete penche.
 *
 * Nos deux formes sont des solides de REVOLUTION autour de l'axe vertical — un
 * dome et une capsule debout le sont l'un comme l'autre. Consequence directe :
 * le LACET ne change pas leur silhouette, exactement comme il ne change pas
 * celle d'une sphere, et c'est le degrade qui porte le tournement. Le TANGAGE,
 * lui, la raccourcit pour de bon. Ecraser aussi en largeur ferait donc une boule
 * pressee, pas une tete qui tourne.
 *
 * Mesure relative au REPOS et non au tangage absolu : les formes sont dessinees
 * pour etre vues au repos, donc c'est cette silhouette-la qu'on veut intacte, et
 * c'est l'ECART qui doit se voir.
 *
 * ⚠️ Le raccourci est de la GEOMETRIE, pas du shader : il ne suit donc pas le
 * reglage `relief`, et un corps a plat penche toujours. C'est la meme frontiere
 * que garde `relief.test.ts` — l'aplat retire le degrade et rien d'autre.
 */

/**
 * Plancher du raccourci, et c'est une limite MESUREE du modele.
 *
 * Les yeux vivent sur une sphere, le corps est un profil 2D : raccourcir l'un
 * sans l'autre les fait diverger. Mesure par balayage du tangage, sur les deux
 * formes et vingt instants — marge de l'oeil au bord de la silhouette :
 *
 *   ecart de tangage    0     10     20     30     40
 *   ecrasement       1,000  0,985  0,940  0,866  0,766
 *   marge (unites)    22,5   18,0    9,7    0,5 SORTI
 *
 * L'oeil sort donc des 0,94. Le raccourci sature juste avant, ce qui le laisse
 * entier sur tout ce qu'une tete fait vraiment et l'empeche d'ouvrir le visage
 * dans les poses extremes. Le rendre plus fort demanderait de raccourcir aussi
 * la sphere des yeux, ce qui est un autre modele, pas un reglage.
 */
const PLANCHER = 0.94

export function raccourci(gaze: HeadGaze, force = 1): number {
  const ecart = (gaze.pitch - REST_GAZE.pitch) * (Math.PI / 180)
  const brut = 1 - (1 - Math.cos(clamp(ecart, -Math.PI / 2, Math.PI / 2))) * force
  return Math.max(PLANCHER, brut)
}

export interface BodyShade {
  /** centre du degrade, en unites de viewBox */
  cx: number
  cy: number
  r: number
  /** part de blanc a melanger a la couleur du corps, au centre */
  lift: number
  /** part de noir a melanger, au bord oppose */
  drop: number
}

/**
 * Le degrade du corps pour cette orientation de tete.
 *
 * La direction vient du vecteur AVANT de la tete, obtenu en demandant les yeux
 * avec un ecart nul : les deux se confondent alors sur l'avant. C'est le meme
 * calcul que celui des yeux, donc les deux ne peuvent pas se contredire — ce qui
 * est precisement ce que la phase 3 demande.
 */
export function shadeFor(gaze: HeadGaze, scale: number, force = 1): BodyShade | null {
  if (force <= 0) return null
  const [avant] = eyePoses(gaze, 1, 0)
  return {
    cx: avant.x * DISTANCE * scale,
    cy: avant.y * DISTANCE * scale,
    r: ETENDUE * scale,
    lift: RELIEF_CLAIR * force,
    drop: RELIEF_SOMBRE * force
  }
}
