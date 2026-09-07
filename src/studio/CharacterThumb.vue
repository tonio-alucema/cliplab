<script setup lang="ts">
import { computed } from 'vue'
import { thumbnail } from './renderer'
import { BASE_POSE, type Character, type Pose } from './model'
const props = withDefaults(defineProps<{ character: Character; pose?: Pose; size?: number }>(), { size: 72 })
const source = computed(() => thumbnail(props.character, props.pose ?? BASE_POSE, props.size))
</script>
<template><img v-if="source" :src="source" alt="" :width="size" :height="size" class="character-thumb" draggable="false" /><span v-else class="thumb-fallback" aria-hidden="true">·</span></template>
