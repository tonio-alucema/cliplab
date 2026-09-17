<script setup lang="ts">
import { nextTick, ref } from 'vue'
const props = defineProps<{ name: string; canPaste: boolean }>()
const emit = defineEmits<{ copy: []; paste: [] }>()
const open = ref(false), trigger = ref<HTMLButtonElement>(), panel = ref<HTMLElement>()
const position = ref({ left: '0px', top: '0px' })
async function show() {
  const rect = trigger.value!.getBoundingClientRect()
  position.value = { left: `${Math.max(8, Math.min(rect.right - 170, innerWidth - 178))}px`, top: `${Math.max(8, Math.min(rect.bottom + 6, innerHeight - 104))}px` }
  open.value = true; await nextTick(); panel.value?.querySelector('button')?.focus()
}
function close() { open.value = false; trigger.value?.focus() }
function action(value: 'copy' | 'paste') { close(); if (value === 'copy') emit('copy'); else if (props.canPaste) emit('paste') }
function key(event: KeyboardEvent) {
  if (event.key === 'Escape' || event.key === 'Tab') { close(); if (event.key === 'Escape') event.preventDefault(); return }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const buttons = Array.from(panel.value!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus()
}
</script>
<template>
  <button ref="trigger" class="beat-section-options" :aria-label="`${name} values menu`" aria-haspopup="menu" :aria-expanded="open" @click.stop="show" @dblclick.stop>
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true"><circle cx="4" cy="9" r="1.3"/><circle cx="9" cy="9" r="1.3"/><circle cx="14" cy="9" r="1.3"/></svg>
  </button>
  <Teleport to="body"><div v-if="open" class="beat-section-menu-backdrop" @pointerdown.self="close">
    <div ref="panel" class="beat-section-options-menu" role="menu" :aria-label="`${name} values`" :style="position" @keydown="key">
      <button role="menuitem" @click="action('copy')">Copy values</button>
      <button role="menuitem" :disabled="!canPaste" :title="canPaste ? 'Paste copied values into this beat' : `Copy ${name} values from a beat first`" @click="action('paste')">Paste values</button>
    </div>
  </div></Teleport>
</template>
<style scoped>
.beat-section-options { flex-shrink:0;display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:8px;background:#252525cc;color:#aaa;cursor:pointer; }
.beat-section-options:hover,.beat-section-options:focus-visible { background:#444;color:#fff; }
.beat-section-menu-backdrop { position:fixed;inset:0;z-index:1000; }
.beat-section-options-menu { position:fixed;width:170px;padding:5px;border:1px solid #ffffff22;border-radius:10px;background:#252525;box-shadow:0 8px 28px #0006;color:#eee; }
.beat-section-options-menu button { display:block;width:100%;padding:9px 10px;border:0;border-radius:6px;background:transparent;color:inherit;text-align:left;font:inherit;font-size:13px;cursor:pointer; }
.beat-section-options-menu button:hover,.beat-section-options-menu button:focus-visible { background:#ffffff12;outline:none; }
.beat-section-options-menu button:disabled { opacity:.35;cursor:default; }
.beat-section-options-menu button:last-child { border-top:1px solid #ffffff14;margin-top:4px; }
</style>
