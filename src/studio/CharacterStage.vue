<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CharacterRenderer } from './renderer'
import { centeredGaze, easeGaze, easePointer, inactivePointer, pointerGaze, pointerLook, type EyeGazes } from './gaze'
import type { Character, Sample } from './model'
import Icon from './StudioIcon.vue'
const props = defineProps<{ character: Character; sample: Sample; rotation: { x: number; y: number; z: number }; zoom: number; background: string; previewSize: number | null; playing: boolean }>()
const emit = defineEmits<{ rotate: [value: { x: number; y: number; z: number }]; reset: []; front: []; cursor: [value: { x: number; y: number; eyes?: EyeGazes }] }>()
const host = ref<HTMLElement>(), canvas = ref<HTMLCanvasElement>()
const error = ref('')
let renderer: CharacterRenderer | undefined, observer: ResizeObserver | undefined
let start: { x: number; y: number; rotation: { x: number; y: number; z: number }; roll: boolean } | undefined
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
function down(event: PointerEvent, roll = false) {
  if (event.button !== 0) return
  leave()
  start = { x: event.clientX, y: event.clientY, rotation: { ...props.rotation }, roll: roll || event.shiftKey }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function move(event: PointerEvent) {
  if (start) {
    const dx = event.clientX - start.x, dy = event.clientY - start.y
    emit('rotate', start.roll ? { ...start.rotation, z: start.rotation.z - dx * .5 } : { ...start.rotation, x: Math.max(-180, Math.min(180, start.rotation.x + dy * .4)), y: start.rotation.y + dx * .4 })
  }
}
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
const views = [{ label: 'Left', y: -90 }, { label: 'Front', y: 0 }, { label: 'Right', y: 90 }, { label: 'Back', y: 180 }]
function view(y: number) { if (y === 0) emit('front'); else emit('rotate', { x: 0, y, z: 0 }) }
function keyboard(event: KeyboardEvent) {
  const delta = event.shiftKey ? 15 : 5
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return
  event.preventDefault()
  if (event.key === 'Home') emit('reset')
  else emit('rotate', { ...props.rotation, x: props.rotation.x + (event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0), y: props.rotation.y + (event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0) })
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
    <canvas ref="canvas" class="stage-canvas" :class="{ actual: previewSize !== null }" :style="previewSize ? { width: `${previewSize}px`, height: `${previewSize}px` } : {}" tabindex="0" aria-label="3D character preview. Drag or use arrow keys to rotate; hold Shift to roll." @keydown="keyboard" @pointerdown="down($event)" @pointermove="move" @pointerup="start = undefined" @pointercancel="start = undefined" />
    <div class="view-selector" aria-label="Character views">
      <button v-for="item in views" :key="item.label" :aria-label="`${item.label} orientation`" :class="{ active: character.trueFront && item.y === 0 }" @click="view(item.y)">{{ item.label }}</button>
      <button aria-label="Reset orientation" title="Reset orientation" @click="emit('reset')"><Icon name="reset" :size="14" /></button>
    </div>
    <div v-if="error" class="renderer-error" role="alert"><strong>Preview unavailable</strong><p>{{ error }}</p><button class="button secondary" @click="setup">Retry preview</button></div>
  </div>
</template>
