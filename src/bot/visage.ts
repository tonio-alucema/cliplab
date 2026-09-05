/**
 * Deux facons de rendre un visage, pour pouvoir les comparer.
 *
 * `classique` est ce qui existait : les yeux sont des TROUS perces dans le corps,
 * donc ils montrent le fond de la page, et un iris peint derriere se voit au
 * travers. Pas de bouche.
 *
 * `trait` est l'autre direction : les traits sont des MARQUES peintes sur le
 * corps, plus sombres que lui, et il y a une bouche. C'est une inversion et pas
 * un reglage — un trou montre ce qu'il y a derriere, une marque cache ce qu'il y
 * a dessous — d'ou un catalogue plutot qu'un booleen sur le style d'oeil.
 *
 * ⚠️ Une marque a besoin d'un corps COLORE pour se voir. Sur l'encre, qui est la
 * couleur par defaut, une marque sombre disparaitrait : le rendu prend donc le
 * contraste dans le sens qui reste lisible (cf. `BloubBot.vue`), ce qui est la
 * meme regle qu'une couleur de texte sur un fond quelconque.
 */
export type VisageId = 'classique' | 'trait'

export interface VisageStyle {
  id: VisageId
  /** true = traits peints sur le corps ; false = yeux perces dans le corps */
  marque: boolean
  /** true = le visage porte une bouche */
  bouche: boolean
  /**
   * true = l'oeil est un DISQUE de taille fixe, quelle que soit l'humeur.
   *
   * C'est le deplacement de charge de cette direction : sur `classique` l'humeur
   * est dans la forme des yeux — plisses, ecarquilles, penches en miroir — parce
   * qu'il n'y avait rien d'autre pour la porter. Des qu'une bouche existe, c'est
   * elle qui la porte, et des yeux qui changeraient AUSSI de forme diraient deux
   * fois la meme chose. Les seize dessins d'yeux ne sont pas perdus pour autant :
   * ils restent ce qu'est `classique`.
   *
   * `open` continue de s'appliquer — un disque ecrase reste une paupiere — donc
   * le clignement et les yeux mi-clos de `somnolent` tiennent toujours.
   */
  oeilRond: boolean
}

export const VISAGES: VisageStyle[] = [
  { id: 'classique', marque: false, bouche: false, oeilRond: false },
  { id: 'trait', marque: true, bouche: true, oeilRond: true }
]

export const VISAGE_BY_ID = new Map<string, VisageStyle>(VISAGES.map((v) => [v.id, v]))
export const DEFAULT_VISAGE = 'classique'

/** Ou la bouche descend sous l'avant du visage, en degres sur la sphere. */
export const BOUCHE_DESCENTE = 26
