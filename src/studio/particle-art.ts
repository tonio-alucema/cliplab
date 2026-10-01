import questionSvg from '../../public/expression-question-icon.svg?raw'
import starSvg from '../../public/expression-star-icon.svg?raw'

type Icon = { width: number; height: number; color: string; commands: { op: string; values: number[] }[] }

// Compile the supplied vector artwork once. Canvas and SVG recording use the
// same path commands, so exports need neither fonts nor external image files.
function compile(svg: string): Icon {
  const viewBox = svg.match(/viewBox="([^"]+)"/)![1]!.split(/\s+/).map(Number)
  const path = svg.match(/<path\s+d="([^"]+)"/)![1]!
  const commands = [...path.matchAll(/([MCLHVZ])([^MCLHVZ]*)/g)].map(([, op, data]) => ({
    op: op!, values: (data!.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number)
  }))
  return { width: viewBox[2]!, height: viewBox[3]!, color: svg.match(/<path[^>]*fill="([^"]+)"/)![1]!, commands }
}

const icons = { question: compile(questionSvg), sparkle: compile(starSvg) }

/** Shared normalization keeps the live vector meshes and SVG snapshots identical. */
export function particleIconSource(prop: keyof typeof icons) {
  const icon = icons[prop]
  return { svg: prop === 'question' ? questionSvg : starSvg, width: icon.width, height: icon.height, scale: prop === 'question' ? 84.32 / icon.height : 70.72 / icon.width }
}

export function drawParticleIcon(ctx: CanvasRenderingContext2D, prop: keyof typeof icons) {
  const icon = icons[prop], { scale } = particleIconSource(prop)
  ctx.save(); ctx.scale(scale, scale); ctx.translate(-icon.width / 2, -icon.height / 2)
  ctx.fillStyle = icon.color; ctx.beginPath()
  let x = 0, y = 0
  for (const { op, values: v } of icon.commands) {
    if (op === 'M' || op === 'L') { x = v[0]!; y = v[1]!; if (op === 'M') ctx.moveTo(x, y); else ctx.lineTo(x, y) }
    else if (op === 'C') { ctx.bezierCurveTo(v[0]!, v[1]!, v[2]!, v[3]!, v[4]!, v[5]!); x = v[4]!; y = v[5]! }
    else if (op === 'H') { x = v[0]!; ctx.lineTo(x, y) }
    else if (op === 'V') { y = v[0]!; ctx.lineTo(x, y) }
    else if (op === 'Z') ctx.closePath()
  }
  ctx.fill(); ctx.restore()
}
