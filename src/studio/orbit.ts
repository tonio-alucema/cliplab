import { Vector3, type Quaternion } from 'three'

const rings = [0, 1, 2].map(axis => Array.from({ length: 97 }, (_, i) => {
  const a = i / 96 * Math.PI * 2
  return axis === 0 ? new Vector3(0, Math.cos(a), Math.sin(a))
    : axis === 1 ? new Vector3(Math.cos(a), 0, Math.sin(a))
      : new Vector3(Math.cos(a), Math.sin(a), 0)
}))

/** A compact orientation instrument, drawn from the character's rendered pose. */
export function drawOrbit(canvas: HTMLCanvasElement, quaternion: Quaternion) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const size = canvas.clientWidth || 144
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  const pixels = Math.round(size * ratio)
  if (canvas.width !== pixels || canvas.height !== pixels) { canvas.width = pixels; canvas.height = pixels }
  ctx.setTransform(pixels / 144, 0, 0, pixels / 144, 0, 0)
  ctx.clearRect(0, 0, 144, 144)
  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  const line = (x: number, y: number, x2: number, y2: number) => {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke()
  }

  // Corner brackets and graduated perimeter follow the reference's fine linework.
  ctx.strokeStyle = '#858583'
  for (const [x, y, dx, dy] of [[5, 5, 1, 1], [139, 5, -1, 1], [5, 139, 1, -1], [139, 139, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x! + dx! * 10, y!); ctx.lineTo(x!, y!); ctx.lineTo(x!, y! + dy! * 10); ctx.stroke()
  }
  ctx.strokeStyle = '#747472'
  ctx.beginPath(); ctx.arc(72, 72, 54, 0, Math.PI * 2); ctx.stroke()
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * Math.PI * 2, length = i % 4 === 0 ? 5 : 2
    line(72 + Math.cos(a) * 58, 72 + Math.sin(a) * 58, 72 + Math.cos(a) * (58 + length), 72 + Math.sin(a) * (58 + length))
  }

  const projected = rings.map(ring => ring.map(point => point.clone().applyQuaternion(quaternion)))
  // Draw rear hemispheres first so near rings stay crisp at crossings.
  for (const front of [false, true]) {
    ctx.strokeStyle = front ? '#d0cfca' : '#50504e'
    for (const ring of projected) {
      for (let i = 0; i < 96; i++) {
        const a = ring[i]!, b = ring[i + 1]!
        if (((a.z + b.z) / 2 >= 0) !== front) continue
        line(72 + a.x * 46, 72 - a.y * 46, 72 + b.x * 46, 72 - b.y * 46)
      }
    }
  }

  // The light marker follows the front of the character, including animated turns.
  const facing = new Vector3(0, 0, 1).applyQuaternion(quaternion)
  ctx.fillStyle = facing.z >= 0 ? '#e9e7e1' : '#191919'
  ctx.strokeStyle = '#c6c5c0'
  ctx.beginPath(); ctx.arc(72 + facing.x * 46, 72 - facing.y * 46, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  ctx.strokeStyle = '#9b9b97'
  for (const [x, y, x2, y2] of [[62, 72, 67, 72], [77, 72, 82, 72], [72, 62, 72, 67], [72, 77, 72, 82]]) line(x!, y!, x2!, y2!)
  // A fixed index makes the rotating rings readable against a stable frame.
  ctx.fillStyle = '#e9e7e1'
  ctx.beginPath(); ctx.moveTo(68, 9); ctx.lineTo(76, 9); ctx.lineTo(72, 14); ctx.closePath(); ctx.fill()
}
