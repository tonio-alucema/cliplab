<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CharacterRenderer, drawOrientation } from './renderer'
import type { Character, Sample } from './model'
import Icon from './StudioIcon.vue'
const props = defineProps<{ character: Character; sample: Sample; rotation: { x: number; y: number; z: number }; zoom: number; background: string; playing: boolean }>()
const emit = defineEmits<{ rotate: [value: { x: number; y: number; z: number }]; reset: [] }>()
const host = ref<HTMLElement>(), canvas = ref<HTMLCanvasElement>(), globe = ref<HTMLCanvasElement>()
const error = ref('')
let renderer: CharacterRenderer | undefined, observer: ResizeObserver | undefined
let start: { x: number; y: number; rotation: { x: number; y: number; z: number }; roll: boolean } | undefined
let gaze = { x: 0, y: 0 }
function render() { if (renderer) { renderer.render(props.character, props.sample, { rotation: props.rotation, zoom: props.zoom }, gaze); if (globe.value) drawOrientation(globe.value, renderer.orientation()) } }
function setup() {
  if (!canvas.value || !host.value) return
  error.value = ''
  try {
    renderer?.dispose()
    renderer = new CharacterRenderer(canvas.value, { width: host.value.clientWidth, height: host.value.clientHeight, displaySize: 400 })
    observer?.disconnect(); observer = new ResizeObserver(entries => { const box = entries[0]!.contentRect; renderer?.resize(box.width, box.height, 400); render() }); observer.observe(host.value)
    render()
  } catch { error.value = 'The 3D preview needs WebGL 2. Try a browser with hardware acceleration enabled.' }
}
function down(event: PointerEvent, roll = false) {
  if (event.button !== 0) return
  start = { x: event.clientX, y: event.clientY, rotation: { ...props.rotation }, roll: roll || event.shiftKey }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function move(event: PointerEvent) {
  if (start) {
    const dx = event.clientX - start.x, dy = event.clientY - start.y
    emit('rotate', start.roll ? { ...start.rotation, z: start.rotation.z - dx * .5 } : { ...start.rotation, x: Math.max(-180, Math.min(180, start.rotation.x + dy * .4)), y: start.rotation.y + dx * .4 })
  } else if (props.character.followCursor && host.value) {
    const rect = host.value.getBoundingClientRect(); gaze = { x: Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1)), y: Math.max(-1, Math.min(1, -((event.clientY - rect.top) / rect.height * 2 - 1))) }; render()
  }
}
function keyboard(event: KeyboardEvent) {
  const delta = event.shiftKey ? 15 : 5
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return
  event.preventDefault()
  if (event.key === 'Home') emit('reset')
  else emit('rotate', { ...props.rotation, x: props.rotation.x + (event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0), y: props.rotation.y + (event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0) })
}
watch(() => [props.character, props.sample, props.rotation, props.zoom], render, { deep: true })
onMounted(setup)
onBeforeUnmount(() => { observer?.disconnect(); renderer?.dispose() })
</script>
<template>
  <div ref="host" class="stage-canvas-wrap" :style="{ background }">
    <canvas ref="canvas" class="stage-canvas" aria-label="3D character preview. Drag to rotate; hold Shift to roll." @pointerdown="down($event)" @pointermove="move" @pointerup="start = undefined" @pointercancel="start = undefined" @pointerleave="gaze = { x: 0, y: 0 }; render()" />
    <div class="orientation-control">
      <button class="stage-icon reset-orientation" aria-label="Reset orientation" title="Reset orientation" @click="emit('reset')"><Icon name="reset" :size="16" /></button>
      <canvas ref="globe" width="100" height="100" tabindex="0" role="slider" aria-label="Character orientation. Arrow keys rotate; Home resets." :aria-valuenow="Math.round(rotation.y)" aria-valuemin="-180" aria-valuemax="180" @keydown="keyboard" @pointerdown="down($event)" @pointermove="move" @pointerup="start = undefined" @pointercancel="start = undefined" />
      <span class="axis-labels"><i class="axis-x"></i>X<i class="axis-y"></i>Y<i class="axis-z"></i>Z</span>
    </div>
    <div v-if="error" class="renderer-error" role="alert"><strong>Preview unavailable</strong><p>{{ error }}</p><button class="button secondary" @click="setup">Retry preview</button></div>
  </div>
</template>
