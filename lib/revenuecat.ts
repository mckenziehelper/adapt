// RevenueCat subscription management — Phase 3 implementation.

export type ProStatus = {
  isPro: boolean
  expiresAt: Date | null
  cachedAt: Date
}

const PRO_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Stub — initialize RevenueCat SDK (Phase 3)
 */
export async function initRevenueCat(userId: string): Promise<void> {
  console.warn('RevenueCat not yet implemented — Phase 3')
}

/**
 * Stub — get current Pro status (checks cache first, then RevenueCat) (Phase 3)
 */
export async function getProStatus(): Promise<ProStatus> {
  return {
    isPro: false,
    expiresAt: null,
    cachedAt: new Date(),
  }
}

/**
 * Stub — open paywall / purchase flow (Phase 3)
 */
export async function openPaywall(): Promise<void> {
  console.warn('Paywall not yet implemented — Phase 3')
}
