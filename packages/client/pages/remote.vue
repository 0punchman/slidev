<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useEventListener, useLocalStorage, useWindowFocus } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useNav } from '../composables/useNav'
import { useSwipeControls } from '../composables/useSwipeControls'
import { useTimer } from '../composables/useTimer'
import { useWakeLock } from '../composables/useWakeLock'
import { slidesTitle } from '../env'
import CurrentProgressBar from '../internals/CurrentProgressBar.vue'
import IconButton from '../internals/IconButton.vue'
import NoteEditable from '../internals/NoteEditable.vue'
import NoteStatic from '../internals/NoteStatic.vue'
import QuickOverview from '../internals/QuickOverview.vue'
import SlideContainer from '../internals/SlideContainer.vue'
import SlidesShow from '../internals/SlidesShow.vue'
import { isColorSchemaConfigured, isDark, toggleDark } from '../logic/dark'
import { registerShortcuts } from '../logic/shortcuts'
import { decreasePresenterFontSize, increasePresenterFontSize, presenterNotesFontSize, toggleOverview } from '../state'

const inFocus = useWindowFocus()
const root = ref<HTMLDivElement>()
const main = ref<HTMLDivElement>()

registerShortcuts()
useSwipeControls(main)
if (__SLIDEV_FEATURE_WAKE_LOCK__)
  useWakeLock()

const {
  clicksContext,
  currentSlideNo,
  hasNext,
  hasPrev,
  next,
  prev,
  total,
} = useNav()

useHead({ title: `Remote - ${slidesTitle}` })

const { status, percentage, timer, reset, toggle } = useTimer()
const timerColor = computed(() => {
  if (status.value === 'stopped')
    return 'op50'
  if (status.value === 'paused')
    return 'text-blue6 dark:text-blue3'
  if (percentage.value > 100)
    return 'text-red6 dark:text-red3'
  if (percentage.value > 80)
    return 'text-yellow6 dark:text-yellow3'
  return 'text-green6 dark:text-green3'
})

const notesEditing = ref(false)
const previewHeight = useLocalStorage('slidev-remote-preview-height', 180)
const isResizing = ref(false)
const resizeStartY = ref(0)
const resizeStartHeight = ref(180)

const RESIZER_LIMITS = {
  min: 80,
  maxRatio: 0.7,
}

function clampPreviewHeight(height: number) {
  const max = Math.round((root.value?.clientHeight ?? window.innerHeight) * RESIZER_LIMITS.maxRatio)
  return Math.max(RESIZER_LIMITS.min, Math.min(max, Math.round(height)))
}

function onPreviewResizeStart(e: PointerEvent) {
  if (e.button !== 0)
    return
  e.preventDefault()
  resizeStartY.value = e.clientY
  resizeStartHeight.value = previewHeight.value
  isResizing.value = true
}

function stopResizing() {
  isResizing.value = false
}

useEventListener(window, 'pointermove', (e) => {
  if (!isResizing.value)
    return
  previewHeight.value = clampPreviewHeight(resizeStartHeight.value + e.clientY - resizeStartY.value)
})

useEventListener(window, 'pointerup', stopResizing)
useEventListener(window, 'pointercancel', stopResizing)
useEventListener(window, 'resize', () => {
  previewHeight.value = clampPreviewHeight(previewHeight.value)
})

const REMOTE_VIEWPORT = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
const viewportMeta = typeof document !== 'undefined'
  ? document.querySelector('meta[name="viewport"]')
  : null
const previousViewport = viewportMeta?.getAttribute('content')

onMounted(() => {
  previewHeight.value = clampPreviewHeight(previewHeight.value)
  document.documentElement.classList.add('slidev-remote-no-dblzoom')
  viewportMeta?.setAttribute('content', REMOTE_VIEWPORT)
})

onUnmounted(() => {
  document.documentElement.classList.remove('slidev-remote-no-dblzoom')
  if (previousViewport)
    viewportMeta?.setAttribute('content', previousViewport)
})
</script>

<template>
  <div ref="root" class="bg-main h-full slidev-remote flex flex-col of-hidden">
    <div
      ref="main"
      class="relative flex flex-col min-h-0 flex-none of-hidden"
      :style="{ height: `${previewHeight}px` }"
    >
      <SlideContainer
        class="p-2 lg:p-4 flex-auto"
        is-main
      >
        <SlidesShow render-context="presenter" />
      </SlideContainer>
    </div>

    <CurrentProgressBar />

    <div class="flex items-center py-1 px-2 text-base flex-none border-t border-main" :class="inFocus ? '' : 'op25'">
      <div class="flex-1 flex items-center min-w-0">
        <IconButton title="Increase font size" @click="increasePresenterFontSize">
          <div class="i-carbon:zoom-in" />
        </IconButton>
        <IconButton title="Decrease font size" @click="decreasePresenterFontSize">
          <div class="i-carbon:zoom-out" />
        </IconButton>
        <IconButton
          v-if="__DEV__"
          title="Edit Notes"
          @click="notesEditing = !notesEditing"
        >
          <div class="i-carbon:edit" />
        </IconButton>
      </div>
      <button
        type="button"
        class="preview-resizer"
        :class="{ active: isResizing }"
        role="separator"
        aria-orientation="horizontal"
        title="Resize preview height"
        @pointerdown="onPreviewResizeStart"
      >
        <div class="i-carbon:menu" />
      </button>
      <div class="flex-1 flex items-center justify-end min-w-0">
        <div class="px2 my-auto">
          <span class="text-lg">{{ currentSlideNo }}</span>
          <span class="opacity-50 text-sm"> / {{ total }}</span>
        </div>
      </div>
    </div>

    <div class="min-h-0 flex-auto of-hidden">
      <NoteEditable
        v-if="__DEV__"
        :key="`edit-${currentSlideNo}`"
        v-model:editing="notesEditing"
        :no="currentSlideNo"
        class="w-full max-w-full h-full overflow-auto p-2 lg:p-4"
        :clicks-context="clicksContext"
        :style="{ fontSize: `${presenterNotesFontSize}em` }"
      />
      <NoteStatic
        v-else
        :key="`static-${currentSlideNo}`"
        :no="currentSlideNo"
        class="w-full max-w-full h-full overflow-auto p-2 lg:p-4"
        :style="{ fontSize: `${presenterNotesFontSize}em` }"
        :clicks-context="clicksContext"
      />
    </div>

    <div
      class="flex-none flex items-center justify-center gap-5 py-1.5 px-3 select-none border-t border-main"
      :class="timerColor"
    >
      <IconButton
        :title="status === 'running' ? 'Pause timer' : 'Start timer'"
        @click="toggle"
      >
        <div v-if="status === 'running'" class="i-carbon:pause text-2xl" />
        <div v-else class="i-carbon:play text-2xl" />
      </IconButton>
      <div class="text-2xl font-mono min-w-22 text-center">
        <template v-if="timer.h">
          <span>{{ timer.h }}</span>
          <span op50>:</span>
        </template>
        <span>{{ timer.m }}</span>
        <span op50>:</span>
        <span>{{ timer.s }}</span>
      </div>
      <IconButton title="Reset timer" @click="reset">
        <div class="i-carbon:renew text-2xl" />
      </IconButton>
    </div>

    <nav class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center text-4xl p-3 text-$slidev-controls-foreground border-t border-main flex-none">
      <div class="justify-self-start text-xl">
        <IconButton
          v-if="!isColorSchemaConfigured"
          :title="isDark ? 'Switch to light mode theme' : 'Switch to dark mode theme'"
          @click="toggleDark()"
        >
          <div v-if="isDark" class="i-carbon-moon" />
          <div v-else class="i-carbon-sun" />
        </IconButton>
      </div>
      <div class="flex justify-center gap-6">
        <IconButton :disabled="!hasPrev" title="Go to previous slide" @click="prev">
          <div class="i-carbon:arrow-left" />
        </IconButton>
        <IconButton :disabled="!hasNext" title="Go to next slide" @click="next">
          <div class="i-carbon:arrow-right" />
        </IconButton>
      </div>
      <div class="justify-self-end text-xl">
        <IconButton title="Show slide overview" @click="toggleOverview()">
          <div class="i-carbon:apps" />
        </IconButton>
      </div>
    </nav>
  </div>
  <QuickOverview />
</template>

<style>
html.slidev-remote-no-dblzoom,
html.slidev-remote-no-dblzoom * {
  touch-action: manipulation;
}

html.slidev-remote-no-dblzoom .preview-resizer {
  touch-action: none;
}
</style>

<style scoped>
.slidev-remote {
  --slidev-controls-foreground: current;
  touch-action: manipulation;
}

.preview-resizer {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  min-width: 2.5rem;
  min-height: 2rem;
  padding: 0.25rem 0.75rem;
  margin: 0;
  border: 0;
  background: transparent;
  color: inherit;
  opacity: 0.45;
  cursor: row-resize;
  touch-action: none;
  user-select: none;
}

.preview-resizer.active,
.preview-resizer:hover {
  opacity: 0.85;
}
</style>
