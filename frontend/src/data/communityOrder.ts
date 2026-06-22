import { ref } from 'vue'

export const communityOrder = ref<string[]>([])

export function setCommunityOrder(order: unknown) {
  communityOrder.value = normalizeCommunityOrder(order)
}

function normalizeCommunityOrder(order: unknown): string[] {
  if (typeof order === 'string') {
    return parseCommunityOrder(order)
  }

  if (!Array.isArray(order)) {
    return []
  }

  return order.filter((communityName): communityName is string => typeof communityName === 'string')
}

function parseCommunityOrder(order: string): string[] {
  try {
    return normalizeCommunityOrder(JSON.parse(order))
  } catch {
    return []
  }
}
