/**
 * Sonde de taille : cuit une sequence en SVG autonome et pese le resultat.
 *
 * Ce n'est PAS le cuiseur de la phase 5 — celui-la passera par le composant,
 * seule source de dessin. Ici on mesure, donc on ecrit les couches a la main
 * dans l'ordre de `BloubBot.vue`, exactement comme `docs/demo.gif` est produit.
 *
 * Ce qu'on cherche : le poids gzip d'une sequence cuite, et a quelle densite de
 * cles elle reste fidele au moteur.
 */
import { gzipSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { BotEngine, type BotFrame } from '@/bot/engine'
import { blockAt, makeBlock, offsetOf, totalDuration, type Block } from '@/bot/cycles'
import { defaultCycle } from '@/bot/cycles'
import { DEMI_VIEWBOX, RAYON } from '@/bot/repere'
import { NOTIF_BLUE } from '@/bot/decor'
import type { StateId } from '@/bot/states'

const ENCRE = '#0a0a0c'
const PAPIER = '#f9f9f9'
/** Cadence de reference : la verite a laquelle on compare toute cuisson. */
const VERITE = 60

/** Parcourt un montage et rend chaque instant demande. Reproduit `rendAt`. */
function joue(blocks: Block[], instants: number[]): BotFrame[] {
  const eng = new BotEngine(RAYON, blocks[0]!.state, null, null)
  let dernier = -1
  return instants.map((t) => {
    const { index } = blockAt(blocks, t)
    if (index !== dernier) {
      eng.setState(blocks[index]!.state, offsetOf(blocks, index))
      dernier = index
    }
    return eng.sample(t)
  })
}

const suite = (duree: number, parSec: number) =>
  Array.from({ length: Math.round(duree * parSec) + 1 }, (_, i) => i / parSec)

/* ----------------------------------------------------------------- fidelite */

const nombres = (d: string) => d.match(/-?\d+(?:\.\d+)?/g)!.map(Number)

/**
 * Ecart maximal, en unites de viewBox, entre la cuisson et le moteur.
 *
 * On SIMULE ce que fera SMIL : les deux cles encadrant l'instant sont
 * interpolees nombre a nombre. C'est exact parce que la signature de commandes
 * du corps est unique (verifie), donc les deux chaines s'alignent terme a terme.
 */
function ecartCorps(cles: string[], dureeCle: number, verite: BotFrame[], pasVerite: number) {
  let pire = 0
  for (let i = 0; i < verite.length; i++) {
    const t = i * pasVerite
    const u = t / dureeCle
    const k = Math.min(Math.floor(u), cles.length - 2)
    const f = u - k
    const a = nombres(cles[k]!)
    const b = nombres(cles[k + 1]!)
    const vrai = nombres(verite[i]!.bodyPath)
    for (let j = 0; j < vrai.length; j++) {
      const cuit = a[j]! + (b[j]! - a[j]!) * f
      const e = Math.abs(cuit - vrai[j]!)
      if (e > pire) pire = e
    }
  }
  return pire
}

/* -------------------------------------------------------------- emission SVG */

const anim = (attr: string, valeurs: string[], duree: number, discret: boolean, temps: string) =>
  `<animate attributeName="${attr}" values="${valeurs.join(';')}"${temps} dur="${duree}s"` +
  `${discret ? ' calcMode="discrete"' : ''} repeatCount="indefinite"/>`

/** Une valeur constante ne merite pas d'animation. */
const constante = (v: string[]) => v.every((x) => x === v[0])

function cuit(frames: BotFrame[], duree: number, avecDecor: boolean, keyTimes?: number[]): string {
  /* Grille NON uniforme : une cle n'est posee que la ou l'interpolation
     decroche. `keyTimes` est alors obligatoire, SMIL repartissant sinon les
     cles a intervalle egal. */
  const temps = keyTimes ? ` keyTimes="${keyTimes.map((t) => +t.toFixed(4)).join(';')}"` : ''
  const VB = DEMI_VIEWBOX
  const f0 = frames[0]!
  const nOeil = Math.max(...frames.map((f) => f.eyes.length))
  const nArc = avecDecor ? Math.max(...frames.map((f) => f.arcs.length)) : 0
  const nDot = avecDecor ? Math.max(...frames.map((f) => f.dots.length)) : 0

  const col = <T>(pick: (f: BotFrame) => T) => frames.map(pick)
  const piste = (attr: string, vals: string[], discret = false) =>
    constante(vals) ? '' : anim(attr, vals, duree, discret, temps)

  /* le corps : defini UNE fois, utilise par le masque et par le fond. Sans ce
     `use` il serait anime deux fois, donc paye deux fois. */
  const corps =
    `<path id="corps" d="${f0.bodyPath}">${piste('d', col((f) => f.bodyPath))}</path>`

  const oeil = (i: number) => {
    const d = col((f) => f.eyes[i]?.d ?? f.eyes[0]?.d ?? '')
    const al = col((f) => String(f.eyes[i]?.alpha ?? 0))
    return (
      `<path class="o${i}" d="${d[0]}" opacity="${al[0]}" fill="#000">` +
      `${piste('d', d)}${piste('opacity', al)}</path>`
    )
  }

  /* Les yeux portent une MATRICE : `animateTransform` ne sait pas l'animer, mais
     CSS interpole les transformations. C'est deja le choix de `anime.ts`. */
  const cssOeil = Array.from({ length: nOeil }, (_, i) => {
    const etapes = frames
      .map((f, k) => {
        const u = keyTimes ? keyTimes[k]! * 100 : (k * 100) / (frames.length - 1)
        return `${+u.toFixed(3)}%{transform:${f.eyes[i]?.matrix ?? 'matrix(1,0,0,1,0,0)'}}`
      })
      .join('')
    return `@keyframes o${i}{${etapes}}`
  }).join('')

  const style =
    `<style>${Array.from({ length: nOeil }, (_, i) => `.o${i}`).join(',')}{` +
    `transform-box:view-box;transform-origin:0 0;animation-duration:${duree}s;` +
    `animation-iteration-count:infinite;animation-timing-function:linear}` +
    Array.from({ length: nOeil }, (_, i) => `.o${i}{animation-name:o${i}}`).join('') +
    cssOeil +
    '</style>'

  /* Les arcs changent de STRUCTURE de commandes a presque chaque image : leur
     `d` ne s'interpole pas, il ne peut qu'etre commute. D'ou `discrete`. */
  const arc = (i: number, cote: 'front' | 'back') => {
    const d = col((f) => f.arcs[i]?.[cote] ?? '')
    const w = col((f) => String(f.arcs[i]?.width ?? 0))
    const op = col((f) => String(f.arcs[i] ? f.arcs[i]!.opacity : 0))
    if (constante(op) && op[0] === '0') return ''
    return (
      `<path d="${d[0]}" stroke="url(#g${i})" stroke-width="${w[0]}" opacity="${op[0]}">` +
      `${piste('d', d, true)}${piste('stroke-width', w)}${piste('opacity', op)}</path>`
    )
  }

  const grad = Array.from({ length: nArc }, (_, i) => {
    const prem = frames.find((f) => f.arcs[i])?.arcs[i]
    if (!prem) return ''
    const c = (k: 'x1' | 'y1' | 'x2' | 'y2') => col((f) => String(f.arcs[i]?.grad[k] ?? 0))
    const stops = prem.grad.stops
      .map((s, k) => `<stop offset="${k / (prem.grad.stops.length - 1)}" stop-color="${s}"/>`)
      .join('')
    return (
      `<linearGradient id="g${i}" gradientUnits="userSpaceOnUse" x1="${c('x1')[0]}" y1="${c('y1')[0]}" x2="${c('x2')[0]}" y2="${c('y2')[0]}">` +
      `${stops}</linearGradient>`
    )
  }).join('')

  const dot = (i: number) => {
    const has = col((f) => !!f.dots[i])
    if (!has.some(Boolean)) return ''
    const cx = col((f) => String(f.dots[i]?.x ?? 0))
    const cy = col((f) => String(f.dots[i]?.y ?? 0))
    const r = col((f) => String(f.dots[i]?.r ?? 0))
    const op = col((f) => String(f.dots[i] ? f.dots[i]!.opacity : 0))
    return (
      `<circle cx="${cx[0]}" cy="${cy[0]}" r="${r[0]}" opacity="${op[0]}" fill="${ENCRE}">` +
      `${piste('cx', cx)}${piste('cy', cy)}${piste('r', r)}${piste('opacity', op)}</circle>`
    )
  }

  const notifV = col((f) => (f.notif ? `${f.notif.x} ${f.notif.y} ${f.notif.r}` : '0 0 0'))
  const notif = notifV.some((v) => v !== '0 0 0')
    ? `<circle cx="${f0.notif?.x ?? 0}" cy="${f0.notif?.y ?? 0}" r="${f0.notif?.r ?? 0}" fill="${NOTIF_BLUE}">` +
      `${piste('cx', col((f) => String(f.notif?.x ?? 0)))}` +
      `${piste('cy', col((f) => String(f.notif?.y ?? 0)))}` +
      `${piste('r', col((f) => String(f.notif?.r ?? 0)))}</circle>`
    : ''

  const alpha = col((f) => String(f.bodyAlpha))

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-VB} ${-VB} ${VB * 2} ${VB * 2}">` +
    `<defs>${corps}${grad}` +
    `<mask id="m" maskUnits="userSpaceOnUse" x="${-VB}" y="${-VB}" width="${VB * 2}" height="${VB * 2}">` +
    `<use href="#corps" fill="#fff"/>` +
    Array.from({ length: nOeil }, (_, i) => oeil(i)).join('') +
    `</mask></defs>` +
    (nArc
      ? `<g fill="none" stroke-linecap="round">${Array.from({ length: nArc }, (_, i) => arc(i, 'back')).join('')}</g>`
      : '') +
    `<g opacity="${alpha[0]}">${piste('opacity', alpha)}` +
    `<use href="#corps" fill="${PAPIER}"/>` +
    `<g mask="url(#m)"><rect x="${-VB}" y="${-VB}" width="${VB * 2}" height="${VB * 2}" fill="${ENCRE}"/></g></g>` +
    (nDot ? `<g>${Array.from({ length: nDot }, (_, i) => dot(i)).join('')}</g>` : '') +
    notif +
    (nArc
      ? `<g fill="none" stroke-linecap="round">${Array.from({ length: nArc }, (_, i) => arc(i, 'front')).join('')}</g>`
      : '') +
    style +
    '</svg>'
  )
}

/* ------------------------------------------------------- grille adaptative */

/**
 * Vecteur compare d'une image : corps ET yeux.
 *
 * Les yeux comptent autant que le corps — un clignement dure 0,18 s, c'est lui
 * qui impose la densite la ou le corps ne demande rien. L'alpha est mis a
 * l'echelle du rayon pour peser comme une distance.
 */
function vecteur(f: BotFrame): number[] {
  const v = nombres(f.bodyPath)
  for (const e of f.eyes) {
    v.push(...nombres(e.matrix), e.alpha * RAYON, ...nombres(e.d))
  }
  return v
}

function decroche(v: number[][], a: number, b: number, tol: number): boolean {
  const va = v[a]!
  const vb = v[b]!
  for (let i = a + 1; i < b; i++) {
    const f = (i - a) / (b - a)
    const vi = v[i]!
    for (let j = 0; j < vi.length; j++) {
      if (Math.abs(va[j]! + (vb[j]! - va[j]!) * f - vi[j]!) > tol) return true
    }
  }
  return false
}

/** Indices retenus : on avance tant que le segment tient la tolerance. */
function grilleAdaptative(v: number[][], tol: number): number[] {
  const keys = [0]
  let a = 0
  while (a < v.length - 1) {
    let b = a + 1
    while (b + 1 < v.length && !decroche(v, a, b + 1, tol)) b++
    keys.push(b)
    a = b
  }
  return keys
}

/* --------------------------------------------------------------- la mesure */

/**
 * Signature de commandes d'un chemin : les lettres, sans les nombres.
 *
 * C'est le test qui decide de tout : SMIL n'interpole `d` que si les cles ont la
 * MEME suite de commandes. Une signature unique = piste interpolable ; plusieurs
 * = il ne reste que la commutation image par image.
 */
const signature = (d: string) => d.replace(/[-0-9.eE\s]+/g, '')

function rapportSignatures(frames: BotFrame[]) {
  const sigs = new Map<string, Set<string>>()
  const note = (k: string, d: string) => {
    if (!sigs.has(k)) sigs.set(k, new Set())
    sigs.get(k)!.add(signature(d))
  }
  for (const f of frames) {
    note('corps', f.bodyPath)
    f.eyes.forEach((e) => note('oeil', e.d))
    f.arcs.forEach((a) => {
      note('arc avant', a.front)
      note('arc arriere', a.back)
    })
    f.dots.forEach((d) => d.d && note('particule', d.d))
  }
  for (const [k, v] of sigs) {
    console.log(`  ${k.padEnd(12)} ${String(v.size).padStart(4)} signature(s) ${v.size === 1 ? '-> interpolable' : '-> commutation seule'}`)
  }
}

const ko = (n: number) => `${(n / 1024).toFixed(1)} ko`

mkdirSync('dist-size/svg', { recursive: true })

interface Cas {
  nom: string
  blocks: Block[]
  decor: boolean
}

const SANS_ARC: StateId[] = ['idle', 'thinking', 'wink', 'wide', 'notify', 'exclaim', 'sleep', 'egg', 'hexagon']

const cas: Cas[] = [
  { nom: 'idle seul (3 s)', blocks: [{ ...makeBlock('idle'), duration: 3 }], decor: false },
  { nom: 'sans decor (9 etats)', blocks: SANS_ARC.map(makeBlock), decor: false },
  { nom: 'cycle par defaut (14 etats)', blocks: defaultCycle().blocks, decor: true }
]

const DENSITES = [30, 15, 10, 6, 4, 2]

for (const c of cas) {
  const duree = totalDuration(c.blocks)
  const verite = joue(c.blocks, suite(duree, VERITE))
  console.log(`\n### ${c.nom} — ${duree.toFixed(1)} s, decor ${c.decor ? 'compris' : 'exclu'}`)
  rapportSignatures(verite)
  console.log('cles/s   images   brut      gzip      ecart corps max')
  for (const d of DENSITES) {
    const instants = suite(duree, d)
    const frames = joue(c.blocks, instants)
    const svg = cuit(frames, duree, c.decor)
    const gz = gzipSync(Buffer.from(svg), { level: 9 })
    const ecart = ecartCorps(
      frames.map((f) => f.bodyPath),
      duree / (frames.length - 1),
      verite,
      1 / VERITE
    )
    console.log(
      `${String(d).padStart(6)} ${String(frames.length).padStart(8)} ${ko(svg.length).padStart(9)} ${ko(gz.length).padStart(9)}   ${ecart.toFixed(2)} u  (${((ecart / RAYON) * 100).toFixed(2)} % du rayon)`
    )
    if (d === 30 || d === 10) writeFileSync(`dist-size/svg/${c.nom.replace(/[^a-z0-9]+/gi, '-')}-u${d}.svg`, svg)
  }

  console.log('tol (u)    cles   cles/s   brut      gzip')
  const v = verite.map(vecteur)
  for (const tol of [0.25, 0.5, 1]) {
    const keys = grilleAdaptative(v, tol)
    const frames = keys.map((i) => verite[i]!)
    const kt = keys.map((i) => i / (verite.length - 1))
    const svg = cuit(frames, duree, c.decor, kt)
    const gz = gzipSync(Buffer.from(svg), { level: 9 })
    console.log(
      `${tol.toFixed(2).padStart(7)} ${String(keys.length).padStart(7)} ${(keys.length / duree).toFixed(1).padStart(8)} ${ko(svg.length).padStart(9)} ${ko(gz.length).padStart(9)}`
    )
    if (tol === 0.5) writeFileSync(`dist-size/svg/${c.nom.replace(/[^a-z0-9]+/gi, '-')}-adapt.svg`, svg)
  }
}
