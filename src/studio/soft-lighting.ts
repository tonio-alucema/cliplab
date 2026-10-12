import * as THREE from 'three'

/** A fixed studio key, broad fill and soft rim in camera space. Rotating the
 * character changes its surface lighting rather than moving a painted band. */
export const SOFT_LIGHT_GLSL = `
vec3 studioLight(vec3 color, vec3 surfaceNormal, vec3 viewPosition) {
  vec3 N = normalize(surfaceNormal);
  vec3 V = normalize(viewPosition);
  vec3 key = normalize(vec3(-0.65, 0.85, 1.2));
  vec3 fill = normalize(vec3(0.8, 0.25, 0.55));
  float diffuse = max(dot(N, key), 0.0);
  float fillLight = max(dot(N, fill), 0.0);
  float sky = 0.5 + 0.5 * N.y;
  float gloss = pow(max(dot(N, normalize(key + V)), 0.0), 28.0);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * max(N.y, 0.0);
  return color * (0.28 + 0.62 * diffuse + 0.17 * fillLight + 0.10 * sky)
       + vec3(0.12 * gloss + 0.09 * rim);
}
`

/** Retain BasicMaterial's color/export contract while supplying smooth lighting.
 * A uniform switches styles without recompiling or replacing materials. */
export function softLightMaterial(material: THREE.MeshBasicMaterial, enabled: boolean) {
  let control = material.userData.softLighting as { value: number } | undefined
  if (!control) {
    control = { value: enabled ? 1 : 0 }; material.userData.softLighting = control
    material.onBeforeCompile = shader => {
      shader.uniforms.softLighting = control!
      shader.vertexShader = 'varying vec3 vStudioNormal; varying vec3 vStudioView;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvStudioNormal = normalize(normalMatrix * normal); vStudioView = -(modelViewMatrix * vec4(position, 1.0)).xyz;')
      shader.fragmentShader = 'uniform float softLighting; varying vec3 vStudioNormal; varying vec3 vStudioView;\n' + SOFT_LIGHT_GLSL + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight = mix(outgoingLight, studioLight(outgoingLight, vStudioNormal, vStudioView), softLighting);\n#include <opaque_fragment>')
    }
    material.customProgramCacheKey = () => 'cliplab-studio-light-v1'
    material.needsUpdate = true
  }
  control.value = enabled ? 1 : 0
}
