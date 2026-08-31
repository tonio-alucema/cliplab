/**
 * Planche de contact des formes du personnalisateur — la revue d'art de la
 * phase 1, avant de figer un casting.
 *
 * Rendue en PILOTANT LE MOTEUR, pas en capturant le navigateur : le volet le
 * suspend des qu'il est masque, donc une animation n'y est pas capturable. Meme
 * methode que `docs/demo.gif` et `docs/states.png`.
 *
 * `sample(1)` et non `sample(0)` : a l'instant zero le moteur sort la pose
 * nominale, avant que la respiration et la derive du regard aient commence. Une
 * seconde plus tard, la boule est dans son etat COURANT, qui est ce qu'on juge.
 */
import { writeFileSync } from 'node:fs'
import { BotEngine } from '@/bot/engine'
import { DEMI_VIEWBOX, RAYON } from '@/bot/repere'
import { SHAPES } from '@/bot/skins'
import { EXPRESSION_BY_ID } from '@/bot/expressions'

const ENCRE = '#0a0a0c'
const PAPIER = '#f9f9f9'
const CRAYON = '#6b7280'
const VB = DEMI_VIEWBOX
const COLONNES = 6
const CASE = 200
const LEGENDE = 26
const MARGE = 16

const expression = EXPRESSION_BY_ID.get('neutre') ?? null
const lignes = Math.ceil(SHAPES.length / COLONNES)
const L = MARGE * 2 + COLONNES * CASE
const H = MARGE * 2 + lignes * (CASE + LEGENDE)

const cellules = SHAPES.map((forme, i) => {
  const eng = new BotEngine(RAYON, 'idle', forme.radii, expression)
  const f = eng.sample(1)
  const cx = MARGE + (i % COLONNES) * CASE
  const cy = MARGE + Math.floor(i / COLONNES) * (CASE + LEGENDE)
  const k = (CASE * 0.86) / (VB * 2)
  const yeux = f.eyes
    .map((e) => `<path d="${e.d}" transform="${e.matrix}" opacity="${e.alpha}" fill="#000"/>`)
    .join('')
  return (
    `<g transform="translate(${cx} ${cy})">` +
    `<mask id="m${i}" maskUnits="userSpaceOnUse" x="${-VB}" y="${-VB}" width="${VB * 2}" height="${VB * 2}"` +
    ` transform="translate(${CASE / 2} ${CASE / 2}) scale(${k})">` +
    `<path d="${f.bodyPath}" fill="#fff"/>${yeux}</mask>` +
    `<g transform="translate(${CASE / 2} ${CASE / 2}) scale(${k})">` +
    `<path d="${f.bodyPath}" fill="${PAPIER}"/>` +
    `<g mask="url(#m${i})"><rect x="${-VB}" y="${-VB}" width="${VB * 2}" height="${VB * 2}" fill="${ENCRE}"/></g>` +
    `</g>` +
    `<text x="${CASE / 2}" y="${CASE + 14}" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif"` +
    ` font-size="13" fill="${CRAYON}">${forme.id}</text></g>`
  )
}).join('')

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}" viewBox="0 0 ${L} ${H}">` +
  `<rect width="${L}" height="${H}" fill="${PAPIER}"/>${cellules}</svg>`

writeFileSync('docs/shapes.svg', svg)
console.log(`docs/shapes.svg — ${SHAPES.length} formes, ${L}x${H}`)
