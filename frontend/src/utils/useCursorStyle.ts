import { onMounted, ref, type Ref } from 'vue'

/**
 * 'pointer' — browser default: pointer cursor on everything clickable.
 * 'normal' — native-app feel: default arrow everywhere, pointer only on raw
 * external links (see the `html[data-cursor='normal']` rules in index.css).
 */
export type CursorStyle = 'pointer' | 'normal'

const STORAGE_KEY = 'gameplan:cursorStyle'

const currentCursorStyle: Ref<CursorStyle> = ref('pointer')
let isInitialized = false

const applyCursorStyle = (style: CursorStyle): void => {
  document.documentElement.setAttribute('data-cursor', style)
}

const initializeCursorStyle = (): void => {
  if (isInitialized) return

  const stored = localStorage.getItem(STORAGE_KEY) as CursorStyle | null
  currentCursorStyle.value = stored && ['pointer', 'normal'].includes(stored) ? stored : 'pointer'
  applyCursorStyle(currentCursorStyle.value)
  isInitialized = true
}

const setCursorStyle = (style: CursorStyle): void => {
  currentCursorStyle.value = style
  applyCursorStyle(style)
  localStorage.setItem(STORAGE_KEY, style)
}

export function useCursorStyle() {
  onMounted(() => {
    initializeCursorStyle()
  })

  return {
    currentCursorStyle,
    setCursorStyle,
  }
}
