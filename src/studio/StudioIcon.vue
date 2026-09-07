<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 18 })
const paths: Record<string, string> = {
  front: 'M5 3h14v18H5ZM9 10h.01M15 10h.01M9 15q3 2 6 0', lock: 'M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3', unlock: 'M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8 0M12 14v3', minus: 'M5 12h14',
  play: 'm8 5 11 7-11 7Z', pause: 'M8 5v14M16 5v14', back: 'm14 6-6 6 6 6',
  plus: 'M12 5v14M5 12h14', close: 'm6 6 12 12M6 18 18 6',
  download: 'M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5', upload: 'M12 16V4m-5 5 5-5 5 5M5 16v5h14v-5',
  copy: 'M9 9h11v11H9ZM4 15H3V3h12v1', undo: 'M8 4 3 9l5 5M3 9h11a6 6 0 0 1 0 12', redo: 'm16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12',
  body: 'M12 2a5 5 0 0 1 5 5v10a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5Z',
  face: 'M8 10h.01M16 10h.01M8 15q4 4 8 0M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
  animation: 'M4 4h16v16H4ZM4 8h16M8 4v4m8-4v4m-6 4 5 3-5 3Z',
  cursor: 'm5 3 14 10-7 1-3 7Z', reset: 'M3 4v6h6M3 10a9 9 0 1 1 1 8',
  camera: 'M3 7h5l2-3h4l2 3h5v13H3ZM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7',
  loop: 'm17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3',
  chevron: 'm8 10 4 4 4-4', trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
  check: 'm5 12 4 4L19 6', tune: 'M3 7h10m4 0h4M3 17h4m4 0h10M13 3v8M7 13v8',
  expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5', sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',
  grid: 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
  folder: 'M3 5h7l2 3h9v12H3Z', arrow: 'M4 12h16m-6-6 6 6-6 6', stop: 'M6 6h12v12H6Z',
  left: 'm14 6-6 6 6 6', right: 'm10 6 6 6-6 6', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  code: 'm8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18', info: 'M12 11v6m0-10h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20'
}
</script>
<template><svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name] ?? paths.tune" /></svg></template>
