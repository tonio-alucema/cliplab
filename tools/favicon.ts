/**
 * `public/favicon.svg`, ECRIT PAR LE MOTEUR.
 *
 * Il etait tenu a la main, et il s'est retrouve perime quatre fois de suite :
 * quand l'oeil est devenu rond (les chemins), quand l'iris est arrive (les
 * couches), quand la pose de repos a change (les matrices), quand le catalogue
 * s'est reduit a deux formes (le corps). A chaque fois le fichier avait encore
 * l'air juste, ce qui est le pire cas — les matrices, notamment, survivent a un
 * changement de TAILLE d'oeil et ne survivent pas a un changement de POSE.
 *
 * D'ou ce fichier : la seule facon de tenir la promesse « c'est ce que
 * `engine.sample(1)` rend, au byte » est de ne pas la recopier a la main.
 *
 *   pnpm favicon
 *   rsvg-convert -w 16 -h 16 public/favicon.svg -o /tmp/16.png   (et 32, 48, 180)
 *
 * Sans rasteriseur installe, le navigateur en est un : cf. `tools/og.ts`.
 */
import { writeFileSync } from 'node:fs'
import { BotEngine } from '@/bot/engine'
import { RAYON } from '@/bot/repere'
import { DEFAULT_EYE_STYLE, EYE_STYLE_BY_ID } from '@/bot/eyes'
import { DEFAULT_SHAPE, SHAPE_BY_ID } from '@/bot/skins'
import { r2 } from '@/bot/math'

/**
 * Le cadre est CALE SUR LE CORPS, pas sur l'origine.
 *
 * Le repere du moteur est centre sur l'origine, ou toutes les formes ne sont pas
 * centrees : le dome monte a -104 et descend a +50, donc un cadre symetrique lui
 * laisse un cinquieme de vide sous les pieds. Une icone de 16 px n'a pas ce vide
 * a offrir. C'est la meme distinction que `DEMI_CADRE` dans `export.ts`, qui
 * recadre lui aussi plus serre que l'ecran : la GEOMETRIE reste celle du moteur,
 * seul le cadrage est propre a la sortie.
 */
const MARGE = 1.08
const ENCRE = '#0a0a0c'
const PAPIER = '#f9f9f9'

const f = new BotEngine(
  RAYON,
  'idle',
  SHAPE_BY_ID.get(DEFAULT_SHAPE)!.radii,
  null,
  EYE_STYLE_BY_ID.get(DEFAULT_EYE_STYLE)!
).sample(1)

/* Bornes du corps, lues sur le chemin. Les points de controle d'une cubique
   peuvent deborder legerement de la courbe : le cadre est donc large d'un poil,
   ce qui est le bon sens de l'erreur pour une marge. */
const nombres = f.bodyPath.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
const xs = nombres.filter((_, i) => i % 2 === 0)
const ys = nombres.filter((_, i) => i % 2 === 1)
const cx = (Math.min(...xs) + Math.max(...xs)) / 2
const cy = (Math.min(...ys) + Math.max(...ys)) / 2
const demi =
  (Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2) * MARGE

const yeux = f.eyes
  .map((e) => `    <path d="${e.d}" transform="${e.matrix}" />`)
  .join('\n')

/* L'iris prend la classe du corps : il s'inverse donc avec lui en theme sombre,
   sinon un iris noir disparaitrait dans une boule claire. */
const iris = f.eyes
  .map((e) =>
    e.layers
      .map(
        (c) =>
          `  <g transform="${e.base}">\n` +
          `    <circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" class="corps" />\n` +
          `  </g>`
      )
      .join('\n')
  )
  .join('\n')

const svg = `<!--
  ECRIT PAR \`pnpm favicon\` (tools/favicon.ts). Ne pas editer a la main : le
  corps, les matrices d'yeux, leurs chemins et l'iris sont ce que
  \`engine.sample(1)\` rend sur \`idle\` avec la forme et le style par defaut,
  au byte. Quatre renommages de l'anatomie l'ont perime tant qu'il etait recopie.

  Les yeux sont des trous, comme dans l'application : le fond de l'onglet passe au
  travers. Le corps s'inverse en theme sombre, sinon un aplat sombre disparait sur
  une barre d'onglets sombre.

  Le remplissage est volontairement PLAT la ou l'application porte un degrade : a
  16 px un aplat reste net quand un degrade se brouille, et l'inversion sombre est
  ici une classe qui echange un \`fill\`, ce qu'un degrade ne suit qu'en se
  definissant deux fois.
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r2(cx - demi)} ${r2(cy - demi)} ${r2(demi * 2)} ${r2(demi * 2)}">
  <style>
    .corps {
      fill: ${ENCRE};
    }

    @media (prefers-color-scheme: dark) {
      .corps {
        fill: ${PAPIER};
      }
    }
  </style>

  <mask id="yeux">
    <path d="${f.bodyPath}" fill="#fff" />
${yeux}
  </mask>

${iris}

  <path d="${f.bodyPath}" class="corps" mask="url(#yeux)" />
</svg>
`

writeFileSync('public/favicon.svg', svg)
console.log(`public/favicon.svg — ${DEFAULT_SHAPE} + ${DEFAULT_EYE_STYLE}, ${svg.length} octets`)
