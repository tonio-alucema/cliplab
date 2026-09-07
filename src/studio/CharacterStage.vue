<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Euler } from 'three'
import { CharacterRenderer } from './renderer'
import { drawOrbit } from './orbit'
import { centeredGaze, easeGaze, easePointer, inactivePointer, pointerGaze, pointerLook, type EyeGazes } from './gaze'
import type { Character, Sample } from './model'
import Icon from './StudioIcon.vue'
const props = defineProps<{ character: Character; sample: Sample; rotation: { x: number; y: number; z: number }; zoom: number; background: string; previewSize: number | null; playing: boolean }>()
const emit = defineEmits<{ rotate: [value: { x: number; y: number; z: number }]; reset: []; cursor: [value: { x: number; y: number; eyes?: EyeGazes }] }>()
const host = ref<HTMLElement>(), canvas = ref<HTMLCanvasElement>(), globe = ref<HTMLCanvasElement>()
const angles = ref({ x: 0, y: 0, z: 0 })
const error = ref('')
let renderer: CharacterRenderer | undefined, observer: ResizeObserver | undefined
let start: { x: number; y: number; rotation: { x: number; y: number; z: number }; roll: boolean; pointerId: number } | undefined
let gaze = centeredGaze(), gazeTarget = centeredGaze(), followFrame = 0, lastFollow = 0
let pointer = inactivePointer(), pointerTarget = inactivePointer()
let lastPointer: { clientX: number; clientY: number } | undefined
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
function render() {
  if (!renderer || !host.value || !canvas.value) return
  const size = props.previewSize
  const width = size ?? canvas.value.clientWidth, height = size ?? canvas.value.clientHeight
  if (canvas.value.dataset.renderSize !== `${width}:${height}`) { renderer.resize(width, height, size ?? 400); canvas.value.dataset.renderSize = `${width}:${height}` }
  renderer.render(props.character, props.sample, { displaySize: size ?? 400, rotation: props.rotation, zoom: size ? 1 : props.zoom, cursor: gaze, pointerLook: props.character.followCursor ? pointer : undefined }, props.character.followCursor ? gaze : { x: 0, y: 0 })
  const orientation = renderer.orientation()
  if (globe.value) drawOrbit(globe.value, orientation)
  const euler = new Euler().setFromQuaternion(orientation, 'YXZ')
  angles.value = { x: Math.round(euler.x * 180 / Math.PI), y: Math.round(euler.y * 180 / Math.PI), z: Math.round(euler.z * 180 / Math.PI) }
  emit('cursor', { ...gaze, eyes: renderer.eyeGazes() })
}
function setup() {
  if (!canvas.value || !host.value) return
  error.value = ''
  try {
    renderer?.dispose()
    renderer = new CharacterRenderer(canvas.value, { width: host.value.clientWidth, height: host.value.clientHeight, displaySize: 400 })
    observer?.disconnect(); observer = new ResizeObserver(() => { refreshPointer(); render() }); observer.observe(host.value)
    render()
  } catch { error.value = 'The 3D preview needs WebGL 2. Try a browser with hardware acceleration enabled.' }
}
function manualRotation() {
  const pose = props.sample.pose
  if (props.character.trueFront) return { x: -pose.rotationX, y: -pose.rotationY, z: -pose.rotationZ }
  const cursor = props.character.followRotation ? gaze : centeredGaze()
  return { x: props.rotation.x - cursor.y * 16, y: props.rotation.y + cursor.x * 28, z: props.rotation.z }
}
function down(event: PointerEvent) {
  if (event.button !== 0 || start) return
  const rotation = manualRotation()
  leave()
  start = { x: event.clientX, y: event.clientY, rotation, roll: event.shiftKey, pointerId: event.pointerId }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function move(event: PointerEvent) {
  if (start && event.pointerId === start.pointerId) {
    const dx = event.clientX - start.x, dy = event.clientY - start.y
    emit('rotate', start.roll ? { ...start.rotation, z: start.rotation.z - dx * .5 } : { ...start.rotation, x: Math.max(-180, Math.min(180, start.rotation.x + dy * .4)), y: start.rotation.y + dx * .4 })
  }
}
function up(event: PointerEvent) { if (start?.pointerId === event.pointerId) start = undefined }
function follow(event: PointerEvent) {
  if (!start && (props.character.followCursor || props.character.followRotation) && canvas.value) {
    lastPointer = { clientX: event.clientX, clientY: event.clientY }; refreshPointer()
  }
}
function refreshPointer() {
  if (!lastPointer || !canvas.value) return
  const bounds = canvas.value.getBoundingClientRect()
  gazeTarget = pointerGaze(lastPointer, bounds); pointerTarget = pointerLook(lastPointer, bounds)
  if (!pointer.weight) pointer = { ...pointerTarget, weight: 0 }
  scheduleFollow()
}
function scheduleFollow() { if (!followFrame) { lastFollow = performance.now(); followFrame = requestAnimationFrame(animateFollow) } }
function animateFollow(now: number) {
  followFrame = 0
  gaze = easeGaze(gaze, gazeTarget, (now - lastFollow) / 1000, reducedMotion.matches)
  pointer = easePointer(pointer, pointerTarget, (now - lastFollow) / 1000, reducedMotion.matches)
  lastFollow = now; render()
  if (gaze.x !== gazeTarget.x || gaze.y !== gazeTarget.y || pointer.x !== pointerTarget.x || pointer.y !== pointerTarget.y || pointer.weight !== pointerTarget.weight) followFrame = requestAnimationFrame(animateFollow)
}
function leave() { lastPointer = undefined; gazeTarget = centeredGaze(); pointerTarget = { ...pointer, weight: 0 }; scheduleFollow() }
function keyboard(event: KeyboardEvent) {
  const delta = 5
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return
  event.preventDefault()
  const rotation = manualRotation()
  if (event.key === 'Home') emit('reset')
  else if (event.shiftKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) emit('rotate', { ...rotation, z: rotation.z + (event.key === 'ArrowLeft' ? delta : -delta) })
  else emit('rotate', { ...rotation, x: Math.max(-180, Math.min(180, rotation.x + (event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0))), y: rotation.y + (event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0) })
}
watch(() => [props.character, props.sample, props.rotation, props.zoom, props.previewSize], render, { deep: true, flush: 'post' })
watch(() => props.previewSize, () => nextTick(refreshPointer))
watch(() => [props.character.id, props.character.followCursor, props.character.followRotation], () => {
  cancelAnimationFrame(followFrame); followFrame = 0; gaze = centeredGaze(); gazeTarget = centeredGaze(); pointer = inactivePointer(); pointerTarget = inactivePointer(); lastPointer = undefined; render()
})
onMounted(() => { setup(); window.addEventListener('pointermove', follow, { passive: true }); window.addEventListener('scroll', refreshPointer, { passive: true, capture: true }); document.documentElement.addEventListener('pointerleave', leave) })
onBeforeUnmount(() => { cancelAnimationFrame(followFrame); observer?.disconnect(); renderer?.dispose(); window.removeEventListener('pointermove', follow); window.removeEventListener('scroll', refreshPointer, true); document.documentElement.removeEventListener('pointerleave', leave) })
</script>
<template>
  <div ref="host" class="stage-canvas-wrap" :style="{ background }">
    <canvas ref="canvas" class="stage-canvas" :class="{ actual: previewSize !== null }" :style="previewSize ? { width: `${previewSize}px`, height: `${previewSize}px` } : {}" tabindex="0" aria-label="3D character preview. Drag or use arrow keys to rotate; hold Shift to roll." @keydown="keyboard" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @lostpointercapture="up" />
    <div class="orientation-control" role="group" aria-label="3D orbit controls">
      <div class="orbit-heading"><span>Orbit</span><button aria-label="Reset orientation" title="Reset orientation · Home" @click="emit('reset')"><Icon name="reset" :size="14" /></button></div>
      <canvas ref="globe" class="orbit-globe" width="288" height="288" tabindex="0" role="slider" aria-label="Character orientation. Drag or use arrow keys to rotate. Shift-drag or Shift-left/right to roll. Home resets." :aria-valuenow="angles.y" :aria-valuetext="`Pitch ${angles.x} degrees, turn ${angles.y} degrees, tilt ${angles.z} degrees`" aria-valuemin="-180" aria-valuemax="180" title="Drag to orbit · Shift to roll" @keydown="keyboard" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @lostpointercapture="up" />
      <div class="orbit-readout" aria-hidden="true"><span v-for="axis in (['x', 'y', 'z'] as const)" :key="axis"><i>{{ axis }}</i>{{ angles[axis] }}°</span></div>
    </div>
    <div v-if="error" class="renderer-error" role="alert"><strong>Preview unavailable</strong><p>{{ error }}</p><button class="button secondary" @click="setup">Retry preview</button></div>
  </div>
</template>
