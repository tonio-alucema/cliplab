<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { Character } from './model'
import Thumb from './CharacterThumb.vue'
import Icon from './StudioIcon.vue'
const props = defineProps<{ characters: Character[]; selected: string }>()
const emit = defineEmits<{ select: [id: string]; rename: [id: string, name: string]; remove: [id: string]; reorder: [id: string, target: string, after: boolean]; duplicate: [] }>()
const menu = ref<string | null>(null), renaming = ref<string | null>(null), draft = ref('')
const dragging = ref<string | null>(null), over = ref<string | null>(null), after = ref(false)
const menuPosition = ref({ left: '0px', top: '0px' })
let trigger: HTMLButtonElement | null = null
function open(c: Character, event: MouseEvent) {
  trigger = event.currentTarget as HTMLButtonElement
  const rect = trigger.getBoundingClientRect()
  menuPosition.value = { left: `${Math.max(8, Math.min(rect.left, window.innerWidth - 184))}px`, top: `${Math.min(rect.bottom + 6, window.innerHeight - 184)}px` }
  menu.value = c.id
  nextTick(() => document.querySelector<HTMLButtonElement>('.character-options-menu button')?.focus())
}
function close() { menu.value = null; trigger?.focus() }
function rename() {
  const c = props.characters.find(c => c.id === menu.value)
  if (!c) return
  renaming.value = c.id; draft.value = c.name; menu.value = null
  nextTick(() => { const input = document.querySelector<HTMLInputElement>('.character-name-input'); input?.focus(); input?.select() })
}
function finishRename(commit: boolean) {
  const id = renaming.value; renaming.value = null
  if (commit && id && draft.value.trim()) emit('rename', id, draft.value.trim())
}
function remove() { const id = menu.value; close(); if (id && props.characters.length > 1) emit('remove', id) }
function moveBy(delta: number) {
  const id = menu.value, index = props.characters.findIndex(c => c.id === id), target = props.characters[index + delta]
  close(); if (id && target) emit('reorder', id, target.id, delta > 0)
}
function start(c: Character, event: DragEvent) {
  if (renaming.value) { event.preventDefault(); return }
  menu.value = null; dragging.value = c.id
  if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', c.id) }
}
function hover(c: Character, event: DragEvent) {
  if (!dragging.value || dragging.value === c.id) return
  event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  over.value = c.id; after.value = event.clientX > rect.left + rect.width / 2
}
function end() { dragging.value = null; over.value = null }
function drop(c: Character, event: DragEvent) {
  event.preventDefault()
  if (dragging.value && dragging.value !== c.id) emit('reorder', dragging.value, c.id, after.value)
  end()
}
function menuKey(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); close(); return }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const buttons = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus()
}
</script>
<template>
  <div class="character-tabs" aria-label="Characters">
    <div v-for="c in characters" :key="c.id" class="saved-character" :class="{ active: c.id === selected, dragging: dragging === c.id, 'drop-before': over === c.id && !after, 'drop-after': over === c.id && after }" :draggable="renaming !== c.id" @dragstart="start(c, $event)" @dragover="hover(c, $event)" @drop="drop(c, $event)" @dragend="end">
      <input v-if="renaming === c.id" v-model="draft" class="character-name-input" aria-label="Character name" maxlength="80" @keydown.enter.prevent="finishRename(true)" @keydown.esc.prevent="finishRename(false)" @blur="finishRename(true)" />
      <button v-else class="character-tab" :aria-pressed="c.id === selected" title="Drag to reorder" @click="emit('select', c.id)"><Thumb :character="c" :size="38" /><span>{{ c.name }}</span></button>
      <button class="character-options" :aria-label="`Options for ${c.name}`" aria-haspopup="menu" :aria-expanded="menu === c.id" @click="open(c, $event)"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="13" cy="8" r="1.2"/></svg></button>
    </div>
    <button class="icon-button add-character" title="Duplicate character" aria-label="Duplicate character" @click="emit('duplicate')"><Icon name="plus" :size="17" /></button>
  </div>
  <Teleport to="body">
    <div v-if="menu" class="character-menu-backdrop" @pointerdown.self="close" @keydown.esc="close">
      <div class="character-options-menu" role="menu" aria-label="Character options" :style="menuPosition" @keydown="menuKey">
        <button role="menuitem" @click="rename">Rename</button>
        <button role="menuitem" :disabled="characters[0]?.id === menu" @click="moveBy(-1)">Move left</button>
        <button role="menuitem" :disabled="characters[characters.length - 1]?.id === menu" @click="moveBy(1)">Move right</button>
        <button role="menuitem" :disabled="characters.length === 1" :title="characters.length === 1 ? 'Keep at least one character' : 'Delete character · Undo available'" @click="remove">Delete</button>
      </div>
    </div>
  </Teleport>
</template>
<style scoped>
.saved-character { display:flex;align-items:center;flex-shrink:0;border:1px solid transparent;border-radius:20px; }
.saved-character.active { background:#ffffff09;border-color:#ffffff18; }
.saved-character.dragging { opacity:.4; }
.saved-character.drop-before { border-left-color:#eee;box-shadow:-2px 0 #eee; }
.saved-character.drop-after { border-right-color:#eee;box-shadow:2px 0 #eee; }
.saved-character .character-tab { padding-right:3px;cursor:grab; }
.character-options { display:grid;place-items:center;width:26px;height:28px;margin-right:5px;border:0;border-radius:50%;background:transparent;color:#aaa;cursor:pointer; }
.character-options:hover,.character-options:focus-visible { color:#fff;background:#ffffff15; }
.character-name-input { width:130px;margin:4px 6px;padding:5px 8px;background:#191919;border:1px solid #777;border-radius:6px;color:#eee;font:inherit; }
.character-menu-backdrop { position:fixed;inset:0;z-index:1000; }
.character-options-menu { position:fixed;width:176px;padding:5px;border:1px solid #ffffff22;border-radius:10px;background:#252525;box-shadow:0 8px 28px #0006;color:#eee; }
.character-options-menu button { display:block;width:100%;padding:9px 10px;border:0;border-radius:6px;background:transparent;color:inherit;text-align:left;font:inherit;font-size:13px;cursor:pointer; }
.character-options-menu button:hover,.character-options-menu button:focus-visible { background:#ffffff12;outline:none; }
.character-options-menu button:disabled { opacity:.35;cursor:default; }
.character-options-menu button:last-child { border-top:1px solid #ffffff14;margin-top:4px; }
</style>
