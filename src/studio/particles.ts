import type { Pose } from './model'

export type ParticleSettings = Pick<Pose, 'propSize' | 'propCount' | 'propOutward'>
export const defaultParticleCount = (prop: Pose['prop']) => ['zzz', 'sparkle', 'heart', 'question'].includes(prop) ? 3 : prop === 'none' ? 0 : 1
export const particleCount = (prop: Pose['prop'], count = 0) => prop === 'none' ? 0 : count > 0 ? Math.max(1, Math.min(6, Math.round(count))) : defaultParticleCount(prop)
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t) }
const cycle = (phase: number) => ((phase % 1) + 1) % 1
const easeOut = (x: number) => 1 - (1 - Math.max(0, Math.min(1, x))) ** 5

/** Seeded, independent lanes keep seeking, exports and reduced-motion previews reproducible. */
function floatingParticles(prop: 'question' | 'sparkle', phase: number | undefined, count: number, size: number, outward: number) {
  const burst = prop === 'sparkle', radius = burst ? 50.32 : 55.76, maxScale = 1.15
  let halfExtent = 128
  let launchDistance = 0, expansionDistance = 0
  const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
  const particles = Array.from({ length: count }, (_, i) => {
    const index = count > 1 ? i * 2 / (count - 1) : 0
    const seed = Math.sin((i + 1) * 12.9898 + (burst ? 4 : 0))
    const seed2 = Math.sin((i + 1) * 29.173 + 1.2)
    // Stable, alternating tilts avoid parallel marks without jitter on replay.
    const tilt = (i % 2 === 0 ? -1 : 1) * (9 + Math.abs(seed2) * 9)
    const rank = count > 1 ? i / (count - 1) : 1
    // A burst launches close together in time, but each star gets its own place:
    // smaller/closer stars lead into larger, farther stars along a spreading arc.
    const tier = burst ? .46 + rank * .54 : 1
    if (burst && i > 0) {
      const previousTier = .46 + (i - 1) / (count - 1) * .54
      // The rounded SVG's actual outline fits a 35.7px circle. Begin with a small
      // air gap, then expand that gap with growth instead of adding extra travel.
      // At zero outward movement, leave room for the fully grown silhouettes.
      launchDistance += 35.7 * (maxScale - .85 * Math.min(1, outward)) * (previousTier + tier) * size + 7
      expansionDistance += 35.7 * .85 * (previousTier + tier) * size
    }
    const startX = 64 + seed * (burst ? 1 : 3) + (burst ? launchDistance * .7 : 0)
    const startY = 207 + seed2 * (burst ? 1 : 3) - (burst ? launchDistance * Math.sqrt(.51) : 0)
    const travelX = burst ? .7 * (80 + expansionDistance) : 125 + seed2 * 6
    const travelY = burst ? Math.sqrt(.51) * (80 + expansionDistance) : 125 + seed * 7
    const sway = burst ? 2 : 7
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
    // Launch the outer stars first so independently moving lanes never collide.
    const delay = (count - 1 - i) * .05
    // Delays belong to this burst, never the tail of the previous loop.
    const lifetime = 1 - (count - 1) * .05
    const p = still ? burst ? .65 : count === 1 ? .5 : .12 + i / (count - 1) * .62
      : burst ? Math.max(0, Math.min(1, (cycle(phase) - delay) / lifetime)) : cycle(phase + i / count)
    // A compact question trail opens up gradually as its marks grow.
    const progress = burst ? (still ? .55 * p + .45 * smooth(p) : easeOut(p)) : .4 * p + .6 * p * p
    const growth = burst && !still ? progress : smooth(p / .88)
    // Every star owns its launch clock: stagger its travel, growth and spin
    // together, with a fast quintic launch and a long settling tail.
    const movement = burst && still ? growth : progress
    const arc = Math.sin(p * Math.PI) * sway
    return {
      index,
      x: startX + (travelX * movement + arc * (burst ? .3 : seed)) * outward,
      y: startY - (travelY * movement + arc * (burst ? .4 : seed2)) * outward,
      scale: size * tier * (.3 + (maxScale - .3) * growth),
      alpha: still ? 1 : burst ? smooth(p / .065) * (1 - smooth((p - .18) / .76)) : smooth(p / .1) * (1 - smooth((p - .28) / .72)),
      rotation: burst ? (tilt + 45 * (1 - (1 - p) ** 3)) * Math.PI / 180 : (tilt + Math.sin(p * Math.PI * 1.5 + seed2) * 4 + (p - .5) * seed2 * 4) * Math.PI / 180
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
