/**
 * Planches de contact : les formes, et les styles d'oeil.
 *
 * Rendues en PILOTANT LE MOTEUR, pas en capturant le navigateur — le volet le
 * suspend des qu'il est masque, donc une animation n'y est pas capturable. Meme
 * methode que `docs/demo.gif` et `docs/states.png`.
 *
 * `sample(1)` et non `sample(0)` : a l'instant zero le moteur sort la pose
 * nominale, avant que la respiration et la derive du regard aient commence. Une
 * seconde plus tard la boule est dans son etat COURANT, qui est ce qu'on juge.
 */
import { writeFileSync } from 'node:fs'
import { BotEngine } from '@/bot/engine'
import { DEMI_VIEWBOX, RAYON } from '@/bot/repere'
import { SHAPES, mixHex } from '@/bot/skins'
import { EYE_STYLES, EYE_STYLE_BY_ID, type EyeStyle } from '@/bot/eyes'
import { EXPRESSION_BY_ID, type BotExpression } from '@/bot/expressions'
import { EYE_H, EYE_SPLIT, EYE_W, REST_GAZE } from '@/bot/face'

const ENCRE = '#0a0a0c'
const PAPIER = '#f9f9f9'
const CRAYON = '#6b7280'
const VB = DEMI_VIEWBOX
const CASE = 200
const LEGENDE = 26
const MARGE = 16

let uid = 0

/**
 * Une case. Reproduit l'ordre des couches de `BloubBot.vue` : fond a la forme du
 * corps, couches d'oeil rognees a la silhouette, puis le corps masque par-dessus.
 * C'est le corps qui rogne les couches — il n'y a pas d'autre rognage.
 */
function cellule(
  x: number,
  y: number,
  legende: string,
  radii: number[] | null,
  style: EyeStyle | null,
  expr: BotExpression | null,
  relief = 0
) {
  const f = new BotEngine(RAYON, 'idle', radii, expr, style, relief).sample(1)
  const id = `c${uid++}`
  const k = (CASE * 0.86) / (VB * 2)
  const yeux = f.eyes
    .map((e) => `<path d="${e.d}" transform="${e.matrix}" opacity="${e.alpha}" fill="#000"/>`)
    .join('')
  const couches = f.eyes
    .map(
      (e) =>
        `<g transform="${e.base}">` +
        e.layers
          .map(
            (c) =>
              `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="${c.fill}" opacity="${e.alpha}"/>`
          )
          .join('') +
        '</g>'
    )
    .join('')
  /* Le degrade se melange ICI, comme dans le composant : le moteur ne rend que
     des intensites, il ignore la couleur du corps. */
  const sh = f.shade
  const degrade = sh
    ? `<radialGradient id="g${id}" gradientUnits="userSpaceOnUse" cx="${sh.cx}" cy="${sh.cy}" r="${sh.r}">` +
      `<stop offset="0" stop-color="${mixHex(ENCRE, '#ffffff', sh.lift)}"/>` +
      `<stop offset="0.55" stop-color="${ENCRE}"/>` +
      `<stop offset="1" stop-color="${mixHex(ENCRE, '#000000', sh.drop)}"/></radialGradient>`
    : ''
  const remplissage = sh ? `url(#g${id})` : ENCRE
  return (
    `<g transform="translate(${x} ${y})">` +
    `<defs>${degrade}` +
    `<mask id="m${id}" maskUnits="userSpaceOnUse" x="${-VB}" y="${-VB}" width="${VB * 2}" height="${VB * 2}">` +
    `<path d="${f.bodyPath}" fill="#fff"/>${yeux}</mask>` +
    `<clipPath id="k${id}"><path d="${f.bodyPath}"/></clipPath>` +
    `</defs>` +
    `<g transform="translate(${CASE / 2} ${CASE / 2}) scale(${k})">` +
    `<path d="${f.bodyPath}" fill="${PAPIER}"/>` +
    (couches ? `<g clip-path="url(#k${id})">${couches}</g>` : '') +
    `<g mask="url(#m${id})"><rect x="${-VB}" y="${-VB}" width="${VB * 2}" height="${VB * 2}" fill="${remplissage}"/></g>` +
    `</g>` +
    `<text x="${CASE / 2}" y="${CASE + 14}" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif"` +
    ` font-size="13" fill="${CRAYON}">${legende}</text></g>`
  )
}

function planche(fichier: string, colonnes: number, cases: string[], l: number, h: number) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${l}" height="${h}" viewBox="0 0 ${l} ${h}">` +
    `<rect width="${l}" height="${h}" fill="${PAPIER}"/>${cases.join('')}</svg>`
  writeFileSync(fichier, svg)
  console.log(`${fichier} — ${cases.length} cases, ${l}x${h}`)
}

/* ------------------------------------------------------- planche des formes */

const neutre = EXPRESSION_BY_ID.get('neutre') ?? null
const COL_F = 6
const casesFormes = SHAPES.map((forme, i) =>
  cellule(
    MARGE + (i % COL_F) * CASE,
    MARGE + Math.floor(i / COL_F) * (CASE + LEGENDE),
    forme.id,
    forme.radii,
    null,
    neutre
  )
)
planche(
  'docs/shapes.svg',
  COL_F,
  casesFormes,
  MARGE * 2 + COL_F * CASE,
  MARGE * 2 + Math.ceil(SHAPES.length / COL_F) * (CASE + LEGENDE)
)

/* ------------------------------------------------------ planche du relief */

/**
 * Force du relief, de l'aplat au tres marque. C'est le reglage a choisir a
 * l'oeil : `RELIEF_CLAIR` et `RELIEF_SOMBRE` (`relief.ts`) sont multiplies par
 * cette force, donc doubler la force double les deux.
 */
const FORCES = [0, 0.35, 0.7, 1, 1.4, 2]
const COL_R = 6
const casesRelief = FORCES.map((force, i) =>
  cellule(
    MARGE + (i % COL_R) * CASE,
    MARGE + Math.floor(i / COL_R) * (CASE + LEGENDE),
    force === 0 ? 'aplat (0)' : force === 1 ? `${force} — RETENUE` : String(force),
    null,
    EYE_STYLE_BY_ID.get('iris') ?? null,
    neutre,
    force
  )
)
planche(
  'docs/relief.svg',
  COL_R,
  casesRelief,
  MARGE * 2 + COL_R * CASE,
  MARGE * 2 + Math.ceil(FORCES.length / COL_R) * (CASE + LEGENDE)
)

/* ----------------------------------------------- planche des poses de repos */

/**
 * Candidats pour `REST_GAZE` / `EYE_SPLIT`, la pose de repos.
 *
 * Gardee alors que le choix est fait : c'est la comparaison qui l'a tranche, et
 * la phase 4 refait le meme exercice sur les etats. La mesuree est en tete pour
 * qu'on voie de quoi on s'eloigne.
 */
const POSES: Array<{ nom: string; yaw: number; pitch: number; roll: number; split: number }> = [
  { nom: 'mesuree (video)', yaw: 28.49, pitch: 28.62, roll: -13, split: 15.46 },
  { nom: 'tournee douce', yaw: 16, pitch: 18, roll: -6, split: 17 },
  { nom: 'regard haut', yaw: 10, pitch: 22, roll: -4, split: 18 },
  { nom: 'de trois quarts', yaw: 20, pitch: 10, roll: -8, split: 16 },
  { nom: 'de face', yaw: 0, pitch: 18, roll: 0, split: 17 },
  { nom: 'RETENUE', yaw: REST_GAZE.yaw, pitch: REST_GAZE.pitch, roll: REST_GAZE.roll, split: EYE_SPLIT }
]

const COL_P = 3
const iris = EYE_STYLE_BY_ID.get('iris') ?? null
const casesPoses = POSES.map((c, i) =>
  cellule(
    MARGE + (i % COL_P) * CASE,
    MARGE + Math.floor(i / COL_P) * (CASE + LEGENDE),
    `${c.nom} · ${c.yaw}/${c.pitch}/${c.roll} · ${c.split}`,
    null,
    iris,
    {
      id: 'neutre',
      gaze: { yaw: c.yaw, pitch: c.pitch, roll: c.roll },
      split: c.split,
      eyes: [
        { w: EYE_W, h: EYE_H, tilt: 0, open: 1 },
        { w: EYE_W, h: EYE_H, tilt: 0, open: 1 }
      ]
    } as unknown as BotExpression
  )
)
planche(
  'docs/poses.svg',
  COL_P,
  casesPoses,
  MARGE * 2 + COL_P * CASE,
  MARGE * 2 + Math.ceil(POSES.length / COL_P) * (CASE + LEGENDE)
)

/* --------------------------------------------------- planche des yeux */

/**
 * Styles en LIGNES, expressions en colonnes : ce qu'on juge, c'est comment un
 * meme style tient d'une humeur a l'autre. Les expressions choisies sont celles
 * qui deforment le plus l'oeil — c'est la que les couches se voient.
 */
const HUMEURS = ['neutre', 'attentif', 'heureux', 'colere', 'surpris', 'somnolent']
const casesYeux: string[] = []
EYE_STYLES.forEach((style, l) => {
  HUMEURS.forEach((h, c) => {
    casesYeux.push(
      cellule(
        MARGE + c * CASE,
        MARGE + l * (CASE + LEGENDE),
        `${style.id} · ${h}`,
        null,
        style,
        EXPRESSION_BY_ID.get(h) ?? null
      )
    )
  })
})
planche(
  'docs/eyes.svg',
  HUMEURS.length,
  casesYeux,
  MARGE * 2 + HUMEURS.length * CASE,
  MARGE * 2 + EYE_STYLES.length * (CASE + LEGENDE)
)
