<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CharacterRenderer, characterRotation } from './renderer'
import { drawOrbit } from './orbit'
import { centeredGaze, easeGaze, easePointer, inactivePointer, pointerGaze, pointerLook, type EyeGazes } from './gaze'
import type { Character, Sample } from './model'
import Icon from './StudioIcon.vue'
const props = defineProps<{ character: Character; sample: Sample; rotation: { x: number; y: number; z: number }; zoom: number; background: string; previewSize: number | null; playing: boolean }>()
const emit = defineEmits<{ rotate: [value: { x: number; y: number; z: number }]; reset: []; pause: []; cursor: [value: { x: number; y: number; eyes?: EyeGazes; reducedMotion?: boolean }] }>()
const host = ref<HTMLElement>(), viewport = ref<HTMLElement>(), canvas = ref<HTMLCanvasElement>(), globe = ref<HTMLCanvasElement>()
const angles = ref({ x: 0, y: 0, z: 0 })
type Axis = 'x' | 'y' | 'z'
const editingAxis = ref<Axis>(), angleDraft = ref('')
let angleRotation: { x: number; y: number; z: number } | undefined
const smallFront = computed(() => props.previewSize !== null && props.previewSize <= 24)
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
  renderer.render(props.character, props.sample, { reducedMotion: reducedMotion.matches, displaySize: size ?? 400, rotation: props.rotation, zoom: size ? 1 : props.zoom, cursor: gaze, pointerLook: props.character.followCursor ? pointer : undefined }, props.character.followCursor ? gaze : { x: 0, y: 0 })
  const orientation = renderer.orientation()
  if (globe.value) drawOrbit(globe.value, orientation)
  const base = manualRotation(), pose = props.sample.pose
  const degrees = (value: number) => Math.round(((((value + 180) % 360) + 360) % 360 - 180) * 10) / 10
  angles.value = smallFront.value ? { x: 0, y: 0, z: 0 } : { x: degrees(base.x + pose.rotationX), y: degrees(base.y + pose.rotationY), z: degrees(base.z + pose.rotationZ) }
  emit('cursor', { ...gaze, reducedMotion: reducedMotion.matches, eyes: renderer.eyeGazes() })
}
function setup() {
  if (!canvas.value || !host.value) return
  error.value = ''
  try {
    renderer?.dispose()
    renderer = new CharacterRenderer(canvas.value, { width: host.value.clientWidth, height: host.value.clientHeight, displaySize: 400 })
    observer?.disconnect(); observer = new ResizeObserver(() => { refreshPointer(); render() }); observer.observe(viewport.value ?? host.value)
    render()
  } catch { error.value = 'The 3D preview needs WebGL 2. Try a browser with hardware acceleration enabled.' }
}
function manualRotation() {
  const pose = props.sample.pose
  const rotation = characterRotation(reducedMotion.matches ? { ...props.character, followRotation: false } : props.character, pose, props.rotation, gaze)
  return { x: rotation.x - pose.rotationX, y: rotation.y - pose.rotationY, z: rotation.z - pose.rotationZ }
}
let scrub: { axis: Axis; x: number; value: number; rotation: { x: number; y: number; z: number }; pointerId: number; moved: boolean } | undefined
function startScrub(axis: Axis, event: PointerEvent) {
  if (event.button !== 0 || smallFront.value || props.character.lockPosition) return
  emit('pause')
  scrub = { axis, x: event.clientX, value: angles.value[axis], rotation: manualRotation(), pointerId: event.pointerId, moved: false }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function moveScrub(event: PointerEvent) {
  if (!scrub || scrub.pointerId !== event.pointerId || smallFront.value || props.character.lockPosition) return
  const delta = event.clientX - scrub.x
  if (!scrub.moved && Math.abs(delta) < 3) return
  scrub.moved = true; editingAxis.value = undefined
  event.preventDefault()
  const pose = props.sample.pose
  const poseAngle = scrub.axis === 'x' ? pose.rotationX : scrub.axis === 'y' ? pose.rotationY : pose.rotationZ
  const value = Math.round(Math.max(-180, Math.min(180, scrub.value + delta * .5)) * 10) / 10
  emit('rotate', { ...scrub.rotation, [scrub.axis]: value - poseAngle }); leave()
}
function endScrub(event: PointerEvent) {
  if (scrub?.pointerId !== event.pointerId) return
  if (scrub.moved) { editingAxis.value = undefined; (event.currentTarget as HTMLInputElement).blur() }
  scrub = undefined
}
function editAngle(axis: Axis, event: FocusEvent) {
  if (smallFront.value || props.character.lockPosition) return
  emit('pause')
  editingAxis.value = axis; angleDraft.value = String(angles.value[axis])
  angleRotation = manualRotation()
  nextTick(() => (event.target as HTMLInputElement).select())
}
function commitAngle(axis: Axis) {
  if (editingAxis.value !== axis) return
  editingAxis.value = undefined
  const value = Number(angleDraft.value)
  if (smallFront.value || props.character.lockPosition || !angleDraft.value.trim() || !Number.isFinite(value)) return
  const rotation = angleRotation ?? manualRotation(), pose = props.sample.pose
  const poseAngle = axis === 'x' ? pose.rotationX : axis === 'y' ? pose.rotationY : pose.rotationZ
  rotation[axis] = Math.min(180, Math.max(-180, value)) - poseAngle
  emit('rotate', rotation); leave()
}
function angleKey(axis: Axis, event: KeyboardEvent) {
  if (event.key === 'Enter') { commitAngle(axis); (event.target as HTMLInputElement).blur() }
  if (event.key === 'Escape') { editingAxis.value = undefined; (event.target as HTMLInputElement).blur() }
}
function down(event: PointerEvent) {
  if (smallFront.value || event.button !== 0 || start) return
  const rotation = manualRotation()
  emit('rotate', rotation)
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
  if (smallFront.value) return
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
onMounted(() => { setup(); reducedMotion.addEventListener('change', render); window.addEventListener('pointermove', follow, { passive: true }); window.addEventListener('scroll', refreshPointer, { passive: true, capture: true }); document.documentElement.addEventListener('pointerleave', leave) })
onBeforeUnmount(() => { reducedMotion.removeEventListener('change', render); cancelAnimationFrame(followFrame); observer?.disconnect(); renderer?.dispose(); window.removeEventListener('pointermove', follow); window.removeEventListener('scroll', refreshPointer, true); document.documentElement.removeEventListener('pointerleave', leave) })
</script>
<template>
  <div ref="host" class="stage-canvas-wrap" :style="{ background }">
    <div ref="viewport" class="character-viewport" :class="{ 'actual-viewport': previewSize !== null }">
    <canvas ref="canvas" class="stage-canvas" :class="{ actual: previewSize !== null }" :style="previewSize ? { width: `${previewSize}px`, height: `${previewSize}px` } : {}" tabindex="0" aria-label="3D character preview. Drag or use arrow keys to rotate; hold Shift to roll." @keydown="keyboard" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @lostpointercapture="up" />
    </div>
    <div class="orientation-control" role="group" aria-label="3D orbit controls">
      <div class="orbit-heading"><span>Orbit</span><button aria-label="Reset orientation" title="Reset orientation · Home" @click="emit('reset')"><Icon name="reset" :size="14" /></button></div>
      <canvas ref="globe" class="orbit-globe" width="288" height="288" tabindex="0" role="slider" aria-label="Character orientation. Drag or use arrow keys to rotate. Shift-drag or Shift-left/right to roll. Home resets." :aria-valuenow="angles.y" :aria-valuetext="`Pitch ${angles.x} degrees, turn ${angles.y} degrees, tilt ${angles.z} degrees`" aria-valuemin="-180" aria-valuemax="180" title="Drag to orbit · Shift to roll" @keydown="keyboard" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @lostpointercapture="up" />
      <div class="orbit-readout"><label v-for="axis in (['x', 'y', 'z'] as const)" :key="axis"><span>{{ axis }}</span><input type="number" :aria-label="`Orbit ${axis.toUpperCase()} angle in degrees`" :title="character.lockPosition ? 'Unlock Position to edit angles' : 'Drag left/right to scrub · Click to type · −180° to 180°'" min="-180" max="180" step="0.1" :readonly="smallFront || character.lockPosition" :value="editingAxis === axis ? angleDraft : angles[axis]" @pointerdown="startScrub(axis, $event)" @pointermove="moveScrub" @pointerup="endScrub" @pointercancel="endScrub" @lostpointercapture="endScrub" @focus="editAngle(axis, $event)" @input="angleDraft = ($event.target as HTMLInputElement).value" @blur="commitAngle(axis)" @keydown.stop="angleKey(axis, $event)" /></label></div>
      <slot name="controls" />
    </div>
    <div v-if="error" class="renderer-error" role="alert"><strong>Preview unavailable</strong><p>{{ error }}</p><button class="button secondary" @click="setup">Retry preview</button></div>
  </div>
</template>
