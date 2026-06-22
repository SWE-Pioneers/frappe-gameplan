import { computed, ref, useTemplateRef, type ComputedRef, type CSSProperties } from 'vue'

export interface PointerSortableItem {
  id: string
}

export interface PointerSortableCommit<Section extends string> {
  itemId: string
  sourceSection: Section
  targetSection: Section
  targetIndex: number
}

interface UsePointerSortableSectionsOptions<Section extends string> {
  sections: readonly Section[]
  sectionRefNames: Record<Section, string>
  sortableSection: Section
  itemsBySection: Record<Section, ComputedRef<PointerSortableItem[]>>
  onCommit: (payload: PointerSortableCommit<Section>) => void
}

interface PointerDragState<Section extends string> {
  itemId: string
  pointerId: number
  sourceSection: Section
  targetSection: Section
  sourceIndex: number
  targetIndex: number
  startY: number
  currentY: number
  rowHeight: number
  sortableRows: SortableRowRect[]
}

interface SortableRowRect {
  id: string
  top: number
  height: number
}

export function usePointerSortableSections<Section extends string>({
  sections,
  sectionRefNames,
  sortableSection,
  itemsBySection,
  onCommit,
}: UsePointerSortableSectionsOptions<Section>) {
  const sectionRefs = Object.fromEntries(
    sections.map((section) => [section, useTemplateRef<HTMLElement>(sectionRefNames[section])]),
  ) as Record<Section, ReturnType<typeof useTemplateRef<HTMLElement>>>

  const dragState = ref<PointerDragState<Section> | null>(null)

  const activeSection = computed(() => dragState.value?.targetSection ?? null)

  function startPointerDrag(event: PointerEvent, itemId: string, sourceSection: Section) {
    if (event.button !== 0) return

    let row = event.currentTarget as HTMLElement
    let rowRect = row.getBoundingClientRect()
    let sourceIndex = getSectionItemIndex(itemId, sourceSection)

    dragState.value = {
      itemId,
      pointerId: event.pointerId,
      sourceSection,
      targetSection: sourceSection,
      sourceIndex,
      targetIndex: sourceIndex,
      startY: event.clientY,
      currentY: event.clientY,
      rowHeight: rowRect.height,
      sortableRows: measureSortableRows(),
    }

    row.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  function updatePointerDrag(event: PointerEvent) {
    let state = dragState.value
    if (!state || state.pointerId !== event.pointerId) return

    state.currentY = event.clientY
    state.targetSection = getPointerTargetSection(event.clientY, state.sourceSection)
    state.targetIndex = getPointerTargetIndex(state, event.clientY)
  }

  function finishPointerDrag(event: PointerEvent) {
    let state = dragState.value
    if (!state || state.pointerId !== event.pointerId) return

    releasePointerCapture(event)
    onCommit({
      itemId: state.itemId,
      sourceSection: state.sourceSection,
      targetSection: state.targetSection,
      targetIndex: state.targetIndex,
    })
    dragState.value = null
  }

  function cancelPointerDrag(event: PointerEvent) {
    let state = dragState.value
    if (!state || state.pointerId !== event.pointerId) return

    releasePointerCapture(event)
    dragState.value = null
  }

  function isDraggingItem(itemId: string) {
    return dragState.value?.itemId === itemId
  }

  function getItemStyle(itemId: string, section: Section): CSSProperties | undefined {
    let state = dragState.value
    if (!state) return

    let offset = getItemOffset(itemId, section, state)
    let isDraggedRow = state.itemId === itemId

    return {
      transform: `translate3d(0, ${offset}px, 0)`,
      transition: isDraggedRow ? 'none' : 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)',
    }
  }

  function getItemOffset(itemId: string, section: Section, state: PointerDragState<Section>) {
    if (state.itemId === itemId) {
      return state.currentY - state.startY
    }

    if (section !== sortableSection) return 0

    let index = itemsBySection[sortableSection].value.findIndex((item) => item.id === itemId)
    if (index === -1) return 0

    if (state.targetSection !== sortableSection && state.sourceSection === sortableSection) {
      return index > state.sourceIndex ? -state.rowHeight : 0
    }

    if (state.targetSection !== sortableSection) return 0

    if (state.sourceSection !== sortableSection) {
      return index >= state.targetIndex ? state.rowHeight : 0
    }

    if (state.targetIndex > state.sourceIndex) {
      return index > state.sourceIndex && index <= state.targetIndex ? -state.rowHeight : 0
    }

    if (state.targetIndex < state.sourceIndex) {
      return index >= state.targetIndex && index < state.sourceIndex ? state.rowHeight : 0
    }

    return 0
  }

  function getSectionItemIndex(itemId: string, section: Section) {
    return Math.max(
      0,
      itemsBySection[section].value.findIndex((item) => item.id === itemId),
    )
  }

  function getPointerTargetSection(clientY: number, fallbackSection: Section): Section {
    let measuredSections = sections
      .map((section) => ({
        section,
        rect: sectionRefs[section].value?.getBoundingClientRect(),
      }))
      .filter((entry): entry is { section: Section; rect: DOMRect } => Boolean(entry.rect))

    let containingSection = measuredSections.find(
      ({ rect }) => clientY >= rect.top && clientY <= rect.bottom,
    )
    if (containingSection) return containingSection.section

    let closestSection = measuredSections
      .map(({ section, rect }) => ({
        section,
        distance: Math.min(Math.abs(clientY - rect.top), Math.abs(clientY - rect.bottom)),
      }))
      .sort((left, right) => left.distance - right.distance)[0]

    return closestSection?.section ?? fallbackSection
  }

  function getPointerTargetIndex(state: PointerDragState<Section>, clientY: number) {
    if (state.targetSection !== sortableSection) return state.sourceIndex

    let rows = state.sortableRows.filter((row) => {
      return state.sourceSection !== sortableSection || row.id !== state.itemId
    })
    let targetIndex = rows.findIndex((row) => clientY < row.top + row.height / 2)

    return targetIndex === -1 ? rows.length : targetIndex
  }

  function measureSortableRows(): SortableRowRect[] {
    let rows = sectionRefs[sortableSection].value?.querySelectorAll<HTMLElement>(
      `[data-sortable-section="${sortableSection}"]`,
    )
    if (!rows) return []

    return Array.from(rows)
      .map((row) => {
        let rect = row.getBoundingClientRect()
        return {
          id: row.dataset.sortableId || '',
          top: rect.top,
          height: rect.height,
        }
      })
      .filter((row) => row.id)
  }

  function releasePointerCapture(event: PointerEvent) {
    let row = event.currentTarget as HTMLElement
    if (row.hasPointerCapture(event.pointerId)) {
      row.releasePointerCapture(event.pointerId)
    }
  }

  return {
    activeSection,
    startPointerDrag,
    updatePointerDrag,
    finishPointerDrag,
    cancelPointerDrag,
    isDraggingItem,
    getItemStyle,
  }
}
