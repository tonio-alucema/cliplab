// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { SvgCanvas } from './svg-canvas'
import { snapshotSvg, triangleTransform } from './svg-snapshot'
import { drawFace, drawProp, type CharacterRenderer } from './renderer'
import { BASE_POSE, EYES, MOUTHS, PROPS, defaultProject, faceLayers } from './model'

function fixture() {
  const character = { ...defaultProject().characters[0]!, shape: 'sphere' as const, color: '#12ab89', color2: '#fd7542', gradientAngle: 32, name: '<Milo & friends>', iris: true }
  const sample = { pose: { ...BASE_POSE, eye: 'heart' as const, mouth: 'open' as const, cheeks: true, teeth: true, prop: 'heart' as const }, blink: .1, bob: 0, breathe: 0, gradientRotation: 75, expressionId: 'happy', stepIndex: 0, beatIndex: 0 }
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 30); camera.position.z = 8; camera.updateMatrixWorld(true)
  const material = new THREE.ShaderMaterial({ uniforms: { colorA: { value: new THREE.Color(character.color) }, colorB: { value: new THREE.Color(character.color2) }, gradientOn: { value: 1 }, toonOn: { value: 1 }, candleLight: { value: 1 }, insetFill: { value: 0 }, angle: { value: 107 * Math.PI / 180 }, bodyHeight: { value: 1 }, fillScale: { value: new THREE.Vector3(1, 1, 1) }, fillOffset: { value: new THREE.Vector3() } } })
  const body = new THREE.Mesh(new THREE.SphereGeometry(.5, 16, 12), material), lightFill = new THREE.Mesh(body.geometry, material.clone())
  lightFill.scale.setScalar(.85); lightFill.material.uniforms.insetFill!.value = 1; lightFill.material.uniforms.fillScale!.value.setScalar(.85)
  const face = new THREE.Mesh(new THREE.PlaneGeometry(.5, .4, 8, 8), new THREE.MeshBasicMaterial()); face.position.z = .51
  face.geometry.setAttribute('faceValid', new THREE.BufferAttribute(new Float32Array(face.geometry.attributes.position!.count).fill(1), 1))
  const prop = new THREE.Sprite(new THREE.SpriteMaterial({ opacity: .7 })); prop.position.set(.56, .3, .15); prop.scale.setScalar(.3)
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.35, 32), new THREE.MeshBasicMaterial({ color: '#809299', opacity: .2 })); shadow.position.y = -.6; shadow.scale.y = .12
  const root = new THREE.Group(); root.add(body, lightFill, face, prop); root.rotation.set(.12, .25, -.1); root.updateMatrixWorld(true); shadow.updateMatrixWorld(true)
  return { character, sample, camera, body, lightFill, face, prop, shadow, gaze: { x: 0, y: 0 }, simpleEyes: false, eyeGazes: { left: { x: .6, y: .2 }, right: { x: -.6, y: .2 } }, options: { width: 256, height: 256, displaySize: 256, rotation: { x: 6, y: 14, z: -5 }, zoom: 1, background: null } } satisfies ReturnType<CharacterRenderer['snapshotScene']>
}
const parse = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml')
describe('vector SVG snapshots', () => {
  it('contains editable paths, mapped gradients and safe snapshot values with no raster image', () => {
    const state = fixture(), text = snapshotSvg(state), doc = parse(text)
    expect(doc.querySelector('parsererror')).toBeNull()
    expect(doc.querySelector('image, foreignObject, script')).toBeNull()
    expect(text).not.toMatch(/NaN|Infinity|data:image/)
    expect(doc.documentElement.getAttribute('viewBox')).toBe('0 0 256 256')
    expect(doc.querySelector('title')!.textContent).toBe('<Milo & friends> — ClipLab snapshot')
    const metadata = JSON.parse(doc.querySelector('metadata')!.textContent!)
    expect(metadata.character.color).toBe('#12ab89'); expect(metadata.character.color2).toBe('#fd7542')
    expect(metadata.effectiveGradientAngle).toBe(107); expect(metadata.pose).toEqual(state.sample.pose)
    expect(doc.querySelector('[id$="-body"] path')).not.toBeNull(); expect(doc.querySelector('[id$="-candle-light"] path')).not.toBeNull()
    expect(doc.querySelector('[id$="-face"] use')).not.toBeNull(); expect(doc.querySelector('[id$="-face-art"] path')).not.toBeNull()
    expect([...doc.querySelectorAll('linearGradient')].every(g => g.getAttribute('color-interpolation') === 'linearRGB')).toBe(true)
    expect([...doc.querySelectorAll('stop')].some(s => s.getAttribute('stop-color') === state.character.color)).toBe(true)
    for (const match of text.matchAll(/(?:url\(#|href="#)([^)"]+)/g)) expect(doc.getElementById(match[1]!)).not.toBeNull()
  })
  it('preserves unshaded solid fills, background, and camera changes', () => {
    const state = fixture(); state.body.material.uniforms.gradientOn!.value = 0; state.body.material.uniforms.toonOn!.value = 0
    state.lightFill.visible = false; state.shadow.visible = false
    const plain = snapshotSvg(state), doc = parse(plain)
    expect(doc.querySelector('linearGradient, [id$="-candle-light"], [id$="-ground-shadow"]')).toBeNull()
    expect(doc.querySelector('[id$="-body"] path')!.getAttribute('fill')).toBe(state.character.color)
    state.body.rotation.z = .7; state.body.updateMatrixWorld(true)
    expect(parse(snapshotSvg(state)).querySelector('[id$="-body"] path')!.getAttribute('d')).not.toBe(doc.querySelector('[id$="-body"] path')!.getAttribute('d'))
    expect(snapshotSvg({ ...state, options: { ...state.options, background: '#fedcba' } })).toContain('fill="#fedcba"')
  })
  it('maps every source triangle vertex exactly, including rotated and mirrored projections', () => {
    const source = [{ x: 15, y: 20 }, { x: 49, y: 30 }, { x: 29, y: 67 }]
    for (const target of [[{ x: 101, y: 77 }, { x: 150, y: 34 }, { x: 88, y: 20 }], [{ x: 16, y: 22 }, { x: 5, y: 13 }, { x: 17, y: 1 }]]) {
      const [a, b, c, d, e, f] = triangleTransform(source, target)!
      source.forEach((p, i) => { expect(a! * p.x + c! * p.y + e!).toBeCloseTo(target[i]!.x); expect(b! * p.x + d! * p.y + f!).toBeCloseTo(target[i]!.y) })
    }
  })
  it('records every face and prop with valid curves, clips, and restored drawing state', () => {
    const character = defaultProject().characters[0]!
    for (const eye of EYES) for (const mouth of MOUTHS) {
      const pose = { ...BASE_POSE, eye, mouth, cheeks: true, tongue: true, teeth: true, drool: true, tears: true, brows: 'worried' as const }
      const art = new SvgCanvas('test')
      drawFace(art as unknown as CanvasRenderingContext2D, pose, { ...character, iris: true }, .15, 'full', { x: .4, y: -.2 }, { faceLayers: faceLayers(pose), phase: .3 })
      const svg = `<svg xmlns="http://www.w3.org/2000/svg">${art.markup()}</svg>`
      expect(svg).not.toMatch(/NaN|Infinity/); expect(parse(svg).querySelector('parsererror')).toBeNull()
      expect(art.bounds.right).toBeGreaterThan(art.bounds.left)
    }
    for (const prop of PROPS) {
      const art = new SvgCanvas('prop'); drawProp(art as unknown as CanvasRenderingContext2D, prop, '#123456', .3)
      expect(art.markup()).not.toMatch(/NaN|Infinity/)
    }
  })
})
