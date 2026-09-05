import { clamp, createRng, loopNoise } from './math'

/**
 * Les yeux sont peints sur une sphere, pas poses a plat.
 *
 * Mesure sur la video : l'oeil le plus proche du bord fait 0.69 fois la largeur
 * de l'autre, et son aire 0.663 fois — exactement le facteur de profondeur
 * (z = 0.669) d'un point de sphere a cette distance du centre. On modelise donc
 * une vraie orientation de tete : chaque oeil recupere le repere tangent de la
 * sphere, projete en orthographique. La compression et l'inclinaison en
 * decoulent toutes seules, c'est ce qui donne le volume.
 *
 * Les constantes ci-dessous ne sont pas choisies a la main : elles sortent d'un
 * ajustement du modele sur les positions et tailles relevees image par image
 * (erreur residuelle ~1 px sur un rayon de 190 px).
 */

type Vec3 = [number, number, number]

/**
 * Demi-ecart des yeux sur la sphere, en degres (separation totale 38deg).
 *
 * CHOISI, comme `EYE_W` / `EYE_H`. La video donnait 15,46, soit 31 degres : des
 * yeux serres, ce qui convient a deux fentes mais tasse deux cercles. Les seize
 * expressions ecartent deja de 14 a 20,5 degres, donc 19 tombe dans leur
 * enveloppe au lieu d'en etre le plancher.
 */
export const EYE_SPLIT = 19
/**
 * Taille de l'oeil au repos, en unites de rayon de boule.
 *
 * CHOISIE, pas mesuree — et c'est la difference qui compte. La video donnait
 * 0,186 x 0,412, une fente verticale de rapport 1:2,2 : c'est l'anatomie du bot
 * de reference, pas la notre, et elle ne laissait rien voir a l'interieur de
 * l'oeil. Un oeil ROND porte un iris ; une fente ne porte qu'elle-meme.
 *
 * Rond au sens strict (w = h) : `capsulePath` rend alors un cercle exact, son
 * rayon de coin valant la demi-largeur. Les seize expressions gardent leurs
 * propres proportions, c'est le REPOS qui change ici — et avec lui le defaut de
 * tous les etats qui ne redefinissent pas leurs yeux.
 */
export const EYE_W = 0.3
export const EYE_H = 0.3

/**
 * Orientation de tete au repos. CHOISIE — la video donnait 28,49 / 28,62 / -13.
 *
 * Le lacet tombe de 28 a 14 degres, et la raison est l'iris. Sur une fente sans
 * interieur, c'est la TETE qui doit porter le regard : d'ou une pose tres tournee,
 * qui est justement ce qui rendait la reference reconnaissable. Un oeil qui a une
 * pupille regarde tout seul, donc la tete n'a plus a le faire a sa place.
 *
 * Elle ne va pas jusqu'a zero, et ce n'est pas une demi-mesure. Le modele de
 * sphere ne se voit QUE de trois quarts : c'est le lacet qui comprime l'oeil
 * exterieur — 0,64 contre 0,87 de large — et cette compression est tout ce qui
 * fait lire un volume plutot qu'un disque. De face, les deux yeux deviennent
 * identiques et le meilleur de ce qui est herite ici ne se voit plus.
 */
export const REST_GAZE: HeadGaze = { yaw: 14, pitch: 14, roll: -5 }

export interface EyePose {
  x: number
  y: number
  /** matrice tangente 2x2 : [a b c d] au sens SVG matrix(a,b,c,d,e,f) */
  a: number
  b: number
  c: number
  d: number
  /** composante z de la normale : > 0 = face visible */
  depth: number
}

export interface HeadGaze {
  /** lacet, degres, positif = regarde a droite */
  yaw: number
  /** tangage, degres, positif = regarde en haut */
  pitch: number
  /** roulis, degres, inclinaison de la tete */
  roll: number
}

const deg = (d: number) => (d * Math.PI) / 180

/** Fait tourner deux vecteurs d'un repere orthonorme dans leur plan commun. */
function spin(u: Vec3, v: Vec3, angle: number): [Vec3, Vec3] {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [
    [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s],
    [v[0] * c - u[0] * s, v[1] * c - u[1] * s, v[2] * c - u[2] * s]
  ]
}

/**
 * Repere de la tete puis des deux yeux.
 * Repere ecran : x a droite, y vers le bas, z vers le spectateur.
 * L'indice 0 est l'oeil interieur, l'indice 1 l'oeil exterieur.
 */
export function eyePoses(gaze: HeadGaze, scale: number, split = EYE_SPLIT): [EyePose, EyePose] {
  let f: Vec3 = [0, 0, 1]
  let right: Vec3 = [1, 0, 0]
  let down: Vec3 = [0, 1, 0]

  // lacet : forward bascule vers right
  ;[f, right] = spin(f, right, deg(gaze.yaw))
  // tangage : forward bascule vers le haut (donc a l'oppose de down)
  ;[down, f] = spin(down, f, deg(gaze.pitch))
  // roulis : la tete penche dans son propre plan
  ;[right, down] = spin(right, down, deg(gaze.roll))

  const build = (side: number): EyePose => {
    const [ef, er] = spin(f, right, deg(split * side))
    return {
      x: ef[0] * scale,
      y: ef[1] * scale,
      a: er[0],
      b: er[1],
      c: down[0],
      d: down[1],
      depth: ef[2]
    }
  }

  return [build(-1), build(1)]
}

/**
 * Un trait du visage pose ailleurs que les yeux, sur la MEME sphere.
 *
 * `eyePoses` fait tourner l'avant vers la droite d'un demi-ecart ; ici on le
 * fait descendre vers le bas. Meme construction, donc meme repere tangent : la
 * bouche se comprime avec la profondeur, penche avec le roulis et disparait
 * derriere la boule exactement comme un oeil. C'est ce qui la fait appartenir au
 * meme visage plutot que d'etre un dessin pose par-dessus.
 *
 * `descente` est en degres depuis l'avant, positif vers le bas.
 */
export function featurePose(gaze: HeadGaze, scale: number, descente: number): EyePose {
  let f: Vec3 = [0, 0, 1]
  let right: Vec3 = [1, 0, 0]
  let down: Vec3 = [0, 1, 0]
  ;[f, right] = spin(f, right, deg(gaze.yaw))
  ;[down, f] = spin(down, f, deg(gaze.pitch))
  ;[right, down] = spin(right, down, deg(gaze.roll))
  // l'avant bascule vers le bas ; `right` ne bouge pas dans ce plan
  const [ff, dd] = spin(f, down, deg(descente))
  return {
    x: ff[0] * scale,
    y: ff[1] * scale,
    a: right[0],
    b: right[1],
    c: dd[0],
    d: dd[1],
    depth: ff[2]
  }
}

/**
 * Vie au repos : derive lente du regard, saccades, clignements.
 *
 * Fonction pure du temps (aucun etat interne), donc pause, reprise et saut a
 * une date arbitraire donnent toujours la meme image. Les valeurs sont des
 * ECARTS a ajouter a la pose de l'etat courant.
 */
export interface Liveliness {
  dYaw: number
  dPitch: number
  dRoll: number
  /** 1 = oeil ouvert, 0 = ferme (ecrasement vertical en repere ecran) */
  lid: number
  driftX: number
  driftY: number
  breath: number
}

const BLINK_RNG = createRng(0x5eed)
/** Calendrier de clignements pre-tire : deterministe et sans etat. */
const BLINKS: number[] = (() => {
  const out: number[] = []
  let t = 1.4
  while (t < 900) {
    out.push(t)
    // 1.9 a 4.6 s entre deux clignements, plus un double clignement parfois
    t += 1.9 + BLINK_RNG() * 2.7
    if (BLINK_RNG() < 0.18) {
      out.push(t)
      t += 0.24
    }
  }
  return out
})()

/** Mesure : 1 a 2 frames a 10 fps. */
const BLINK_DUR = 0.18

function blinkLid(t: number): number {
  for (let i = 0; i < BLINKS.length; i++) {
    const start = BLINKS[i]!
    if (t < start) break
    const k = (t - start) / BLINK_DUR
    if (k >= 0 && k <= 1) {
      // fermeture rapide, reouverture un peu plus lente
      return k < 0.45 ? 1 - k / 0.45 : (k - 0.45) / 0.55
    }
  }
  return 1
}

export interface LivelinessOptions {
  wander?: number
  blink?: boolean
  float?: boolean
}

export function liveliness(t: number, opt: LivelinessOptions = {}): Liveliness {
  const { wander = 1, blink = true, float = true } = opt

  // Periodes premieres entre elles : la derive ne se repete jamais a l'oeil.
  return {
    dYaw: (loopNoise(t, 11.3, 0.4) * 5.5 + loopNoise(t, 3.7, 2.1) * 1.6) * wander,
    dPitch: (loopNoise(t, 9.1, 1.3) * 4.2 + loopNoise(t, 4.3, 0.7) * 1.3) * wander,
    dRoll: loopNoise(t, 13.7, 3.2) * 2.2 * wander,
    lid: blink ? blinkLid(t) : 1,
    // Au repos la video est quasiment immobile (centre stable a +-0.003, rayon
    // constant) : toute la vie passe par le regard et les clignements. On garde
    // juste de quoi ne pas figer completement l'image.
    driftX: float ? loopNoise(t, 7.9, 1.9) * 0.006 : 0,
    driftY: float ? loopNoise(t, 5.3, 0.3) * 0.007 : 0,
    // La largeur est constante, seule la hauteur respire tres legerement.
    breath: float ? 1 + Math.sin((t / 3.4) * Math.PI * 2) * 0.005 : 1
  }
}

/**
 * Le clignement est un ecrasement VERTICAL en repere ecran autour du centre de
 * l'oeil (mesure : la largeur de bbox est conservee, la hauteur tombe a ~0.35),
 * pas un retrecissement le long de l'axe incline de la gelule. On le compose
 * donc apres la matrice tangente, en n'affectant que les sorties en y.
 */
export function blinkScale(lid: number): number {
  return 0.06 + 0.94 * clamp(lid)
}
