<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Icon from './StudioIcon.vue'
import Thumb from './CharacterThumb.vue'
import Stage from './CharacterStage.vue'
import { FACE_SETS, expressionFromFace, facePose, type FacePreset } from './face-styles'
import { BASE_POSE, EYES, MOUTHS, PALETTES, PROPS, SHAPES, animationDuration, clone, defaultExpressions, defaultProject, definitionOf, expressionDuration, parseProject, sampleDefinition, uid, type Animation, type Character, type Expression, type Pose, type Project } from './model'
import { demoZip, fileName, jsonBlob, renderMedia, saveBlob, setupInstructions } from './export'

type Tab = 'character' | 'expressions' | 'animations' | 'export'
type NumberKey = { [K in keyof Pose]: Pose[K] extends number ? K : never }[keyof Pose]
const STORAGE = 'cliplab.studio.v1'
let loadError = ''
function load(): Project { try { const value = localStorage.getItem(STORAGE); return value ? parseProject(JSON.parse(value)) : defaultProject() } catch { loadError = 'Your saved project could not be loaded. The built-in characters are ready; import a saved project to restore it.'; return defaultProject() } }
const project = ref<Project>(load())
const selectedCharacter = ref(project.value.characters[0]!.id)
const selectedExpression = ref(project.value.expressions[0]!.id)
const selectedAnimation = ref(project.value.animations[0]!.id)
const character = computed(() => project.value.characters.find(c => c.id === selectedCharacter.value) ?? project.value.characters[0]!)
const expression = computed(() => project.value.expressions.find(e => e.id === selectedExpression.value) ?? project.value.expressions[0]!)
const animation = computed(() => project.value.animations.find(a => a.id === selectedAnimation.value) ?? project.value.animations[0]!)
const definition = computed(() => definitionOf(project.value, character.value))
const tab = ref<Tab>('expressions')
const inspectorScroll = ref<HTMLElement>()
const tabs: { id: Tab; label: string; icon: string }[] = [{ id: 'character', label: 'Character', icon: 'body' }, { id: 'expressions', label: 'Expressions', icon: 'face' }, { id: 'animations', label: 'Animations', icon: 'animation' }, { id: 'export', label: 'Export', icon: 'download' }]
const mode = ref<'expression' | 'animation'>('expression')
const editing = ref(false), selectedBeat = ref(0), frozenBeat = ref(false)
const beat = computed(() => expression.value.beats[selectedBeat.value] ?? expression.value.beats[0]!)
const playing = ref(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
const time = ref(0), zoom = ref(1)
const rotation = ref({ x: -5, y: -12, z: -7 })
const previewSize = ref<number | null>(null)
const previewCursor = ref({ x: 0, y: 0 })
const background = 'transparent'
const eyeLabels: Record<string, string> = { dot: 'Round', soft: 'Soft', closed: 'Closed', wink: 'Wink', star: 'Stars', heart: 'Hearts', squint: 'Squeeze', wide: 'Wide', 'arc-up': 'Happy arcs', 'arc-down': 'Sleepy arcs', 'half-lidded': 'Half lids', pupil: 'White eyes' }
const mouthLabels: Record<string, string> = { smile: 'Smile', open: 'Open smile', line: 'Neutral', frown: 'Frown', oh: 'Surprised', wave: 'Unsure', sleep: 'Sleep', grin: 'Grin', cry: 'Cry', 'u-smile': 'Little U', kiss: 'Kiss', 'tongue-out': 'Tongue out' }
const activeFaceSet = ref('set-1')
const faceSet = computed(() => FACE_SETS.find(set => set.id === activeFaceSet.value) ?? FACE_SETS[0]!)
function applyFace(preset: FacePreset) {
  const current = beat.value.pose
  beat.value.pose = { ...facePose(faceSet.value, preset), faceScale: current.faceScale, faceY: current.faceY, rotationX: current.rotationX, rotationY: current.rotationY, rotationZ: current.rotationZ, squash: current.squash }
  playing.value = false; frozenBeat.value = true
}
function createFaceExpression(preset: FacePreset) { flush(); const e = expressionFromFace(faceSet.value, preset); project.value.expressions.push(e); editExpression(e); notify(`${e.name} added from ${faceSet.value.name}. Tune each beat below.`) }
const missingPresets = computed(() => defaultExpressions().filter(e => !project.value.expressions.some(saved => saved.id === e.id)))
function addNewPresets() { for (const e of missingPresets.value) { project.value.expressions.push(e); project.value.animations.push({ id: uid('animation'), name: e.name, loop: true, steps: [{ id: uid('step'), expressionId: e.id, duration: expressionDuration(e) }] }) } }
function rotatePreview(value: typeof rotation.value) { character.value.trueFront = false; character.value.followRotation = false; rotation.value = value }
const duration = computed(() => (mode.value === 'expression' ? expressionDuration(expression.value) : animationDuration(animation.value)) / character.value.speed)
const sample = computed(() => {
  const value = sampleDefinition(definition.value, selectedAnimation.value, time.value, mode.value === 'expression' ? expression.value.id : undefined)
  if (frozenBeat.value && !playing.value && mode.value === 'expression') return { ...value, pose: beat.value.pose, beatIndex: selectedBeat.value, blink: 0, bob: 0, breathe: 0, effectPhase: undefined, propAmount: 1, tearAmount: 1 }
  return value
})
const currentLabel = computed(() => mode.value === 'expression' ? expression.value.name : animation.value.name)
const notice = ref(loadError), saved = ref('Saved on this device')
let noticeTimer: ReturnType<typeof setTimeout>
function notify(message: string) { notice.value = message; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice.value = '' }, 6500) }
const history = ref<string[]>([]), future = ref<string[]>([])
let stable = JSON.stringify(project.value), restoring = false, saveTimer: ReturnType<typeof setTimeout>
function persist() { try { localStorage.setItem(STORAGE, JSON.stringify(project.value)); saved.value = 'Saved on this device' } catch { saved.value = 'Save a project backup'; notify('Device storage is full or unavailable. Download your project to keep your changes.') } }
function flush() { clearTimeout(saveTimer); const now = JSON.stringify(project.value); if (now !== stable) { history.value.push(stable); if (history.value.length > 40) history.value.shift(); stable = now; future.value = [] } persist() }
watch(project, () => { if (restoring) return; saved.value = 'Saving…'; clearTimeout(saveTimer); saveTimer = setTimeout(flush, 350) }, { deep: true, flush: 'sync' })
function normalizeSelections() {
  if (!project.value.characters.some(c => c.id === selectedCharacter.value)) selectedCharacter.value = project.value.characters[0]!.id
  if (!project.value.expressions.some(e => e.id === selectedExpression.value)) selectedExpression.value = project.value.expressions[0]!.id
  if (!project.value.animations.some(a => a.id === selectedAnimation.value)) selectedAnimation.value = project.value.animations[0]!.id
  selectedBeat.value = 0; time.value = 0; frozenBeat.value = false; editing.value = false
  expressionPicker.value?.close()
}
function restoreSnapshot(value: string) { const priorIds = new Set(project.value.animations.map(a => a.id)); restoring = true; project.value = JSON.parse(value) as Project; stable = value; restoring = false; const restored = project.value.animations.filter(a => !priorIds.has(a.id)); if (restored.length === 1) selectedAnimation.value = restored[0]!.id; persist(); normalizeSelections() }
function undo() { if (JSON.stringify(project.value) !== stable) flush(); const previous = history.value.pop(); if (previous) { future.value.push(stable); restoreSnapshot(previous); notify('Change undone.') } }
function redo() { const following = future.value.pop(); if (following) { history.value.push(stable); restoreSnapshot(following); notify('Change restored.') } }
function resetRotation() { rotatePreview({ x: -5, y: -12, z: -7 }) }
function toggleFront() { character.value.trueFront = !character.value.trueFront; if (character.value.trueFront) character.value.followRotation = false }
function selectExpression(value: Expression) { selectedExpression.value = value.id; mode.value = 'expression'; selectedBeat.value = 0; frozenBeat.value = false; time.value = 0 }
function editExpression(value: Expression) { selectExpression(value); activeFaceSet.value = value.beats[0]!.pose.faceSet; editing.value = true; tab.value = 'expressions'; playing.value = false; frozenBeat.value = true }
function selectAnimation(value: Animation) { selectedAnimation.value = value.id; mode.value = 'animation'; editing.value = false; frozenBeat.value = false; time.value = 0 }
function pickBeat(index: number) { selectedBeat.value = index; frozenBeat.value = true; playing.value = false; time.value = expression.value.beats.slice(0, index).reduce((t, b) => t + b.duration, 0) / character.value.speed }
function updatePose(key: NumberKey, event: Event) {
  const value = (event.target as HTMLInputElement).valueAsNumber
  beat.value.pose[key] = value
  if (linkedEyes.value && (key === 'leftScale' || key === 'rightScale')) beat.value.pose[key === 'leftScale' ? 'rightScale' : 'leftScale'] = value
  const pairs: Partial<Record<NumberKey, [NumberKey, number]>> = { leftX: ['rightX', -1], rightX: ['leftX', -1], leftY: ['rightY', 1], rightY: ['leftY', 1], leftRotation: ['rightRotation', -1], rightRotation: ['leftRotation', -1] }
  const pair = pairs[key]
  if (mirroredEyes.value && pair) beat.value.pose[pair[0]] = value * pair[1]
  frozenBeat.value = true; playing.value = false
}
function togglePlay() { if (!playing.value && time.value >= duration.value - .001) time.value = 0; frozenBeat.value = false; playing.value = !playing.value }
function seek(event: Event) { time.value = Number((event.target as HTMLInputElement).value); frozenBeat.value = false; playing.value = false }
function addBeat() { if (expression.value.beats.length >= 4) return; const item = clone(beat.value); item.id = uid('beat'); item.name = `Beat ${expression.value.beats.length + 1}`; expression.value.beats.push(item); pickBeat(expression.value.beats.length - 1) }
function removeBeat(index: number) { if (expression.value.beats.length < 2) return; expression.value.beats.splice(index, 1); pickBeat(Math.min(selectedBeat.value, expression.value.beats.length - 1)) }
function duplicateExpression() { const e = clone(expression.value); e.id = uid('expression'); e.name = `${e.name} copy`; e.beats.forEach(b => { b.id = uid('beat') }); project.value.expressions.push(e); editExpression(e) }
function newExpression() { const e: Expression = { id: uid('expression'), name: 'New expression', description: '', beats: [1, 2].map(n => ({ id: uid('beat'), name: n === 1 ? 'Begin' : 'Return', duration: 1.5, pose: clone(BASE_POSE) })) }; project.value.expressions.push(e); editExpression(e) }
const expressionPicker = ref<HTMLDialogElement>()
const animationName = ref<HTMLInputElement>()
async function revealAnimation() { tab.value = 'animations'; await nextTick(); inspectorScroll.value?.scrollTo({ top: 0 }); animationName.value?.focus(); animationName.value?.select() }
function newAnimation() {
  flush()
  let name = 'New animation', n = 2
  while (project.value.animations.some(a => a.name === name)) name = `New animation ${n++}`
  const a: Animation = { id: uid('animation'), name, loop: true, steps: [{ id: uid('step'), expressionId: expression.value.id, duration: expressionDuration(expression.value) }] }
  project.value.animations.push(a); selectAnimation(a); playing.value = false; revealAnimation()
}
function openExpressionPicker() { normalizeAnimation(); if (animation.value.steps.length < 64) expressionPicker.value?.showModal() }
function normalizeAnimation() { if (!project.value.animations.some(a => a.id === selectedAnimation.value)) selectedAnimation.value = project.value.animations[0]!.id }
async function addStep(expressionId: string) {
  normalizeAnimation()
  const a = project.value.animations.find(a => a.id === selectedAnimation.value)!
  const e = project.value.expressions.find(e => e.id === expressionId)
  if (!e || a.steps.length >= 64) return
  flush()
  const start = animationDuration(a)
  a.steps.push({ id: uid('step'), expressionId: e.id, duration: expressionDuration(e) })
  mode.value = 'animation'; editing.value = false; frozenBeat.value = false; playing.value = false
  time.value = (start + Math.min(.5, expressionDuration(e) / 2)) / character.value.speed
  expressionPicker.value?.close(); notify(`Added ${e.name} to ${a.name}.`)
  await nextTick(); document.querySelector('.sequence-track .sequence-beat:last-of-type')?.scrollIntoView({ block: 'nearest', inline: 'end' })
}
function deleteAnimation() {
  if (project.value.animations.length <= 1) return
  normalizeAnimation(); flush()
  const index = project.value.animations.findIndex(a => a.id === selectedAnimation.value)
  const name = project.value.animations[index]!.name
  project.value.animations.splice(index, 1)
  selectedAnimation.value = project.value.animations[Math.min(index, project.value.animations.length - 1)]!.id
  normalizeSelections(); mode.value = 'animation'; playing.value = false; flush()
  notify(`Deleted ${name}. Undo is available.`)
}
function toggleRotationFollowing() { character.value.followRotation = !character.value.followRotation; if (character.value.followRotation) character.value.trueFront = false }
function removeStep(index: number) { if (animation.value.steps.length > 1) { animation.value.steps.splice(index, 1); time.value = 0 } }
function moveItem(index: number, direction: number) {
  const list = mode.value === 'expression' ? expression.value.beats : animation.value.steps
  const next = index + direction
  if (next < 0 || next >= list.length) return
  ;[list[index], list[next]] = [list[next]!, list[index]!]
  if (mode.value === 'expression') selectedBeat.value = next
  time.value = 0
}
let dragIndex = -1
function dropAt(index: number) {
  if (dragIndex < 0 || dragIndex === index) return
  if (mode.value === 'expression') { const item = expression.value.beats.splice(dragIndex, 1)[0]!; expression.value.beats.splice(index, 0, item); selectedBeat.value = index }
  else { const item = animation.value.steps.splice(dragIndex, 1)[0]!; animation.value.steps.splice(index, 0, item) }
  dragIndex = -1; time.value = 0
}
function stepExpression(id: string) { return project.value.expressions.find(e => e.id === id) ?? project.value.expressions[0]! }
function characterForShape(shape: Character['shape']) { return { ...character.value, shape } }
function applyPalette(colors: string[]) { character.value.color = colors[0]!; character.value.color2 = colors[1]! }
function duplicateCharacter() { const c = clone(character.value); c.id = uid('character'); c.name = `${c.name} copy`; project.value.characters.push(c); selectedCharacter.value = c.id; tab.value = 'character' }
const numberControls: { key: NumberKey; label: string; min: number; max: number; step: number }[] = [
  { key: 'faceScale', label: 'Face size', min: .6, max: 1.4, step: .01 }, { key: 'faceY', label: 'Face height', min: -.2, max: .2, step: .01 },
  { key: 'eyeSize', label: 'Eye size', min: .4, max: 1.8, step: .01 }, { key: 'eyeHeight', label: 'Eye height', min: .2, max: 1.8, step: .01 },
  { key: 'spacing', label: 'Eye spacing', min: .5, max: 1.5, step: .01 }, { key: 'eyeTilt', label: 'Eye tilt', min: -35, max: 35, step: 1 },
  { key: 'leftScale', label: 'Left eye', min: .4, max: 1.6, step: .01 }, { key: 'rightScale', label: 'Right eye', min: .4, max: 1.6, step: .01 },
  { key: 'gazeX', label: 'Look sideways', min: -1, max: 1, step: .01 }, { key: 'gazeY', label: 'Look up / down', min: -1, max: 1, step: .01 },
  { key: 'mouthStroke', label: 'Mouth stroke', min: .5, max: 2.2, step: .05 }, { key: 'mouthWidth', label: 'Mouth width', min: .3, max: 1.6, step: .01 }, { key: 'mouthOpen', label: 'Mouth opening', min: .1, max: 1, step: .01 }
]
const bodyControls: { key: NumberKey; label: string; min: number; max: number; step: number }[] = [
  { key: 'rotationX', label: 'Nod · X', min: -45, max: 45, step: 1 }, { key: 'rotationY', label: 'Turn · Y', min: -60, max: 60, step: 1 }, { key: 'rotationZ', label: 'Tilt · Z', min: -45, max: 45, step: 1 }, { key: 'squash', label: 'Stretch', min: .8, max: 1.2, step: .01 }
]
const linkedEyes = ref(true)
const mirroredEyes = ref(false)
const eyePlacementControls: { key: NumberKey; label: string; min: number; max: number; step: number }[] = [
  { key: 'leftX', label: 'Left eye horizontal', min: -60, max: 60, step: 1 }, { key: 'rightX', label: 'Right eye horizontal', min: -60, max: 60, step: 1 },
  { key: 'leftY', label: 'Left eye vertical', min: -60, max: 60, step: 1 }, { key: 'rightY', label: 'Right eye vertical', min: -60, max: 60, step: 1 },
  { key: 'leftRotation', label: 'Left eye rotation', min: -90, max: 90, step: 1 }, { key: 'rightRotation', label: 'Right eye rotation', min: -90, max: 90, step: 1 }
]
watch(() => tab.value, value => { if (value !== 'expressions') editing.value = false })
watch(() => [tab.value, editing.value], async () => { await nextTick(); inspectorScroll.value?.scrollTo({ top: 0 }) })
const importInput = ref<HTMLInputElement>()
async function importProject(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  if (!file) return
  try {
    if (file.size > 2_000_000) throw new Error('Choose a ClipLab JSON file smaller than 2 MB.')
    const imported = parseProject(JSON.parse(await file.text())); flush(); project.value = imported
    selectedCharacter.value = imported.characters[0]!.id; selectedExpression.value = imported.expressions[0]!.id; selectedAnimation.value = imported.animations[0]!.id
    normalizeSelections(); notify('Project imported. Undo is available if you want to go back.')
  } catch (error) { notify(error instanceof Error ? error.message : 'This project could not be imported.') }
  input.value = ''
}
function saveProject() { flush(); saveBlob(jsonBlob(project.value), `${fileName(project.value.name)}.cliplab.json`); notify('Project backup downloaded.') }
const exportTab = ref<'app' | 'image' | 'animation' | 'project'>('app')
const appFormat = ref<'react' | 'javascript'>('react')
const selectedExports = ref<string[]>(project.value.animations.map(a => a.id))
const exportDefinition = computed(() => definitionOf(project.value, character.value, selectedExports.value))
const mediaFormat = ref<'gif' | 'mp4' | 'webm'>('mp4'), exportSize = ref('square'), width = ref(1080), height = ref(1080), fps = ref(30), repetitions = ref(1)
const transparent = ref(true), exportBackground = ref('#edf1f3')
const progress = ref(0), busy = ref(false)
let controller: AbortController | undefined
const exportDuration = computed(() => animationDuration(animation.value) / character.value.speed * repetitions.value)
watch(exportSize, value => { if (value === 'square') { width.value = 1080; height.value = 1080 } else if (value === 'portrait') { width.value = 1080; height.value = 1350 } else if (value === 'story') { width.value = 1080; height.value = 1920 } else if (value === 'landscape') { width.value = 1920; height.value = 1080 } else if (value === 'icon') { width.value = 128; height.value = 128 } })
watch(mediaFormat, value => { if (value === 'gif') { width.value = 512; height.value = 512; fps.value = 20; exportSize.value = 'custom' } })
watch(() => project.value.animations.map(a => a.id), (ids, old) => { selectedExports.value = selectedExports.value.filter(id => ids.includes(id)); ids.filter(id => !old.includes(id)).forEach(id => selectedExports.value.push(id)) })
async function copy(value: string, message = 'Copied to clipboard.') { try { await navigator.clipboard.writeText(value); notify(message) } catch { notify('Clipboard access is unavailable. Download the definition or project instead.') } }
function exportJson() { if (!selectedExports.value.length) return; saveBlob(jsonBlob(exportDefinition.value), `${fileName(character.value.name)}.character.json`); notify('Character definition downloaded.') }
async function exportDemo() {
  if (!selectedExports.value.length) return
  busy.value = true; progress.value = 0
  try { const blob = await demoZip(exportDefinition.value, appFormat.value === 'react'); saveBlob(blob, `${fileName(character.value.name)}-${appFormat.value}-demo.zip`); notify('Runnable example downloaded.') } catch (e) { notify(e instanceof Error ? e.message : 'The example could not be exported.') } finally { busy.value = false }
}
async function exportMedia() {
  busy.value = true; progress.value = 0; controller = new AbortController()
  const format = exportTab.value === 'image' ? 'png' : mediaFormat.value
  try {
    const blob = await renderMedia(clone(definition.value), { width: width.value, height: height.value, fps: fps.value, duration: exportDuration.value, animationId: animation.value.id, format, background: transparent.value && format !== 'mp4' ? null : exportBackground.value, rotation: { ...rotation.value }, zoom: zoom.value, cursor: { ...previewCursor.value }, sample: clone(sample.value), signal: controller.signal, onProgress: p => { progress.value = p } })
    saveBlob(blob, `${fileName(character.value.name)}-${fileName(currentLabel.value)}.${format}`); notify(`${format.toUpperCase()} downloaded.`)
  } catch (e) { if (e instanceof DOMException && e.name === 'AbortError') notify('Export cancelled.'); else notify(e instanceof Error ? e.message : 'Export failed. Try a smaller size or a different format.') } finally { busy.value = false; controller = undefined }
}
const example = computed(() => appFormat.value === 'react' ? `<Character\n  animation="${exportDefinition.value.animations[0]?.id ?? 'idle'}"\n  size={120}\n  followCursor={${character.value.followCursor}}\n  followRotation={${character.value.followRotation}}\n/>` : `const character = createCharacter(\n  container, definition, {\n    animation: '${exportDefinition.value.animations[0]?.id ?? 'idle'}',\n    followCursor: ${character.value.followCursor},\n    followRotation: ${character.value.followRotation}\n  }\n);`)
let frameId = 0, lastFrame = performance.now()
function tick(now: number) {
  if (playing.value) {
    time.value += Math.min((now - lastFrame) / 1000, .1)
    if (time.value >= duration.value) { if (mode.value === 'animation' && !animation.value.loop) { time.value = duration.value - .0001; playing.value = false } else time.value %= duration.value }
  }
  lastFrame = now; frameId = requestAnimationFrame(tick)
}
function keyboard(e: KeyboardEvent) {
  if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]')) return
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
  else if (e.code === 'Space' && !(e.target as HTMLElement).closest('button')) { e.preventDefault(); togglePlay() }
}
onMounted(() => { frameId = requestAnimationFrame(tick); window.addEventListener('keydown', keyboard); window.addEventListener('pagehide', flush) })
onBeforeUnmount(() => { cancelAnimationFrame(frameId); clearTimeout(noticeTimer); flush(); controller?.abort(); window.removeEventListener('keydown', keyboard); window.removeEventListener('pagehide', flush) })
// Keep the selected beat valid after importing, deleting, or undoing an expression.
watch(() => expression.value.beats.length, n => { selectedBeat.value = Math.min(selectedBeat.value, n - 1) })
</script>

<template>
  <div class="studio-app">
    <header class="studio-header">
      <a class="wordmark" href="#" aria-label="ClipLab studio"><img src="/cliplab-logo-white.svg" alt="ClipLab" /></a>
      <span class="header-description">Character studio</span>
      <div class="header-actions">
        <span class="save-state"><span class="saved-dot"></span>{{ saved }}</span>
        <div class="undo-group"><button class="icon-button" :disabled="!history.length && saved !== 'Saving…'" aria-label="Undo" title="Undo · ⌘Z" @click="undo"><Icon name="undo" /></button><button class="icon-button" :disabled="!future.length" aria-label="Redo" title="Redo · ⇧⌘Z" @click="redo"><Icon name="redo" /></button></div>
        <button class="button quiet header-import" @click="importInput?.click()"><Icon name="upload" :size="16" />Import</button>
        <button class="button primary" @click="tab = 'export'"><Icon name="download" :size="16" />Export</button>
        <input ref="importInput" type="file" accept=".json,.cliplab.json,.character.json,application/json" hidden @change="importProject" />
      </div>
    </header>

    <main class="studio-workspace">
      <section class="workbench" aria-label="Character preview and sequencing">
        <div class="preview-card">
        <div class="character-bar">
          <div class="character-tabs" aria-label="Characters"><button v-for="c in project.characters" :key="c.id" :class="['character-tab', { active: c.id === character.id }]" :aria-pressed="c.id === character.id" @click="selectedCharacter = c.id"><Thumb :character="c" :size="38" /><span>{{ c.name }}</span></button><button class="icon-button add-character" title="Duplicate character" aria-label="Duplicate character" @click="duplicateCharacter"><Icon name="plus" :size="17" /></button></div>
          <span class="character-count">{{ project.characters.length }} characters</span>
        </div>

        <div class="preview-frame">
          <Stage :character="character" :sample="sample" :rotation="rotation" :zoom="zoom" :background="background" :playing="playing" :preview-size="previewSize" @rotate="rotatePreview" @reset="resetRotation" @front="character.trueFront = true; character.followRotation = false" @cursor="previewCursor = $event" />
          <div class="preview-status"><span :class="['status-light', { playing }]" /><span>{{ currentLabel }}</span><span class="status-divider">/</span><span class="status-action">{{ playing ? 'Playing' : 'Paused' }}</span></div>
          <div class="stage-tools">
            <div class="view-controls">
              <button class="stage-pill" :class="{ active: character.trueFront }" aria-label="True front view" :aria-pressed="character.trueFront" title="Keep the character facing straight ahead, including during animation" @click="toggleFront"><Icon name="front" :size="16" /><span>Front</span></button>
              <button class="stage-pill" :class="{ active: character.lockPosition }" aria-label="Lock position" :aria-pressed="character.lockPosition" title="Stop floating and breathing; keep expressions and details moving" @click="character.lockPosition = !character.lockPosition"><Icon :name="character.lockPosition ? 'lock' : 'unlock'" :size="16" /><span>Position</span></button>
              <button class="stage-icon" :class="{ active: character.followCursor }" title="Eyes follow cursor" aria-label="Eyes follow cursor" :aria-pressed="character.followCursor" @click="character.followCursor = !character.followCursor"><Icon name="eye" :size="17" /></button><button class="stage-icon" :class="{ active: character.followRotation }" title="Character turns toward cursor" aria-label="Character follows cursor" :aria-pressed="character.followRotation" @click="toggleRotationFollowing"><Icon name="cursor" :size="17" /></button>
            </div>
            <div class="stage-tool-actions"><button class="stage-icon" aria-label="Zoom out" :disabled="previewSize !== null || zoom <= .65" @click="zoom = Math.max(.65, zoom - .1)"><Icon name="minus" :size="16" /></button><span class="zoom-label">{{ previewSize ? `${previewSize} px` : `${Math.round(zoom * 100)}%` }}</span><button class="stage-icon" aria-label="Zoom in" :disabled="previewSize !== null || zoom >= 1.4" @click="zoom = Math.min(1.4, zoom + .1)"><Icon name="plus" :size="16" /></button><button class="stage-icon photo-button" aria-label="Export this pose as an image" title="Photo mode" @click="exportTab = 'image'; tab = 'export'; playing = false"><Icon name="camera" /></button></div>
          </div>
          <span v-if="previewSize" class="actual-size-label">{{ previewSize }} × {{ previewSize }} px · actual size</span>
        </div>
        </div>

        <div class="sequence-card">
        <div class="size-strip">
          <div class="size-copy"><span>Preview size</span><span class="size-copy-sub">Tap to view in context</span></div>
          <div class="size-samples" aria-label="Preview sizes"><button class="size-preset fit-preset" :class="{ active: previewSize === null }" :aria-pressed="previewSize === null" @click="previewSize = null"><Icon name="expand" :size="15" />Fit</button><button v-for="size in [12, 16, 24, 48, 96]" :key="size" class="size-preset" :class="{ active: previewSize === size }" :aria-label="`Preview at ${size} pixels`" :aria-pressed="previewSize === size" @click="previewSize = size">{{ size }}<span>px</span></button></div>
        </div>

        <section class="timeline" aria-label="Animation sequence">
          <div class="timeline-top">
            <div class="timeline-title"><Icon :name="mode === 'expression' ? 'face' : 'animation'" :size="17" /><strong>{{ currentLabel }}</strong><span>{{ mode === 'expression' ? `${expression.beats.length} beats` : `${animation.steps.length} ${animation.steps.length === 1 ? 'expression' : 'expressions'}` }}</span></div>
            <div class="playback"><button class="icon-button" aria-label="Restart playback" @click="time = 0; frozenBeat = false"><Icon name="reset" :size="16" /></button><button class="play-button" :aria-label="playing ? 'Pause' : 'Play'" @click="togglePlay"><Icon :name="playing ? 'pause' : 'play'" :size="18" /></button><span class="time-readout">{{ time.toFixed(1) }} <span>/ {{ duration.toFixed(1) }}s</span></span><Icon name="loop" :size="16" /></div>
          </div>
          <div class="scrubber"><input aria-label="Playback position" type="range" min="0" :max="duration" step="0.01" :value="time" @input="seek" /><div class="time-ticks"><span>0s</span><span>{{ (duration / 4).toFixed(1) }}</span><span>{{ (duration / 2).toFixed(1) }}</span><span>{{ (duration * .75).toFixed(1) }}</span><span>{{ duration.toFixed(1) }}s</span></div></div>
          <div class="sequence-track" v-if="mode === 'expression'">
            <div v-for="(item, index) in expression.beats" :key="item.id" :class="['sequence-beat', { active: sample.beatIndex === index }]" draggable="true" @dragstart="dragIndex = index" @dragover.prevent @drop.prevent="dropAt(index)">
              <button class="beat-main" @click="pickBeat(index)"><Thumb :character="character" :pose="item.pose" :size="52" /><span><strong>{{ item.name }}</strong><small>Beat {{ index + 1 }}</small></span></button>
              <div class="beat-controls"><label><input :aria-label="`${item.name} duration`" type="number" min="0.2" max="15" step="0.1" v-model.number="item.duration" @change="item.duration = Math.min(15, Math.max(.2, Number(item.duration) || 1))" /><span>s</span></label><button class="mini-icon" :disabled="index === 0" aria-label="Move beat earlier" @click="moveItem(index, -1)"><Icon name="left" :size="12" /></button><button class="mini-icon" :disabled="index === expression.beats.length - 1" aria-label="Move beat later" @click="moveItem(index, 1)"><Icon name="right" :size="12" /></button><button class="mini-icon remove-beat" :disabled="expression.beats.length === 1" aria-label="Remove beat" @click="removeBeat(index)"><Icon name="close" :size="12" /></button></div>
            </div>
            <button class="add-beat" :disabled="expression.beats.length >= 4" @click="addBeat"><Icon name="plus" :size="18" /><span>Add beat</span></button>
          </div>
          <div class="sequence-track" v-else>
            <div v-for="(item, index) in animation.steps" :key="item.id" :class="['sequence-beat', { active: sample.stepIndex === index }]" draggable="true" @dragstart="dragIndex = index" @dragover.prevent @drop.prevent="dropAt(index)">
              <button class="beat-main" @click="time = animation.steps.slice(0, index).reduce((n, s) => n + s.duration, 0) / character.speed; playing = false; frozenBeat = false"><Thumb :character="character" :pose="stepExpression(item.expressionId).beats[0]!.pose" :size="52" /><span><strong>{{ stepExpression(item.expressionId).name }}</strong><small>Expression {{ index + 1 }}</small></span></button>
              <div class="beat-controls"><label><input :aria-label="`Expression ${index + 1} duration`" type="number" min="0.2" max="30" step="0.1" v-model.number="item.duration" @change="item.duration = Math.min(30, Math.max(.2, Number(item.duration) || 1))" /><span>s</span></label><button class="mini-icon" :disabled="index === 0" aria-label="Move expression earlier" @click="moveItem(index, -1)"><Icon name="left" :size="12" /></button><button class="mini-icon" :disabled="index === animation.steps.length - 1" aria-label="Move expression later" @click="moveItem(index, 1)"><Icon name="right" :size="12" /></button><button class="mini-icon remove-beat" :disabled="animation.steps.length === 1" aria-label="Remove expression" @click="removeStep(index)"><Icon name="close" :size="12" /></button></div>
            </div>
            <button class="add-beat" :disabled="animation.steps.length >= 64" @click="openExpressionPicker"><Icon name="plus" :size="18" /><span>Add expression</span></button>
          </div>
        </section>
        </div>
      </section>

      <aside class="inspector" aria-label="Character controls">
        <nav class="inspector-tabs" aria-label="Studio tools"><button v-for="item in tabs" :key="item.id" :class="{ active: tab === item.id }" :aria-current="tab === item.id ? 'page' : undefined" @click="tab = item.id"><Icon :name="item.icon" :size="19" /><span>{{ item.label }}</span></button></nav>
        <div ref="inspectorScroll" class="inspector-scroll">
          <template v-if="tab === 'character'">
            <div class="panel-heading"><div><h1>{{ character.name }}</h1><p>One simple shape. Your character.</p></div><button class="icon-button" title="Duplicate character" aria-label="Duplicate this character" @click="duplicateCharacter"><Icon name="copy" /></button></div>
            <div class="control-section"><label class="field-label" for="character-name">Name</label><input id="character-name" class="text-field" maxlength="60" v-model="character.name" />
              <div class="section-heading"><h2>Body shape</h2></div><div class="shape-options"><button v-for="shape in SHAPES" :key="shape.id" :class="['shape-option', { active: character.shape === shape.id }]" :aria-pressed="character.shape === shape.id" @click="character.shape = shape.id"><Thumb :character="characterForShape(shape.id)" :size="62" /><strong>{{ shape.name }}</strong><span>{{ shape.ratio }}</span></button></div>
            </div>
            <div class="control-section"><div class="section-heading"><h2>Body color</h2><label class="switch-label">Gradient<input type="checkbox" v-model="character.gradient" role="switch" /><span class="switch-track"></span></label></div><div class="color-fields"><label class="color-field"><input aria-label="Primary body color" type="color" v-model="character.color" /><span>{{ character.color }}</span></label><label v-if="character.gradient" class="color-field"><input aria-label="Second body color" type="color" v-model="character.color2" /><span>{{ character.color2 }}</span></label></div><div class="palette-row"><button v-for="(colors, i) in PALETTES" :key="i" class="palette-swatch" :style="{ background: `linear-gradient(145deg, ${colors[0]}, ${colors[1]})` }" :aria-label="`Apply palette ${i + 1}`" @click="applyPalette(colors)"><Icon v-if="character.color === colors[0]" name="check" :size="14" /></button></div><label v-if="character.gradient" class="range-control"><span>Gradient direction<output>{{ character.gradientAngle }}°</output></span><input aria-label="Gradient direction" type="range" min="-180" max="180" step="1" v-model.number="character.gradientAngle" /></label><label class="toggle-row"><span><strong>Toon shading</strong><small>Crisp shadows, subtle depth</small></span><input type="checkbox" v-model="character.toon" role="switch" /><span class="switch-track"></span></label><label v-if="character.toon" class="toggle-row"><span><strong>Candle light</strong><small>One rounded shadow, following the body</small></span><input type="checkbox" v-model="character.candleLight" role="switch" /><span class="switch-track"></span></label></div>
            <div class="control-section"><div class="section-heading"><h2>Face & surface</h2></div><label class="color-field ink-field"><span>Face color</span><input aria-label="Face color" type="color" v-model="character.eyeColor" /><span>{{ character.eyeColor }}</span></label><label class="toggle-row"><span><strong>White eye dots</strong><small>A small highlight inside each eye</small></span><input type="checkbox" v-model="character.iris" role="switch" /><span class="switch-track"></span></label><label class="toggle-row"><span><strong>Elevate the face</strong><small>Lift the features above the body</small></span><input type="checkbox" v-model="character.elevated" role="switch" /><span class="switch-track"></span></label><label v-if="character.elevated" class="range-control"><span>Separation<output>{{ Math.round(character.elevation * 100) }}%</output></span><input aria-label="Face separation" type="range" min="0.005" max="0.15" step="0.005" v-model.number="character.elevation" /></label><label class="toggle-row"><span>Ground shadow</span><input type="checkbox" v-model="character.shadow" role="switch" /><span class="switch-track"></span></label></div>
            <div class="control-section detail-guide"><h2>Responsive detail</h2><p><strong>Above 24 px</strong>Full face and expression details</p><p><strong>16–24 px</strong>Eyes carry the expression</p><p><strong>Below 16 px</strong>Color and shape only</p></div>
          </template>

          <template v-if="tab === 'expressions' && !editing">
            <div class="panel-heading"><div><h1>Expressions</h1><p>Small gestures. Plenty of personality.</p></div><span class="count-badge">{{ project.expressions.length }}</span></div>
            <div class="library-actions library-actions-top"><span>Double-click to edit</span><button class="text-button" @click="editExpression(expression)"><Icon name="tune" :size="15" />Edit selected</button></div>
            <div class="expression-grid"><button v-for="e in project.expressions" :key="e.id" :class="['expression-card', { active: selectedExpression === e.id && mode === 'expression' }]" :aria-pressed="selectedExpression === e.id && mode === 'expression'" @click="selectExpression(e)" @dblclick="editExpression(e)"><div class="expression-preview"><Thumb :character="character" :pose="e.beats[Math.min(1, e.beats.length - 1)]!.pose" :size="92" /></div><div class="expression-card-label"><strong>{{ e.name }}</strong><span>{{ e.beats.length }} beats</span></div></button></div>
            <div class="library-actions"><button class="text-button" @click="newExpression"><Icon name="plus" :size="15" />New expression</button><button v-if="missingPresets.length" class="text-button" @click="addNewPresets">Add new presets</button></div>
            <details class="control-section" open><summary class="face-library-summary">Face style library</summary><div class="face-set-tabs"><button v-for="set in FACE_SETS" :key="set.id" :class="{ active: activeFaceSet === set.id }" :aria-pressed="activeFaceSet === set.id" @click="activeFaceSet = set.id">{{ set.name }}</button></div><p class="face-library-description">{{ faceSet.description }} Choose a face to create an expression.</p><div class="face-presets"><button v-for="preset in faceSet.presets" :key="preset.id" :aria-label="`Create ${preset.name} expression`" @click="createFaceExpression(preset)"><Thumb :character="{ ...character, trueFront: true }" :pose="facePose(faceSet, preset)" :size="60" /><span>{{ preset.name }}</span></button></div></details>
          </template>

          <template v-if="tab === 'expressions' && editing">
            <div class="editor-heading"><button class="icon-button" aria-label="Back to expressions" @click="editing = false; frozenBeat = false"><Icon name="back" /></button><div><h1>Edit expression</h1><p>{{ expression.name }} · Beat {{ selectedBeat + 1 }}</p></div><button class="icon-button" title="Duplicate expression" aria-label="Duplicate expression" @click="duplicateExpression"><Icon name="copy" /></button></div>
            <div class="control-section"><label class="field-label" for="expression-name">Expression name</label><input id="expression-name" class="text-field" maxlength="60" v-model="expression.name" /><div class="beat-pills"><button v-for="(item, index) in expression.beats" :key="item.id" :class="{ active: index === selectedBeat }" @click="pickBeat(index)">{{ index + 1 }}<span>{{ item.name }}</span></button></div><label class="field-label" for="beat-name">Beat name</label><input id="beat-name" class="text-field" maxlength="40" v-model="beat.name" /></div>
            <div class="control-section"><div class="section-heading"><h2>Face styles</h2></div><div class="face-set-tabs"><button v-for="set in FACE_SETS" :key="set.id" :class="{ active: activeFaceSet === set.id }" :aria-pressed="activeFaceSet === set.id" @click="activeFaceSet = set.id">{{ set.name }}</button></div><p class="face-library-description">{{ faceSet.description }}</p><div class="face-presets"><button v-for="preset in faceSet.presets" :key="preset.id" :aria-label="`Apply ${preset.name} face`" @click="applyFace(preset)"><Thumb :character="{ ...character, trueFront: true }" :pose="facePose(faceSet, preset)" :size="60" /><span>{{ preset.name }}</span></button></div></div>
            <div class="control-section"><div class="section-heading"><h2>Eyes</h2></div><div class="option-chips"><button v-for="eye in EYES" :key="eye" :class="{ active: beat.pose.eye === eye }" @click="beat.pose.eye = eye; playing = false; frozenBeat = true">{{ eyeLabels[eye] }}</button></div><label class="toggle-row compact"><span>White eye dots · eyes +20%</span><input type="checkbox" role="switch" v-model="character.iris" /><span class="switch-track"></span></label><label class="toggle-row compact"><span>Cheek cutouts</span><input type="checkbox" role="switch" v-model="beat.pose.cheeks" /><span class="switch-track"></span></label><label class="toggle-row compact"><span>Link eye sizes</span><input type="checkbox" role="switch" v-model="linkedEyes" /><span class="switch-track"></span></label><div class="sliders"><label v-for="control in numberControls.slice(0, 10)" :key="control.key" class="range-control"><span>{{ control.label }}<output>{{ Number(beat.pose[control.key]).toFixed(control.step === 1 ? 0 : 2) }}</output></span><input :aria-label="control.label" type="range" :min="control.min" :max="control.max" :step="control.step" :value="beat.pose[control.key]" @input="updatePose(control.key, $event)" /></label></div></div>
            <div class="control-section"><div class="section-heading"><h2>Eye placement & rotation</h2></div><label class="toggle-row compact"><span>Mirror eye adjustments</span><input type="checkbox" role="switch" v-model="mirroredEyes" /><span class="switch-track"></span></label><p class="panel-hint">Move and turn each eye independently, or mirror adjustments across the face.</p><div class="sliders"><label v-for="control in eyePlacementControls" :key="control.key" class="range-control"><span>{{ control.label }}<output>{{ beat.pose[control.key] }}{{ control.key.endsWith('Rotation') ? '°' : '' }}</output></span><input :aria-label="control.label" type="range" :min="control.min" :max="control.max" :step="control.step" :value="beat.pose[control.key]" @input="updatePose(control.key, $event)" /></label></div></div>
            <div class="control-section"><div class="section-heading"><h2>Brows & blush</h2></div><div class="option-chips"><button v-for="brow in (['none','raised','worried','angry'] as const)" :key="brow" :class="{ active: beat.pose.brows === brow }" @click="beat.pose.brows = brow; playing = false; frozenBeat = true">{{ brow.charAt(0).toUpperCase() + brow.slice(1) }}</button></div><label class="range-control"><span>Blush<output>{{ Math.round(beat.pose.blush * 100) }}%</output></span><input aria-label="Blush" type="range" min="0" max="1" step="0.05" :value="beat.pose.blush" @input="updatePose('blush', $event)" /></label></div>
            <div class="control-section"><div class="section-heading"><h2>Mouth</h2></div><div class="option-chips"><button v-for="mouth in MOUTHS" :key="mouth" :class="{ active: beat.pose.mouth === mouth }" @click="beat.pose.mouth = mouth; playing = false; frozenBeat = true">{{ mouthLabels[mouth] }}</button></div><label v-for="control in numberControls.slice(10)" :key="control.key" class="range-control"><span>{{ control.label }}<output>{{ Number(beat.pose[control.key]).toFixed(2) }}</output></span><input :aria-label="control.label" type="range" :min="control.min" :max="control.max" :step="control.step" :value="beat.pose[control.key]" @input="updatePose(control.key, $event)" /></label><div class="inline-checks"><label><input type="checkbox" v-model="beat.pose.tongue" />Tongue</label><label><input type="checkbox" v-model="beat.pose.teeth" />Teeth</label><label><input type="checkbox" v-model="beat.pose.drool" />Drool</label><label><input type="checkbox" v-model="beat.pose.tears" />Tears</label></div></div>
            <div class="control-section"><div class="section-heading"><h2>Pose & props</h2></div><label v-for="control in bodyControls" :key="control.key" class="range-control"><span>{{ control.label }}<output>{{ Number(beat.pose[control.key]).toFixed(control.step === 1 ? 0 : 2) }}</output></span><input :aria-label="control.label" type="range" :min="control.min" :max="control.max" :step="control.step" :value="beat.pose[control.key]" @input="updatePose(control.key, $event)" /></label><label class="field-label" for="prop-select">Expression detail</label><select id="prop-select" class="text-field" v-model="beat.pose.prop"><option v-for="prop in PROPS" :key="prop" :value="prop">{{ prop === 'zzz' ? 'Sleep marks · Zzz' : prop.charAt(0).toUpperCase() + prop.slice(1) }}</option></select><button class="text-button reset-beat" @click="beat.pose = clone(BASE_POSE)"><Icon name="reset" :size="14" />Reset this beat</button></div>
          </template>

          <template v-if="tab === 'animations'">
            <div class="panel-heading"><div><h1>Animations</h1><p>Expressions, arranged into a loop.</p></div><span class="count-badge">{{ project.animations.length }}</span></div>
            <div class="control-section animation-editor"><div class="section-heading"><h2>Selected animation</h2><button class="icon-button" :disabled="project.animations.length <= 1" :title="project.animations.length <= 1 ? 'Keep at least one animation' : 'Delete animation · Undo is available'" aria-label="Delete animation" @click="deleteAnimation"><Icon name="trash" :size="17" /></button></div><label class="field-label" for="animation-name">Name</label><input ref="animationName" id="animation-name" class="text-field" v-model="animation.name" maxlength="60" /><label class="toggle-row"><span>Loop continuously</span><input type="checkbox" role="switch" v-model="animation.loop" /><span class="switch-track"></span></label><button class="button secondary full" :disabled="animation.steps.length >= 64" @click="openExpressionPicker"><Icon name="plus" :size="16" />Add expression</button><p class="panel-hint">{{ animation.steps.length }}/64 expressions. Drag sequence blocks to reorder.</p></div>
            <div class="animation-list"><button v-for="a in project.animations" :key="a.id" :class="['animation-card', { active: a.id === selectedAnimation && mode === 'animation' }]" @click="selectAnimation(a)"><Thumb :character="character" :pose="stepExpression(a.steps[0]!.expressionId).beats[0]!.pose" :size="54" /><span><strong>{{ a.name }}</strong><small>{{ a.steps.length }} {{ a.steps.length === 1 ? 'expression' : 'expressions' }} · {{ (animationDuration(a) / character.speed).toFixed(1) }}s</small></span><Icon name="play" :size="16" /></button></div><button class="text-button new-animation" @click="newAnimation"><Icon name="plus" :size="16" />New animation</button>

          </template>

          <div v-if="(tab === 'expressions' && !editing) || tab === 'animations'" class="control-section motion-section"><div class="section-heading"><h2>Motion</h2><Icon name="tune" :size="16" /></div><label class="range-control"><span>Playback speed<output>{{ character.speed.toFixed(2) }}×</output></span><input aria-label="Playback speed" type="range" min="0.25" max="2" step="0.05" v-model.number="character.speed" /></label><label class="range-control"><span>Body movement<output>{{ Math.round(character.motion * 100) }}%</output></span><input aria-label="Body movement" type="range" min="0" max="1" step="0.05" v-model.number="character.motion" /></label><label class="toggle-row compact"><span>Natural blinking</span><input type="checkbox" role="switch" v-model="character.blink" /><span class="switch-track"></span></label><label v-if="character.blink" class="range-control"><span>Blink interval<output>~{{ character.blinkInterval.toFixed(1) }}s</output></span><input aria-label="Blink interval" type="range" min="1" max="10" step="0.2" v-model.number="character.blinkInterval" /></label><label class="toggle-row compact"><span>Eyes follow cursor</span><input type="checkbox" role="switch" v-model="character.followCursor" /><span class="switch-track"></span></label><label class="toggle-row compact"><span>Character follows cursor</span><input type="checkbox" role="switch" :checked="character.followRotation" @change="toggleRotationFollowing" /><span class="switch-track"></span></label></div>

          <template v-if="tab === 'export'">
            <div class="panel-heading"><div><h1>Export</h1><p>Bring {{ character.name }} into your world.</p></div><Thumb :character="character" :size="54" /></div>
            <div class="export-tabs"><button v-for="item in (['app','image','animation','project'] as const)" :key="item" :class="{ active: exportTab === item }" @click="exportTab = item">{{ item === 'app' ? 'In app' : item.charAt(0).toUpperCase() + item.slice(1) }}</button></div>
            <template v-if="exportTab === 'app'"><div class="control-section"><div class="section-heading"><h2>Integration</h2></div><div class="integration-options"><button :class="{ active: appFormat === 'react' }" @click="appFormat = 'react'"><Icon name="code" /><strong>React</strong><small>TypeScript component</small></button><button :class="{ active: appFormat === 'javascript' }" @click="appFormat = 'javascript'"><Icon name="code" /><strong>JavaScript</strong><small>ES module</small></button></div></div><div class="control-section"><div class="section-heading"><h2>Animations to include</h2><button class="text-button" @click="selectedExports = selectedExports.length === project.animations.length ? [] : project.animations.map(a => a.id)">{{ selectedExports.length === project.animations.length ? 'Clear' : 'Select all' }}</button></div><div class="export-checks"><label v-for="a in project.animations" :key="a.id"><input type="checkbox" :value="a.id" v-model="selectedExports" /><span>{{ a.name }}</span><small>{{ (animationDuration(a) / character.speed).toFixed(1) }}s</small></label></div></div><div class="control-section"><div class="section-heading"><h2>Quick start</h2><button class="icon-button" aria-label="Copy integration example" @click="copy(example)"><Icon name="copy" :size="15" /></button></div><pre class="code-example"><code>{{ example }}</code></pre><p class="panel-hint">The definition stores your choices. The included runtime handles 3D rendering, playback, and responsive detail.</p><button class="text-button" @click="copy(setupInstructions(exportDefinition, appFormat === 'react'), 'Setup instructions copied.')"><Icon name="copy" :size="14" />Copy setup instructions</button></div><div class="export-actions"><button class="button primary full" :disabled="!selectedExports.length || busy" @click="exportDemo"><Icon name="download" :size="17" />{{ busy ? 'Preparing…' : `Download ${appFormat === 'react' ? 'React' : 'JavaScript'} example` }}</button><div class="two-buttons"><button class="button secondary" :disabled="!selectedExports.length || busy" @click="exportJson">Definition JSON</button><button class="button secondary" :disabled="!selectedExports.length || busy" @click="copy(JSON.stringify(exportDefinition, null, 2))"><Icon name="copy" :size="15" />Copy JSON</button></div><p class="panel-hint">{{ selectedExports.length }} animations selected · includes a runnable demo</p></div></template>
            <template v-if="exportTab === 'image' || exportTab === 'animation'">
              <div class="control-section" v-if="exportTab === 'animation'"><label class="field-label" for="export-animation">Animation</label><select id="export-animation" class="text-field" :value="selectedAnimation" @change="selectAnimation(project.animations.find(a => a.id === ($event.target as HTMLSelectElement).value)!)"><option v-for="a in project.animations" :key="a.id" :value="a.id">{{ a.name }}</option></select><label class="field-label spaced" for="media-format">Format</label><select id="media-format" class="text-field" v-model="mediaFormat"><option value="mp4">MP4 · social & marketing</option><option value="webm">WebM · supports transparency</option><option value="gif">GIF · small looping assets</option></select><p v-if="mediaFormat === 'gif'" class="panel-hint">GIF uses 20 fps, up to 512 px, and 256 colors.</p></div>
              <div v-else class="photo-note"><Icon name="camera" :size="18" /><span>Exports the current pose and camera angle as a PNG.</span></div>
              <div class="control-section"><div class="section-heading"><h2>Canvas</h2></div><label class="field-label" for="export-size">Size</label><select id="export-size" class="text-field" v-model="exportSize"><option value="square">Square · 1080 × 1080</option><option value="portrait">Portrait · 1080 × 1350</option><option value="story">Story · 1080 × 1920</option><option value="landscape">Landscape · 1920 × 1080</option><option value="icon">App icon · 128 × 128</option><option value="custom">Custom</option></select><div class="dimension-fields"><label>Width<input type="number" class="text-field" min="1" max="2048" v-model.number="width" @input="exportSize = 'custom'" /></label><span>×</span><label>Height<input type="number" class="text-field" min="1" max="2048" v-model.number="height" @input="exportSize = 'custom'" /></label></div><label class="range-control"><span>Framing<output>{{ Math.round(zoom * 100) }}%</output></span><input aria-label="Export framing" type="range" min="0.65" max="1.4" step="0.01" v-model.number="zoom" /></label><label class="toggle-row" v-if="exportTab === 'image' || mediaFormat !== 'mp4'"><span>Transparent background</span><input type="checkbox" role="switch" v-model="transparent" /><span class="switch-track"></span></label><label v-if="!transparent || (exportTab === 'animation' && mediaFormat === 'mp4')" class="color-field ink-field"><span>Background</span><input type="color" aria-label="Export background color" v-model="exportBackground" /><span>{{ exportBackground }}</span></label><p v-if="exportTab === 'animation' && mediaFormat === 'mp4'" class="panel-hint">MP4 uses a solid background. Choose WebM for transparency.</p></div>
              <div v-if="exportTab === 'animation'" class="control-section"><div class="section-heading"><h2>Playback</h2></div><div class="dimension-fields"><label>Frame rate<select class="text-field" v-model.number="fps"><option :value="20">20 fps</option><option v-if="mediaFormat !== 'gif'" :value="24">24 fps</option><option v-if="mediaFormat !== 'gif'" :value="30">30 fps</option><option v-if="mediaFormat !== 'gif'" :value="60">60 fps</option></select></label><label>Repetitions<input class="text-field" type="number" min="1" max="8" v-model.number="repetitions" /></label></div><div class="export-duration"><span>Total duration</span><strong>{{ exportDuration.toFixed(1) }} seconds</strong></div></div>
              <p v-if="exportTab === 'animation' && (character.followCursor || character.followRotation)" class="panel-hint">Rendered loops use a centered cursor. App exports keep live cursor following.</p><div class="export-actions"><button class="button primary full" :disabled="busy" @click="exportMedia"><Icon name="download" :size="17" />{{ busy ? `Rendering ${Math.round(progress * 100)}%` : `Download ${exportTab === 'image' ? 'PNG' : mediaFormat.toUpperCase()}` }}</button><template v-if="busy"><progress :value="progress" max="1" aria-label="Export progress"></progress><button class="text-button" @click="controller?.abort()">Cancel export</button></template><p class="panel-hint">{{ width }} × {{ height }} px · current character and orientation</p></div>
            </template>
            <template v-if="exportTab === 'project'"><div class="control-section"><label class="field-label" for="project-name">Project name</label><input class="text-field" id="project-name" v-model="project.name" maxlength="80" /><div class="project-summary"><Icon name="folder" :size="28" /><strong>{{ project.characters.length }} characters</strong><span>{{ project.expressions.length }} expressions · {{ project.animations.length }} animations</span></div><p class="panel-hint">Keep a backup or move your studio to another browser. Includes every character, expression, and animation.</p></div><div class="export-actions"><button class="button primary full" @click="saveProject"><Icon name="download" :size="17" />Save studio project</button><button class="button secondary full" @click="importInput?.click()"><Icon name="upload" :size="17" />Import project</button></div></template>
          </template>
        </div>
        <div v-if="editing && tab === 'expressions'" class="editor-footer"><span><Icon name="check" :size="14" />Changes save automatically</span><button class="button primary" @click="editing = false; frozenBeat = false">Done</button></div>
        <div v-else class="inspector-footer"><span class="saved-dot"></span>Made to move, wherever you go.</div>
      </aside>
    </main>
    <dialog ref="expressionPicker" class="expression-picker" aria-labelledby="expression-picker-title" @click="($event.target === expressionPicker) && expressionPicker?.close()">
      <div class="picker-heading"><div><h2 id="expression-picker-title">Add an expression</h2><p>Choose the next moment for {{ animation.name }}.</p></div><button class="icon-button" aria-label="Close expression picker" @click="expressionPicker?.close()"><Icon name="close" /></button></div>
      <div class="picker-grid"><button v-for="e in project.expressions" :key="e.id" class="picker-expression" @click="addStep(e.id)"><Thumb :character="character" :pose="e.beats[Math.min(1, e.beats.length - 1)]!.pose" :size="78" /><strong>{{ e.name }}</strong><small>{{ expressionDuration(e).toFixed(1) }}s</small><Icon name="plus" :size="16" /></button></div>
    </dialog>
    <div v-if="notice" class="toast" role="status"><span>{{ notice }}</span><button class="icon-button" aria-label="Dismiss message" @click="notice = ''"><Icon name="close" :size="16" /></button></div>
  </div>
</template>
