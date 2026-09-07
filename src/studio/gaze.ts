export interface Gaze { x: number; y: number }
export const centeredGaze = (): Gaze => ({ x: 0, y: 0 })

export function clampGaze({ x, y }: Gaze): Gaze {
  x = Number.isFinite(x) ? x : 0; y = Number.isFinite(y) ? y : 0
  const length = Math.max(1, Math.hypot(x, y))
  return { x: x / length, y: y / length }
}

export function pointerGaze(pointer: { clientX: number; clientY: number }, bounds: { left: number; top: number; width: number; height: number }): Gaze {
  return clampGaze({
    x: (pointer.clientX - bounds.left - bounds.width / 2) / Math.max(80, bounds.width / 2),
    y: -(pointer.clientY - bounds.top - bounds.height / 2) / Math.max(80, bounds.height / 2)
  })
}

/** Time-based easing, shared by the studio and paused or playing app characters. */
export function easeGaze(current: Gaze, target: Gaze, seconds: number, immediate = false): Gaze {
  const amount = immediate ? 1 : 1 - Math.exp(-Math.max(0, seconds) * 16)
  const next = { x: current.x + (target.x - current.x) * amount, y: current.y + (target.y - current.y) * amount }
  return Math.hypot(next.x - target.x, next.y - target.y) < .0005 ? { ...target } : next
}

/** Keep the complete white dot inside the eye, with a small margin at every angle. */
export function irisOffset(radius: number, gaze: Gaze, eyeRotation = 0, cheeks = false): Gaze {
  const look = clampGaze(gaze), angle = eyeRotation * Math.PI / 180
  const x = look.x * radius * .62, y = -look.y * radius * .62
  const dot = { x: x * Math.cos(angle) + y * Math.sin(angle), y: -x * Math.sin(angle) + y * Math.cos(angle) }
  // Stay above the cheek's circular cutout, including the dot radius and a small gap.
  if (cheeks) dot.y = Math.min(dot.y, radius * 1.13 - Math.sqrt((radius * 1.125) ** 2 - dot.x ** 2))
  return dot
}
