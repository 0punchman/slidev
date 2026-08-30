<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, nextTick, ref, watch, watchEffect } from 'vue'
import { createFixedClicks } from '../composables/useClicks'
import { useNav } from '../composables/useNav'
import { CLICKS_MAX } from '../constants'
import { pathPrefix } from '../env'
import { currentOverviewPage, overviewRowCount } from '../logic/overview'
import { isScreenshotSupported } from '../logic/screenshot'
import { snapshotManager } from '../logic/snapshot'
import { breakpoints, showOverview, windowSize } from '../state'
import DrawingPreview from './DrawingPreview.vue'
import IconButton from './IconButton.vue'
import SlideContainer from './SlideContainer.vue'
import SlideWrapper from './SlideWrapper.vue'

const nav = useNav()
const { currentSlideNo, go: goSlide, isRemote, slides } = nav

function close() {
  showOverview.value = false
}

function go(page: number) {
  goSlide(page)
  close()
}

function focus(page: number) {
  if (page === currentOverviewPage.value)
    return true
  return false
}

const xs = breakpoints.smaller('xs')
const sm = breakpoints.smaller('sm')

const padding = 4 * 16 * 2
const gap = 2 * 16
const cardWidth = computed(() => {
  if (isRemote.value)
    return (windowSize.width.value - 12 * 2 - 12) / 2
  if (xs.value)
    return windowSize.width.value - padding
  else if (sm.value)
    return (windowSize.width.value - padding - gap) / 2
  return 300
})

const rowCount = computed(() => {
  return Math.floor((windowSize.width.value - padding) / (cardWidth.value + gap))
})

const keyboardBuffer = ref<string>('')
const scroller = ref<HTMLElement>()

async function captureSlidesOverview() {
  showOverview.value = false
  await snapshotManager.startCapturing(nav)
  showOverview.value = true
}

useEventListener('keypress', (e) => {
  if (!showOverview.value) {
    keyboardBuffer.value = ''
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    if (keyboardBuffer.value) {
      go(+keyboardBuffer.value)
      keyboardBuffer.value = ''
    }
    else {
      go(currentOverviewPage.value)
    }
    return
  }
  const num = Number.parseInt(e.key.replace(/\D/g, ''))
  if (Number.isNaN(num)) {
    keyboardBuffer.value = ''
    return
  }
  if (!keyboardBuffer.value && num === 0)
    return

  keyboardBuffer.value += String(num)

  // beyond the number of slides, reset
  if (+keyboardBuffer.value > slides.value.length) {
    keyboardBuffer.value = ''
    return
  }

  const extactMatch = slides.value.findIndex(i => `/${i.no}` === keyboardBuffer.value)
  if (extactMatch !== -1)
    currentOverviewPage.value = extactMatch + 1

  // When the input number is the largest at the number of digits, we go to that page directly.
  if (+keyboardBuffer.value * 10 > slides.value.length) {
    go(+keyboardBuffer.value)
    keyboardBuffer.value = ''
  }
})

watchEffect(() => {
  // Watch currentPage, make sure every time we open overview,
  // we focus on the right page.
  currentOverviewPage.value = currentSlideNo.value
  // Watch rowCount, make sure up and down shortcut work correctly.
  overviewRowCount.value = rowCount.value
})

watch(showOverview, async (open) => {
  if (!open || !isRemote.value)
    return
  await nextTick()
  requestAnimationFrame(() => {
    const el = scroller.value?.querySelector(`[data-overview-no="${currentSlideNo.value}"]`)
    el?.scrollIntoView({ block: 'center', inline: 'nearest' })
  })
})
</script>

<template>
  <Transition
    enter-active-class="duration-150 ease-out"
    enter-from-class="opacity-0 scale-102 !backdrop-blur-0px"
    leave-active-class="duration-200 ease-in"
    leave-to-class="opacity-0 scale-102 !backdrop-blur-0px"
  >
    <div
      v-if="showOverview"
      :class="isRemote
        ? 'fixed inset-0 z-modal bg-main !bg-opacity-75 flex flex-col backdrop-blur-5px select-none'
        : 'fixed left-0 right-0 top-0 h-[calc(var(--vh,1vh)*100)] z-modal bg-main !bg-opacity-75 p-16 py-20 overflow-y-auto backdrop-blur-5px select-none'"
      @click="close"
    >
      <div
        ref="scroller"
        :class="isRemote ? 'min-h-0 flex-auto overflow-y-auto px-3 py-3' : 'contents'"
      >
        <div
          class="grid w-full"
          :class="isRemote ? 'grid-cols-2 gap-3' : 'gap-y-4 gap-x-8'"
          :style="isRemote ? undefined : `grid-template-columns: repeat(auto-fit,minmax(${cardWidth}px,1fr))`"
        >
          <div
            v-for="(route, idx) of slides"
            :key="route.no"
            class="relative"
            :data-overview-no="route.no"
          >
            <div
              class="inline-block border rounded overflow-hidden bg-main hover:border-primary transition"
              :class="[
                isRemote ? 'w-full' : '',
                (focus(idx + 1) || currentOverviewPage === idx + 1)
                  ? (isRemote ? 'border-primary border-4' : 'border-primary')
                  : 'border-main',
              ]"
              @click="go(route.no)"
            >
              <SlideContainer
                :key="route.no"
                :no="route.no"
                :use-snapshot="true"
                :width="cardWidth"
                class="pointer-events-none"
              >
                <SlideWrapper
                  :clicks-context="createFixedClicks(route, CLICKS_MAX)"
                  :route="route"
                  render-context="overview"
                />
                <DrawingPreview :page="route.no" />
              </SlideContainer>
            </div>
            <div
              class="absolute top-0"
              :class="isRemote ? 'left-1 top-1 px-1.5 py-0.5 rounded bg-main bg-opacity-90 text-xs leading-4' : ''"
              :style="isRemote ? undefined : `left: ${cardWidth + 5}px`"
            >
              <template v-if="keyboardBuffer && String(idx + 1).startsWith(keyboardBuffer)">
                <span class="text-green font-bold">{{ keyboardBuffer }}</span>
                <span class="opacity-50">{{ String(idx + 1).slice(keyboardBuffer.length) }}</span>
              </template>
              <span v-else :class="isRemote ? '' : 'opacity-50'">
                {{ idx + 1 }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="isRemote"
        class="flex-none flex items-center justify-center py-2 border-t border-main"
        @click.stop
      >
        <IconButton title="Close" class="text-2xl" @click="close">
          <div class="i-carbon:close" />
        </IconButton>
      </div>
    </div>
  </Transition>
  <div
    v-show="showOverview && !isRemote"
    class="fixed top-4 right-4 z-modal text-gray-400 flex flex-col items-center gap-2"
  >
    <IconButton title="Close" class="text-2xl" @click="close">
      <div class="i-carbon:close" />
    </IconButton>
    <IconButton
      v-if="!isRemote && __SLIDEV_FEATURE_PRESENTER__"
      as="a"
      title="Slides Overview"
      target="_blank"
      :href="`${pathPrefix}overview`"
      tab-index="-1"
      class="text-2xl"
    >
      <div class="i-carbon:list-boxes" />
    </IconButton>
    <IconButton
      v-if="!isRemote && __DEV__ && isScreenshotSupported"
      title="Capture slides as images"
      class="text-2xl"
      @click="captureSlidesOverview"
    >
      <div class="i-carbon:drop-photo" />
    </IconButton>
  </div>
</template>
