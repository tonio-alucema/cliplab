import * as THREE from 'three'
import { BASE_POSE, detailAt, type Character, type Detail, type Pose, type Sample, type Shape } from './model'

export interface RenderOptions {
  width: number; height: number; displaySize?: number; background?: string | null
  rotation?: { x: number; y: number; z: number }; zoom?: number; pixelRatio?: number
}
export const bodyHeight = (shape: Shape) => shape === 'capsule' ? 2 : 1
export function radiusAt(shape: Shape, y: number): number {
  if (shape === 'sphere') return Math.sqrt(Math.max(0, .25 - y * y))
  if (shape === 'capsule') { const dy = Math.max(Math.abs(y) - .5, 0); return Math.sqrt(Math.max(0, .25 - dy * dy)) }
  if (y >= 0) return Math.sqrt(Math.max(0, .25 - y * y))
  if (y >= -.43) return .5
  return .43 + Math.sqrt(Math.max(0, .07 ** 2 - (y + .43) ** 2))
}
function geometryFor(shape: Shape): THREE.BufferGeometry {
  if (shape === 'sphere') return new THREE.SphereGeometry(.5, 80, 64)
  if (shape === 'capsule') return new THREE.CapsuleGeometry(.5, 1, 24, 80)
  const points = [new THREE.Vector2(0, -.5), new THREE.Vector2(.43, -.5)]
  for (let i = 1; i <= 12; i++) { const a = -Math.PI / 2 + i / 12 * Math.PI / 2; points.push(new THREE.Vector2(.43 + .07 * Math.cos(a), -.43 + .07 * Math.sin(a))) }
  points.push(new THREE.Vector2(.5, 0))
  for (let i = 1; i <= 32; i++) { const a = i / 32 * Math.PI / 2; points.push(new THREE.Vector2(.5 * Math.cos(a), .5 * Math.sin(a))) }
  return new THREE.LatheGeometry(points, 80)
}
const vertexShader = `
  varying vec3 vPosition;
  varying vec3 vWorldNormal;
  void main() {
    vPosition = position;
    vWorldNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const fragmentShader = `
  uniform vec3 colorA;
  uniform vec3 colorB;
  uniform float gradientOn;
  uniform float toonOn;
  uniform float angle;
  uniform float bodyHeight;
  varying vec3 vPosition;
  varying vec3 vWorldNormal;
  void main() {
    float t = clamp(0.5 + vPosition.y / bodyHeight * cos(angle) + vPosition.x * sin(angle), 0.0, 1.0);
    vec3 color = mix(colorA, mix(colorB, colorA, t), gradientOn);
    float light = dot(normalize(vWorldNormal), normalize(vec3(-0.6, 0.85, 1.0)));
    float shade = light > 0.58 ? 1.0 : (light > 0.08 ? 0.81 : 0.64);
    gl_FragColor = vec4(color * mix(1.0, shade, toonOn), 1.0);
    #include <colorspace_fragment>
  }
`
function heart(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x, y + r)
  ctx.bezierCurveTo(x - r * 2, y - r * .1, x - r, y - r * 1.5, x, y - r * .55)
  ctx.bezierCurveTo(x + r, y - r * 1.5, x + r * 2, y - r * .1, x, y + r); ctx.closePath(); ctx.fill()
}
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, points = 5) {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) { const a = i / (points * 2) * Math.PI * 2 - Math.PI / 2; const d = i % 2 ? r * .46 : r; const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py) }
  ctx.closePath(); ctx.fill()
}

export function drawFace(ctx: CanvasRenderingContext2D, pose: Pose, character: Character, blink: number, detail: Detail, gaze: { x: number; y: number }) {
  ctx.clearRect(0, 0, 512, 512)
  if (detail === 'body') return
  const ink = character.eyeColor
  const eyeY = detail === 'eyes' ? 254 : 209
  const spacing = 103 * pose.spacing
  const gx = (pose.gazeX + gaze.x) * 20, gy = -(pose.gazeY + gaze.y) * 15
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const drawEye = (side: number) => {
    const factor = side < 0 ? pose.leftScale : pose.rightScale
    const r = (detail === 'eyes' ? 28 : 23) * pose.eyeSize * factor
    const x = 256 + side * spacing + gx + (side < 0 ? pose.leftX : pose.rightX)
    const y = eyeY + gy - (side < 0 ? pose.leftY : pose.rightY)
    const localRotation = side < 0 ? pose.leftRotation : pose.rightRotation
    ctx.save(); ctx.translate(x, y); ctx.rotate((pose.eyeTilt * side + localRotation) * Math.PI / 180)
    ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineWidth = 13
    const closed = pose.eye === 'closed' || (pose.eye === 'wink' && side > 0) || (detail === 'eyes' && pose.mouth === 'open' && pose.eye === 'dot')
    if (closed) {
      ctx.beginPath()
      const happy = pose.mouth === 'open' || pose.mouth === 'smile'
      ctx.moveTo(-r, happy ? 6 : -6); ctx.quadraticCurveTo(0, happy ? -r : r, r, happy ? 6 : -6); ctx.stroke()
    } else if (pose.eye === 'squint') {
      ctx.beginPath(); ctx.moveTo(-r * side, -r * .75); ctx.lineTo(r * side * .6, 0); ctx.lineTo(-r * side, r * .75); ctx.stroke()
    } else if (blink > .7) {
      ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke()
    } else {
      const h = Math.max(.12, 1 - blink) * pose.eyeHeight * (pose.eye === 'soft' ? .58 : pose.eye === 'wide' ? 1.2 : 1)
      ctx.scale(1, h)
      if (pose.eye === 'star') star(ctx, 0, 0, r * 1.25)
      else if (pose.eye === 'heart') heart(ctx, 0, 0, r)
      else { ctx.beginPath(); ctx.ellipse(0, 0, r, r, 0, 0, Math.PI * 2); ctx.fill() }
      if (character.iris && detail === 'full') { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-r * .29 + gaze.x * 3, -r * .32 + gaze.y * 3, r * .28, 0, Math.PI * 2); ctx.fill() }
    }
    ctx.restore()
  }
  drawEye(-1); drawEye(1)
  if (detail === 'eyes') return
  const x = 256 + gx * .25, y = 318 + gy * .25, w = 49 * pose.mouthWidth
  ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineWidth = 12
  ctx.save(); ctx.translate(x, y); ctx.beginPath()
  if (pose.mouth === 'smile') { ctx.moveTo(-w, -7); ctx.quadraticCurveTo(0, 29, w, -7); ctx.stroke() }
  else if (pose.mouth === 'frown') { ctx.moveTo(-w, 9); ctx.quadraticCurveTo(0, -24, w, 9); ctx.stroke() }
  else if (pose.mouth === 'line') { ctx.moveTo(-w * .65, 0); ctx.lineTo(w * .65, 0); ctx.stroke() }
  else if (pose.mouth === 'wave') { ctx.moveTo(-w, 4); ctx.bezierCurveTo(-w * .35, -22, w * .35, 22, w, -4); ctx.stroke() }
  else if (pose.mouth === 'sleep') { ctx.moveTo(-w * .7, 0); ctx.lineTo(w * .7, 0); ctx.stroke() }
  else {
    const h = 17 + 61 * pose.mouthOpen
    if (pose.mouth === 'oh') { ctx.ellipse(0, 2, w * .53, h * .64, 0, 0, Math.PI * 2) }
    else { ctx.moveTo(-w, -15); ctx.quadraticCurveTo(0, -5, w, -15); ctx.bezierCurveTo(w * 1.13, h, -w * 1.13, h, -w, -15) }
    ctx.closePath(); ctx.fill(); ctx.save(); ctx.clip()
    if (pose.tongue) { ctx.fillStyle = '#f47c80'; ctx.beginPath(); ctx.ellipse(3, h * .66, w * .75, h * .36, 0, 0, Math.PI * 2); ctx.fill() }
    if (pose.teeth) { ctx.fillStyle = '#fffef5'; ctx.beginPath(); ctx.roundRect(-w * .75, -20, w * 1.5, 25, 10); ctx.fill() }
    ctx.restore()
  }
  if (pose.drool) { ctx.strokeStyle = '#fffef5'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(w * .35, 4); ctx.lineTo(w * .4, 41); ctx.stroke(); ctx.fillStyle = '#fffef5'; ctx.beginPath(); ctx.arc(w * .4, 44, 8, 0, Math.PI * 2); ctx.fill() }
  ctx.restore()
}

function drawProp(ctx: CanvasRenderingContext2D, prop: Pose['prop'], color: string) {
  ctx.clearRect(0, 0, 256, 256); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (prop === 'zzz') {
    const z = (x: number, y: number, size: number) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + size, y); ctx.lineTo(x, y + size); ctx.lineTo(x + size, y + size); ctx.stroke() }
    z(28, 170, 30); z(84, 104, 48); z(159, 22, 65)
  } else if (prop === 'sparkle') { star(ctx, 83, 91, 53, 4); star(ctx, 190, 168, 29, 4) }
  else if (prop === 'heart') { heart(ctx, 126, 112, 58) }
  else if (prop === 'question') { ctx.font = 'bold 156px sans-serif'; ctx.fillText('?', 73, 180) }
  else if (prop === 'sweat') { ctx.beginPath(); ctx.moveTo(124, 38); ctx.bezierCurveTo(104, 98, 55, 131, 71, 174); ctx.bezierCurveTo(100, 230, 197, 190, 166, 139); ctx.closePath(); ctx.fill() }
  else if (prop === 'crown') { ctx.beginPath(); ctx.moveTo(46, 181); ctx.lineTo(23, 71); ctx.lineTo(86, 119); ctx.lineTo(126, 43); ctx.lineTo(166, 119); ctx.lineTo(229, 71); ctx.lineTo(206, 181); ctx.closePath(); ctx.fill() }
}

export class CharacterRenderer {
  readonly canvas: HTMLCanvasElement
  readonly gl: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 30)
  private root = new THREE.Group()
  private body: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
  private face: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  private faceCanvas = document.createElement('canvas')
  private faceCtx: CanvasRenderingContext2D
  private faceTexture: THREE.CanvasTexture
  private propCanvas = document.createElement('canvas')
  private propCtx: CanvasRenderingContext2D
  private propTexture: THREE.CanvasTexture
  private prop: THREE.Sprite
  private shadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>
  private shape: Shape = 'capsule'
  private lastFaceKey = ''
  private lastProp = ''
  private disposed = false
  private options: RenderOptions
  constructor(canvas: HTMLCanvasElement, options: RenderOptions) {
    this.canvas = canvas; this.options = options
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' })
    this.gl.outputColorSpace = THREE.SRGBColorSpace
    this.gl.setPixelRatio(options.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2))
    this.faceCanvas.width = this.faceCanvas.height = 512
    this.faceCtx = this.faceCanvas.getContext('2d')!
    this.faceTexture = new THREE.CanvasTexture(this.faceCanvas); this.faceTexture.colorSpace = THREE.SRGBColorSpace
    this.faceTexture.generateMipmaps = true; this.faceTexture.minFilter = THREE.LinearMipmapLinearFilter
    this.propCanvas.width = this.propCanvas.height = 256; this.propCtx = this.propCanvas.getContext('2d')!
    this.propTexture = new THREE.CanvasTexture(this.propCanvas); this.propTexture.colorSpace = THREE.SRGBColorSpace
    const material = new THREE.ShaderMaterial({
      uniforms: { colorA: { value: new THREE.Color() }, colorB: { value: new THREE.Color() }, gradientOn: { value: 1 }, toonOn: { value: 1 }, angle: { value: 0 }, bodyHeight: { value: 2 } }, vertexShader, fragmentShader
    })
    this.body = new THREE.Mesh(geometryFor('capsule'), material)
    this.face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 56, 40), new THREE.MeshBasicMaterial({ map: this.faceTexture, transparent: true, alphaTest: .008, depthWrite: false, side: THREE.FrontSide, toneMapped: false }))
    this.face.geometry.setAttribute('faceValid', new THREE.BufferAttribute(new Float32Array(this.face.geometry.attributes.position!.count).fill(1), 1))
    this.face.material.onBeforeCompile = shader => {
      shader.vertexShader = 'attribute float faceValid; varying float vFaceValid;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFaceValid = faceValid;')
      shader.fragmentShader = 'varying float vFaceValid;\n' + shader.fragmentShader.replace('void main() {', 'void main() {\nif (vFaceValid < 0.99) discard;')
    }
    this.prop = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.propTexture, transparent: true, depthWrite: false, toneMapped: false }))
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(.35, 64), new THREE.MeshBasicMaterial({ color: '#809299', transparent: true, opacity: .2, depthWrite: false }))
    this.root.add(this.body, this.face, this.prop); this.scene.add(this.root, this.shadow)
    this.camera.position.set(0, 0, 8); this.camera.lookAt(0, 0, 0)
    this.resize(options.width, options.height, options.displaySize)
  }
  resize(width: number, height: number, displaySize?: number) {
    this.options = { ...this.options, width: Math.max(1, width), height: Math.max(1, height), displaySize: displaySize ?? Math.min(width, height) }
    this.gl.setSize(this.options.width, this.options.height, false)
  }
  render(character: Character, sample: Sample, options: Partial<RenderOptions> = {}, gaze = { x: 0, y: 0 }) {
    if (this.disposed) return
    this.options = { ...this.options, ...options }
    if (character.shape !== this.shape) { this.shape = character.shape; this.body.geometry.dispose(); this.body.geometry = geometryFor(this.shape) }
    const { pose } = sample
    const height = bodyHeight(this.shape)
    const detail = detailAt(this.options.displaySize ?? Math.min(this.options.width, this.options.height))
    const u = this.body.material.uniforms
    ;(u.colorA!.value as THREE.Color).set(character.color); (u.colorB!.value as THREE.Color).set(character.color2)
    u.gradientOn!.value = character.gradient ? 1 : 0; u.toonOn!.value = character.toon ? 1 : 0
    u.angle!.value = character.gradientAngle * Math.PI / 180; u.bodyHeight!.value = height
    const rotation = this.options.rotation ?? { x: -5, y: -12, z: -7 }
    this.root.rotation.set((rotation.x + pose.rotationX) * Math.PI / 180, (rotation.y + pose.rotationY) * Math.PI / 180, (rotation.z + pose.rotationZ) * Math.PI / 180, 'YXZ')
    this.root.position.y = sample.bob * .025 * height
    const stretch = pose.squash + sample.breathe * .008
    this.root.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch))
    const zoom = this.options.zoom ?? 1
    const aspect = this.options.width / this.options.height
    const half = Math.max(height * .72, .72 / aspect) / zoom
    this.camera.left = -half * aspect; this.camera.right = half * aspect; this.camera.top = half; this.camera.bottom = -half; this.camera.updateProjectionMatrix()
    this.face.visible = detail !== 'body'
    const key = JSON.stringify([pose, character.eyeColor, character.iris, sample.blink.toFixed(3), detail, gaze.x.toFixed(3), gaze.y.toFixed(3)])
    if (key !== this.lastFaceKey) { drawFace(this.faceCtx, pose, character, sample.blink, detail, gaze); this.faceTexture.needsUpdate = true; this.lastFaceKey = key }
    const vertices = this.face.geometry.attributes.position!
    const uv = this.face.geometry.attributes.uv!
    const valid = this.face.geometry.attributes.faceValid!
    const shell = character.elevated ? 1 + character.elevation : 1.003
    const scale = pose.faceScale
    const offset = (this.shape === 'capsule' ? -.14 : -.025) + pose.faceY
    for (let i = 0; i < vertices.count; i++) {
      const x = (uv.getX(i) - .5) * .76 * scale
      const y = (uv.getY(i) - .5) * .57 * scale + offset
      const r = shell * radiusAt(this.shape, y / shell)
      const z = Math.sqrt(Math.max(.001, r * r - x * x))
      vertices.setXYZ(i, x, y, z)
      valid.setX(i, x * x < r * r && Math.abs(y) < height / 2 * shell ? 1 : 0)
    }
    vertices.needsUpdate = true; valid.needsUpdate = true; this.face.geometry.computeBoundingSphere()
    this.prop.visible = detail === 'full' && pose.prop !== 'none'
    if (pose.prop !== this.lastProp) { drawProp(this.propCtx, pose.prop, pose.prop === 'heart' ? '#ff768c' : pose.prop === 'sweat' ? '#b7e9ff' : '#ffd362'); this.propTexture.needsUpdate = true; this.lastProp = pose.prop }
    const propSize = this.shape === 'capsule' ? .42 : .32
    this.prop.scale.setScalar(propSize)
    this.prop.position.set(pose.prop === 'crown' ? 0 : .56, pose.prop === 'crown' ? height / 2 + .08 : height * .29 + sample.bob * .03, .15)
    this.shadow.visible = character.shadow && detail === 'full'
    this.shadow.position.set(0, -height * .58, -.2)
    this.shadow.scale.set((1 - sample.bob * .06) * (this.shape === 'capsule' ? 1 : .95), .12, 1)
    const bg = this.options.background
    if (bg) this.gl.setClearColor(bg, 1); else this.gl.setClearColor(0x000000, 0)
    this.gl.render(this.scene, this.camera)
  }
  orientation() { return this.root.quaternion.clone() }
  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.body.geometry.dispose(); this.body.material.dispose(); this.face.geometry.dispose(); this.face.material.dispose()
    this.faceTexture.dispose(); this.propTexture.dispose(); this.prop.material.dispose(); this.shadow.geometry.dispose(); this.shadow.material.dispose()
    this.gl.dispose(); this.gl.forceContextLoss()
  }
}

let thumbRenderer: CharacterRenderer | undefined
const thumbs = new Map<string, string>()
export function thumbnail(character: Character, pose: Pose = BASE_POSE, size = 96): string {
  const key = JSON.stringify([character.shape, character.color, character.color2, character.gradient, character.gradientAngle, character.toon, character.iris, character.eyeColor, character.elevated, character.elevation, pose, size])
  const cached = thumbs.get(key); if (cached) return cached
  try {
    if (!thumbRenderer) thumbRenderer = new CharacterRenderer(document.createElement('canvas'), { width: 192, height: 192, pixelRatio: 1, displaySize: size })
    thumbRenderer.render({ ...character, shadow: false }, { pose, blink: 0, bob: 0, breathe: 0, expressionId: '', beatIndex: 0, stepIndex: 0 }, { displaySize: size, rotation: { x: -3, y: -8, z: -5 }, zoom: 1.08 })
    const url = thumbRenderer.canvas.toDataURL('image/png'); if (thumbs.size > 250) thumbs.clear(); thumbs.set(key, url); return url
  } catch { return '' }
}

export function drawOrientation(canvas: HTMLCanvasElement, quaternion: THREE.Quaternion) {
  const ctx = canvas.getContext('2d')!; const d = canvas.width, c = d / 2, r = d * .36
  ctx.clearRect(0, 0, d, d); ctx.strokeStyle = '#89939c'; ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.arc(c, c, r * 1.16, 0, Math.PI * 2); ctx.stroke()
  const axes = ['#f18788', '#84caae', '#96adff']
  for (let axis = 0; axis < 3; axis++) {
    ctx.strokeStyle = axes[axis]!; ctx.lineWidth = 1.7
    for (let i = 0; i < 96; i++) {
      const point = (n: number) => { const a = n / 96 * Math.PI * 2; return (axis === 0 ? new THREE.Vector3(0, Math.cos(a), Math.sin(a)) : axis === 1 ? new THREE.Vector3(Math.cos(a), 0, Math.sin(a)) : new THREE.Vector3(Math.cos(a), Math.sin(a), 0)).applyQuaternion(quaternion) }
      const a = point(i), b = point(i + 1); ctx.globalAlpha = a.z < 0 ? .3 : 1
      ctx.beginPath(); ctx.moveTo(c + a.x * r, c - a.y * r); ctx.lineTo(c + b.x * r, c - b.y * r); ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}
