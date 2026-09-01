/**
 * Carte sociale (`public/og.png`), 1200 x 630.
 *
 * Ecrit `public/og.svg`, la SOURCE. Le PNG s'en rasterise :
 *
 *   rsvg-convert -w 1200 -h 630 public/og.svg -o public/og.png
 *
 * Meme principe que `public/favicon.svg` : la boule n'est pas une approximation,
 * c'est ce que `engine.sample(1)` rend pour `idle`. Le fichier existe parce que
 * la carte porte du TEXTE, donc le nom du produit — au renommage suivant, elle
 * doit suivre, et sans source elle ne suit pas. Elle ne l'avait pas fait au
 * premier : la carte annoncait encore « BLOUB » longtemps apres.
 */
import { writeFileSync } from 'node:fs'
import { BotEngine } from '@/bot/engine'
import { DEMI_VIEWBOX, RAYON } from '@/bot/repere'

const L = 1200
const H = 630
const PAPIER = '#f9f9f9'
const ENCRE = '#0a0a0c'
const NUIT = '#17203a'
const GRIS = '#6b7280'
const NOM = 'CLIPLAB'
const ACCROCHE = 'Studio de personnages SVG'
const POLICE = "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

const f = new BotEngine(RAYON, 'idle', null, null).sample(1)

/* La boule occupe la moitie gauche, centree sur 360 : meme cadrage que la carte
   d'origine, dont seul le texte change. */
const k = 430 / (DEMI_VIEWBOX * 2)
const yeux = f.eyes
  .map((e) => `<path d="${e.d}" transform="${e.matrix}" opacity="${e.alpha}" fill="#000"/>`)
  .join('')

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}" viewBox="0 0 ${L} ${H}">` +
  `<rect width="${L}" height="${H}" fill="${PAPIER}"/>` +
  `<defs><mask id="m" maskUnits="userSpaceOnUse" x="${-DEMI_VIEWBOX}" y="${-DEMI_VIEWBOX}"` +
  ` width="${DEMI_VIEWBOX * 2}" height="${DEMI_VIEWBOX * 2}">` +
  `<path d="${f.bodyPath}" fill="#fff"/>${yeux}</mask></defs>` +
  `<g transform="translate(360 315) scale(${k})">` +
  `<path d="${f.bodyPath}" fill="${PAPIER}"/>` +
  `<g mask="url(#m)"><rect x="${-DEMI_VIEWBOX}" y="${-DEMI_VIEWBOX}" width="${DEMI_VIEWBOX * 2}"` +
  ` height="${DEMI_VIEWBOX * 2}" fill="${ENCRE}"/></g></g>` +
  `<text x="660" y="300" font-family="${POLICE}" font-size="86" font-weight="800"` +
  ` letter-spacing="-2" fill="${NUIT}">${NOM}</text>` +
  `<text x="660" y="352" font-family="${POLICE}" font-size="30" fill="${GRIS}">${ACCROCHE}</text>` +
  `</svg>`

writeFileSync('public/og.svg', svg)
console.log(`public/og.svg — ${L}x${H}, « ${NOM} »`)
console.log('rasteriser : rsvg-convert -w 1200 -h 630 public/og.svg -o public/og.png')
