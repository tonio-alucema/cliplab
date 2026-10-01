import type { Pose } from './model'

export type ParticleSettings = Pick<Pose, 'propSize' | 'propCount' | 'propOutward'>
export const defaultParticleCount = (prop: Pose['prop']) => ['zzz', 'sparkle', 'heart', 'question'].includes(prop) ? 3 : prop === 'none' ? 0 : 1
export const particleCount = (prop: Pose['prop'], count = 0) => prop === 'none' ? 0 : count > 0 ? Math.max(1, Math.min(6, Math.round(count))) : defaultParticleCount(prop)
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t) }
const cycle = (phase: number) => ((phase % 1) + 1) % 1
const easeOut = (x: number) => 1 - (1 - Math.max(0, Math.min(1, x))) ** 3

/** Seeded, independent lanes keep seeking, exports and reduced-motion previews reproducible. */
function floatingParticles(prop: 'question' | 'sparkle', phase: number | undefined, count: number, size: number, outward: number) {
  const burst = prop === 'sparkle', radius = burst ? 74 : 82, maxScale = 1.15
  let halfExtent = 128
  const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
  const particles = Array.from({ length: count }, (_, i) => {
    const index = count > 1 ? i * 2 / (count - 1) : 0
    const seed = Math.sin((i + 1) * 12.9898 + (burst ? 4 : 0))
    const seed2 = Math.sin((i + 1) * 29.173 + 1.2)
    const startX = 64 + seed * 10, startY = 207 + seed2 * 10
    const rank = count > 1 ? i / (count - 1) : 1
    // A burst launches close together in time, but each star gets its own place:
    // smaller/closer stars lead into larger, farther stars along a spreading arc.
    const tier = burst ? .46 + rank * .54 : 1
    const angle = Math.PI * (.2 + rank * .06) + seed2 * .055
    const distance = 90 + rank * 240
    const travelX = burst ? Math.cos(angle) * distance : 145 + seed2 * 15
    const travelY = burst ? Math.sin(angle) * distance : 145 + seed * 18
    const sway = 7
    // Bound both ends and the small arc, independently of phase. The supplied SVGs
    // fit within these radii at every rotation, so no phase can resize the texture.
    const xBound = Math.max(Math.abs(startX - 128), Math.abs(startX + travelX * outward - 128)) + sway * outward
    const yBound = Math.max(Math.abs(startY - 128), Math.abs(startY - travelY * outward - 128)) + sway * outward
    const growthRadius = radius * maxScale * tier * size
    halfExtent = Math.max(halfExtent, Math.max(xBound, yBound) + growthRadius + 12)
    bounds.left = Math.min(bounds.left, Math.min(startX, startX + travelX * outward) - sway * outward - growthRadius)
    bounds.right = Math.max(bounds.right, Math.max(startX, startX + travelX * outward) + sway * outward + growthRadius)
    bounds.top = Math.min(bounds.top, Math.min(startY, startY - travelY * outward) - sway * outward - growthRadius)
    bounds.bottom = Math.max(bounds.bottom, Math.max(startY, startY - travelY * outward) + sway * outward + growthRadius)
    const still = phase === undefined
    const p = still ? burst ? .65 : count === 1 ? .5 : .12 + i / (count - 1) * .62 : cycle(phase + (burst ? -i * .02 : i / count))
    const progress = burst && !still ? easeOut(p) : .55 * p + .45 * smooth(p)
    const arc = Math.sin(p * Math.PI) * sway
    const growth = burst && !still ? progress : smooth(p / .88)
    return {
      index,
      x: startX + (travelX * progress + arc * seed) * outward,
      y: startY - (travelY * progress + arc * seed2) * outward,
      scale: size * tier * (.3 + (maxScale - .3) * growth),
      alpha: still ? 1 : burst ? smooth(p / .065) * (1 - smooth((p - .18) / .76)) : smooth(p / .1) * (1 - smooth((p - .28) / .72)),
      rotation: (seed * 12 + Math.sin(p * Math.PI * 1.5 + seed2) * 9 + (p - .5) * seed2 * 8) * Math.PI / 180
    }
  })
  return { extent: halfExtent * 2, particles, bounds }
}
export function particleLayout(prop: Pose['prop'], phase?: number, settings: Partial<ParticleSettings> = {}) {
  const count = particleCount(prop, settings.propCount)
  const size = settings.propSize ?? 1, outward = settings.propOutward ?? 1
  if (prop === 'question' || prop === 'sparkle') return floatingParticles(prop, phase, count, size, outward)
  // A fixed padded canvas for the entire cycle prevents large/outward particles
  // clipping against the texture edge or changing size as the padding changes.
  const radius = prop === 'crown' ? 100 : prop === 'sweat' ? 80 : 48
  const extent = Math.max(256, 2 * (110 + outward * 90 + radius * size))
  const particles = Array.from({ length: count }, (_, i) => {
    const index = count > 1 ? i * 2 / (count - 1) : 0
    const p = (((phase ?? .34) + i * .29) % 1 + 1) % 1
    const ease = p * p
    const x = count === 1 ? 128 : (prop === 'zzz' ? 45 + index * 64 : 51 + index * 69)
    const y = count === 1 ? 132 : (prop === 'zzz' ? 204 - index * 58 : 198 - index * 60)
    return { index, x: x + ease * 36 * outward, y: y - ease * (count === 1 ? 26 : prop === 'zzz' ? 54 : 38) * outward,
      scale: size * (phase === undefined ? 1 : .62 + .38 * smooth(p / .38)),
      alpha: phase === undefined ? 1 : smooth(p / .18) * (1 - smooth((p - .68) / .32)), rotation: 0 }
  })
  return { extent, particles, bounds: undefined }
}
