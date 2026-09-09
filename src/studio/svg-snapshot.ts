import * as THREE from 'three'
import { drawFace, drawProp, type CharacterRenderer } from './renderer'
import { detailAt } from './model'
import { SvgCanvas, number as n, xml } from './svg-canvas'

type Snapshot = ReturnType<CharacterRenderer['snapshotScene']>
type Vertex = { x: number; y: number; z: number; t: number; light: number }
type Triangle = { points: Vertex[]; indices: number[] }
const polygon = (p: Pick<Vertex, 'x' | 'y'>[]) => p.map((v, i) => `${i ? 'L' : 'M'}${n(v.x)} ${n(v.y)}`).join('') + 'Z'
const cross = (a: Pick<Vertex, 'x' | 'y'>, b: Pick<Vertex, 'x' | 'y'>, c: Pick<Vertex, 'x' | 'y'>) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
function hull(points: Vertex[]) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const half = (items: Vertex[]) => { const out: Vertex[] = []; for (const p of items) { while (out.length > 1 && cross(out.at(-2)!, out.at(-1)!, p) <= 0) out.pop(); out.push(p) } return out }
  return [...half(sorted).slice(0, -1), ...half([...sorted].reverse()).slice(0, -1)]
}
function clip(points: Vertex[], key: 'light' | 'z', threshold: number, above: boolean) {
  const out: Vertex[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!, insideA = above ? a[key] >= threshold : a[key] <= threshold, insideB = above ? b[key] >= threshold : b[key] <= threshold
    if (insideA) out.push(a)
    if (insideA !== insideB) {
      const f = (threshold - a[key]) / (b[key] - a[key])
      out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, t: a.t + (b.t - a.t) * f, light: a.light + (b.light - a.light) * f })
    }
  }
  return out
}
/** Affine mapping from an actual UV triangle to its orthographic screen triangle. */
export function triangleTransform(source: { x: number; y: number }[], target: { x: number; y: number }[]): number[] | undefined {
  const [s, u, v] = source as [Vertex, Vertex, Vertex], [p, q, r] = target as [Vertex, Vertex, Vertex]
  const det = cross(s, u, v)
  if (Math.abs(det) < 1e-12) return
  const a = ((q.x - p.x) * (v.y - s.y) - (r.x - p.x) * (u.y - s.y)) / det
  const c = ((r.x - p.x) * (u.x - s.x) - (q.x - p.x) * (v.x - s.x)) / det
  const b = ((q.y - p.y) * (v.y - s.y) - (r.y - p.y) * (u.y - s.y)) / det
  const d = ((r.y - p.y) * (u.x - s.x) - (q.y - p.y) * (v.x - s.x)) / det
  return [a, b, c, d, p.x - a * s.x - c * s.y, p.y - b * s.x - d * s.y]
}

export function snapshotSvg(snapshot: Snapshot): string {
  const { character, sample, camera, options, body, lightFill, face, prop, shadow } = snapshot
  const { width, height } = options
  const defs: string[] = [], contents: string[] = []
  const project = (p: THREE.Vector3) => { const v = p.clone().project(camera); return { x: (v.x + 1) * width / 2, y: (1 - v.y) * height / 2, z: v.z, t: 0, light: 0 } }
  const triangles = (mesh: THREE.Mesh, shading = false): { triangles: Triangle[]; vertices: Vertex[] } => {
    const geometry = mesh.geometry, position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), index = geometry.index
    const material = mesh.material as THREE.ShaderMaterial, uniforms = shading ? material.uniforms : undefined
    const angle = uniforms?.angle?.value ?? 0, bodyHeight = uniforms?.bodyHeight?.value ?? 1
    const scale = uniforms?.fillScale?.value as THREE.Vector3 | undefined, offset = uniforms?.fillOffset?.value as THREE.Vector3 | undefined
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld))
    const light = new THREE.Vector3(-.6, .85, 1).normalize()
    const vertices: Vertex[] = []
    for (let i = 0; i < position.count; i++) {
      const local = new THREE.Vector3().fromBufferAttribute(position, i), v = project(local.clone().applyMatrix4(mesh.matrixWorld))
      if (shading) {
        local.multiply(scale ?? new THREE.Vector3(1, 1, 1)).add(offset ?? new THREE.Vector3())
        v.t = .5 + local.y / bodyHeight * Math.cos(angle) + local.x * Math.sin(angle)
        v.light = new THREE.Vector3().fromBufferAttribute(normal, i).applyNormalMatrix(normalMatrix).dot(light)
      }
      vertices.push(v)
    }
    const triangles: Triangle[] = []
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const indices = [0, 1, 2].map(j => index ? index.getX(i + j) : i + j), points = indices.map(i => vertices[i]!)
      if (cross(points[0]!, points[1]!, points[2]!) < -1e-8) triangles.push({ points, indices })
    }
    return { triangles, vertices }
  }
  const gradients = new Map<string, string>()
  const shadedColor = (color: THREE.Color, shade: number) => '#' + color.clone().multiplyScalar(shade).getHexString()
  const surface = (mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>, label: string) => {
    const data = triangles(mesh, true), u = mesh.material.uniforms
    const colorA = u.colorA!.value as THREE.Color, colorB = (u.colorB!.value as THREE.Color).clone().lerp(colorA, 1 - u.gradientOn!.value)
    const candle = !!u.candleLight!.value, toon = !!u.toonOn!.value
    const bands = !toon ? [{ min: -2, max: 2, shade: 1 }] : candle ? [{ min: -2, max: 2, shade: u.insetFill!.value ? 1 : .8 }] : [{ min: -2, max: .08, shade: .64 }, { min: .08, max: .58, shade: .81 }, { min: .58, max: 2, shade: 1 }]
    const groups = new Map<string, string[]>()
    for (const triangle of data.triangles) for (const band of bands) {
      const p = clip(clip(triangle.points, 'light', band.min, true), 'light', band.max, false)
      if (p.length < 3) continue
      let fill = shadedColor(colorA, band.shade)
      if (u.gradientOn!.value > 0 && !colorA.equals(colorB)) {
        const [a, b, c] = triangle.points as [Vertex, Vertex, Vertex], det = cross(a, b, c)
        const gx = ((b.t - a.t) * (c.y - a.y) - (c.t - a.t) * (b.y - a.y)) / det
        const gy = ((c.t - a.t) * (b.x - a.x) - (b.t - a.t) * (c.x - a.x)) / det, length = gx * gx + gy * gy
        if (length < 1e-18) fill = shadedColor(colorB.clone().lerp(colorA, Math.max(0, Math.min(1, a.t))), band.shade)
        else {
          const endpoints = [a.x - gx * a.t / length, a.y - gy * a.t / length, a.x + gx * (1 - a.t) / length, a.y + gy * (1 - a.t) / length].map(n)
          const from = shadedColor(colorB, band.shade), to = shadedColor(colorA, band.shade), key = [...endpoints, from, to].join(':')
          let id = gradients.get(key)
          if (!id) { id = `gradient-${gradients.size}`; gradients.set(key, id); defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" color-interpolation="linearRGB" x1="${endpoints[0]}" y1="${endpoints[1]}" x2="${endpoints[2]}" y2="${endpoints[3]}"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`) }
          fill = `url(#${id})`
        }
      }
      const paths = groups.get(fill) ?? []; paths.push(polygon(p)); groups.set(fill, paths)
    }
    // Shared triangle edges are crisp; the outer silhouette remains antialiased.
    defs.push(`<clipPath id="${label}-silhouette"><path d="${polygon(hull(data.vertices))}"/></clipPath>`)
    contents.push(`<g id="${label}" clip-path="url(#${label}-silhouette)" shape-rendering="crispEdges">${[...groups].map(([fill, paths]) => `<path fill="${fill}" d="${paths.join('')}"/>`).join('')}</g>`)
    return data
  }
  if (options.background) contents.push(`<rect width="${width}" height="${height}" fill="${xml(options.background)}"/>`)
  if (shadow.visible) {
    const material = shadow.material, data = triangles(shadow)
    contents.push(`<path id="ground-shadow" d="${polygon(hull(data.vertices))}" fill="#${material.color.getHexString()}" opacity="${n(material.opacity)}"/>`)
  }
  const bodyData = surface(body, 'body')
  if (lightFill.visible) surface(lightFill, 'candle-light')
  const transparent: { z: number; markup: string }[] = []
  if (face.visible) {
    const art = new SvgCanvas('face')
    drawFace(art as unknown as CanvasRenderingContext2D, sample.pose, character, sample.blink, detailAt(options.displaySize ?? Math.min(width, height)), snapshot.gaze, { phase: sample.effectPhase, tearAmount: sample.tearAmount, eyeGazes: snapshot.eyeGazes, faceLayers: sample.faceLayers, simpleEyes: snapshot.simpleEyes })
    defs.push(`<g id="face-art">${art.markup()}</g>`)
    const uv = face.geometry.getAttribute('uv'), valid = face.geometry.getAttribute('faceValid'), data = triangles(face)
    const pieces: string[] = []
    for (const { points, indices } of data.triangles) {
      if (indices.some(i => valid.getX(i) < .99)) continue
      const source = indices.map(i => ({ x: uv.getX(i) * 512, y: (1 - uv.getY(i)) * 512 }))
      if (Math.max(...source.map(p => p.x)) < art.bounds.left || Math.min(...source.map(p => p.x)) > art.bounds.right || Math.max(...source.map(p => p.y)) < art.bounds.top || Math.min(...source.map(p => p.y)) > art.bounds.bottom) continue
      const transform = triangleTransform(source, points)
      if (!transform) continue
      const id = `face-triangle-${pieces.length}`
      defs.push(`<clipPath id="${id}"><path shape-rendering="crispEdges" d="${polygon(points)}"/></clipPath>`)
      pieces.push(`<g clip-path="url(#${id})"><use href="#face-art" transform="matrix(${transform.map(n).join(' ')})"/></g>`)
    }
    if (!face.geometry.boundingSphere) face.geometry.computeBoundingSphere()
    const center = project(face.geometry.boundingSphere!.center.clone().applyMatrix4(face.matrixWorld))
    transparent.push({ z: center.z, markup: `<g id="face">${pieces.join('')}</g>` })
  }
  if (prop.visible && prop.material.opacity > 0) {
    const art = new SvgCanvas('prop'), name = sample.pose.prop
    drawProp(art as unknown as CanvasRenderingContext2D, name, name === 'heart' ? '#ff768c' : name === 'sweat' ? '#b7e9ff' : '#ffd362', sample.effectPhase)
    const center = project(prop.getWorldPosition(new THREE.Vector3())), scale = prop.getWorldScale(new THREE.Vector3())
    const w = scale.x * width / (camera.right - camera.left), h = scale.y * height / (camera.top - camera.bottom)
    const occlusion = bodyData.triangles.map(t => clip(t.points, 'z', center.z, false)).filter(p => p.length >= 3).map(polygon).join('')
    defs.push(`<mask id="prop-occlusion" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="white"/><path d="${occlusion}" fill="black"/></mask>`)
    transparent.push({ z: center.z, markup: `<g mask="url(#prop-occlusion)" opacity="${n(prop.material.opacity)}"><g transform="translate(${n(center.x - w / 2)} ${n(center.y - h / 2)}) scale(${n(w / 256)} ${n(h / 256)})">${art.markup()}</g></g>` })
  }
  contents.push(...transparent.sort((a, b) => b.z - a.z).map(layer => layer.markup))
  const metadata = { format: 'cliplab-svg-snapshot', character, pose: sample.pose, gradientRotation: sample.gradientRotation ?? 0, effectiveGradientAngle: character.gradientAngle + (sample.gradientRotation ?? 0), rotation: options.rotation, cursor: options.cursor }
  // Multiple downloaded characters can safely be placed inline in the same page.
  const prefix = `cliplab-${crypto.randomUUID()}-`
  const artwork = (`<defs>${defs.join('')}</defs>${contents.join('')}`)
    .replace(/\bid="([^"]+)"/g, (_, id: string) => `id="${prefix}${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id: string) => `url(#${prefix}${id})`)
    .replace(/href="#([^"]+)"/g, (_, id: string) => `href="#${prefix}${id}"`)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>${xml(character.name)} — ClipLab snapshot</title><metadata>${xml(JSON.stringify(metadata))}</metadata>${artwork}</svg>`
}
