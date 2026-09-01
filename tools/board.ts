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
import { SHAPES } from '@/bot/skins'
import { EYE_STYLES, type EyeStyle } from '@/bot/eyes'
import { EXPRESSION_BY_ID, type BotExpression } from '@/bot/expressions'

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
  expr: BotExpression | null
) {
  const f = new BotEngine(RAYON, 'idle', radii, expr, style).sample(1)
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
  return (
    `<g transform="translate(${x} ${y})">` +
    `<defs>` +
    `<mask id="m${id}" maskUnits="userSpaceOnUse" x="${-VB}" y="${-VB}" width="${VB * 2}" height="${VB * 2}">` +
    `<path d="${f.bodyPath}" fill="#fff"/>${yeux}</mask>` +
    `<clipPath id="k${id}"><path d="${f.bodyPath}"/></clipPath>` +
    `</defs>` +
    `<g transform="translate(${CASE / 2} ${CASE / 2}) scale(${k})">` +
    `<path d="${f.bodyPath}" fill="${PAPIER}"/>` +
    (couches ? `<g clip-path="url(#k${id})">${couches}</g>` : '') +
    `<g mask="url(#m${id})"><rect x="${-VB}" y="${-VB}" width="${VB * 2}" height="${VB * 2}" fill="${ENCRE}"/></g>` +
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
