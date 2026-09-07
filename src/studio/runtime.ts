import { CharacterRenderer } from './renderer'
import { animationDuration, definitionOf, parseProject, sampleDefinition, type Definition } from './model'
export type { Definition, Character, Expression, Animation, Pose } from './model'
export interface CharacterOptions { animation?: string; size?: number; autoplay?: boolean; followCursor?: boolean; followRotation?: boolean; background?: string | null; respectReducedMotion?: boolean }

/** Standalone runtime: the studio, React wrapper and plain JavaScript export share this renderer. */
export function createCharacter(target: HTMLElement, value: Definition, options: CharacterOptions = {}) {
  let project = parseProject(value)
  let definition = definitionOf(project, project.characters[0]!)
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;'
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', definition.character.name)
  target.appendChild(canvas)
  if (options.size !== undefined) { target.style.width = `${options.size}px`; target.style.height = `${options.size}px` }
  let width = target.clientWidth || options.size || 120, height = target.clientHeight || options.size || 120
  const renderer = new CharacterRenderer(canvas, { width, height, displaySize: Math.min(width, height), background: options.background })
  let animation = options.animation ?? definition.animations[0]?.id ?? 'idle'
  let expression: string | undefined
  let playing = options.autoplay !== false, completed = false, visible = true, destroyed = false, elapsed = 0, last = performance.now(), raf = 0
  let gaze = { x: 0, y: 0 }, cursor = { x: 0, y: 0 }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const render = () => renderer.render({ ...definition.character, followRotation: options.followRotation ?? definition.character.followRotation }, sampleDefinition(definition, animation, elapsed, expression), { background: options.background, cursor }, gaze)
  const resize = () => { width = target.clientWidth || options.size || 120; height = target.clientHeight || options.size || 120; renderer.resize(width, height, Math.min(width, height)); render() }
  const observer = new ResizeObserver(resize); observer.observe(target)
  const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true }); intersection.observe(target)
  const pointer = (event: PointerEvent) => {
    if (!(options.followCursor ?? definition.character.followCursor) && !(options.followRotation ?? definition.character.followRotation)) return
    const rect = target.getBoundingClientRect()
    cursor = { x: Math.max(-1, Math.min(1, (event.clientX - rect.left - rect.width / 2) / Math.max(80, rect.width))), y: Math.max(-1, Math.min(1, -(event.clientY - rect.top - rect.height / 2) / Math.max(80, rect.height))) }
    if (options.followCursor ?? definition.character.followCursor) gaze = { ...cursor }
    if (visible) render()
  }
  const leave = () => { cursor = { x: 0, y: 0 }; if (options.followCursor ?? definition.character.followCursor) gaze = { x: 0, y: 0 }; if (visible) render() }
  window.addEventListener('pointermove', pointer, { passive: true }); document.documentElement.addEventListener('pointerleave', leave)
  function frame(now: number) {
    if (destroyed) return
    if (playing && visible && !(options.respectReducedMotion !== false && reduced.matches)) {
      elapsed += Math.min((now - last) / 1000, .1)
      const a = definition.animations.find(a => a.id === animation)
      if (!expression && a && !a.loop && elapsed * definition.character.speed >= animationDuration(a)) { playing = false; completed = true }
      render()
    }
    last = now; raf = requestAnimationFrame(frame)
  }
  render(); raf = requestAnimationFrame(frame)
  return {
    canvas,
    play() { if (completed) elapsed = 0; completed = false; playing = true }, pause() { playing = false; completed = false },
    setAnimation(id: string) { if (!definition.animations.some(a => a.id === id)) throw new Error(`Unknown animation: ${id}`); animation = id; expression = undefined; elapsed = 0; if (completed) playing = true; completed = false; render() },
    setExpression(id: string) { if (!definition.expressions.some(e => e.id === id)) throw new Error(`Unknown expression: ${id}`); expression = id; elapsed = 0; if (completed) playing = true; completed = false; render() },
    seek(seconds: number) { elapsed = Math.max(0, Number.isFinite(seconds) ? seconds : 0); render() },
    setGaze(x: number, y: number) { gaze = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) }; render() },
    setSize(size: number) { target.style.width = `${Math.max(1, size)}px`; target.style.height = `${Math.max(1, size)}px`; resize() },
    setDefinition(value: Definition) { project = parseProject(value); definition = definitionOf(project, project.characters[0]!); animation = definition.animations[0]?.id ?? 'idle'; expression = undefined; elapsed = 0; if (completed) playing = true; completed = false; canvas.setAttribute('aria-label', definition.character.name); render() },
    destroy() { destroyed = true; cancelAnimationFrame(raf); observer.disconnect(); intersection.disconnect(); window.removeEventListener('pointermove', pointer); document.documentElement.removeEventListener('pointerleave', leave); renderer.dispose(); canvas.remove() }
  }
}
