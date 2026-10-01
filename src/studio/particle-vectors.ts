import * as THREE from 'three'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import { particleIconSource } from './particle-art'
import type { particleLayout } from './particles'

type IconProp = 'question' | 'sparkle'
type Layout = ReturnType<typeof particleLayout>

/** Reusable SVG meshes: animate transforms, never magnify a small bitmap. */
export class ParticleVectors {
  readonly group = new THREE.Group()
  private artwork = new Map<IconProp, { geometry: THREE.ShapeGeometry; color: THREE.Color }>()
  private meshes: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>[] = []
  constructor() { this.group.name = 'Vector particles'; this.group.visible = false }

  update(prop: IconProp, layout: Layout, sprite: THREE.Sprite, camera: THREE.Camera) {
    let art = this.artwork.get(prop)
    if (!art) {
      const source = particleIconSource(prop)
      const paths = new SVGLoader().parse(source.svg).paths
      const geometry = new THREE.ShapeGeometry(paths.flatMap(path => SVGLoader.createShapes(path)), 48)
      geometry.translate(-source.width / 2, -source.height / 2, 0)
      geometry.scale(source.scale, -source.scale, 1)
      art = { geometry, color: paths[0]!.color }
      this.artwork.set(prop, art)
    }
    this.group.visible = sprite.visible
    sprite.getWorldPosition(this.group.position)
    camera.getWorldQuaternion(this.group.quaternion)
    sprite.getWorldScale(this.group.scale)
    this.group.scale.set(this.group.scale.x / layout.extent, this.group.scale.y / layout.extent, 1)
    for (let i = 0; i < layout.particles.length; i++) {
      let mesh = this.meshes[i]
      if (!mesh) {
        mesh = new THREE.Mesh(art.geometry, new THREE.MeshBasicMaterial({
          transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false
        }))
        mesh.renderOrder = 4 + i
        this.meshes.push(mesh); this.group.add(mesh)
      }
      const particle = layout.particles[i]!
      mesh.geometry = art.geometry; mesh.material.color.copy(art.color)
      mesh.material.opacity = particle.alpha * sprite.material.opacity
      mesh.position.set(particle.x - 128, 128 - particle.y, 0)
      mesh.rotation.z = -particle.rotation
      mesh.scale.setScalar(particle.scale)
      mesh.visible = mesh.material.opacity > 0
    }
    for (let i = layout.particles.length; i < this.meshes.length; i++) this.meshes[i]!.visible = false
  }

  dispose() {
    for (const art of this.artwork.values()) art.geometry.dispose()
    for (const mesh of this.meshes) mesh.material.dispose()
    this.group.clear(); this.artwork.clear(); this.meshes = []
  }
}
