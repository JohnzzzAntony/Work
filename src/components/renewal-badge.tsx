'use client'

import * as React from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

export type RenewalBadgeVariant = 'default' | 'compact'

/**
 * Renders a color-coded "🔄 Xd" / "🔄 EXPIRED" badge based on days until expiry.
 *
 * Color logic:
 *  - days > 14  → sky
 *  - 7–14 days  → amber
 *  - 1–7 days   → orange
 *  - 0 days     → red "TODAY"
 *  - < 0 days   → red "EXPIRED"
 */
export function RenewalBadge({
  renewalExpiryDate,
  variant = 'default',
  className,
}: {
  renewalExpiryDate: string | null | undefined
  variant?: RenewalBadgeVariant
  className?: string
}) {
  if (!renewalExpiryDate) return null
  let days: number
  try {
    days = differenceInCalendarDays(parseISO(renewalExpiryDate), new Date())
  } catch {
    return null
  }

  let label: string
  let tone: string
  if (days < 0) {
    label = variant === 'compact' ? 'EXPIRED' : '🔄 EXPIRED'
    tone = 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900'
  } else if (days === 0) {
    label = variant === 'compact' ? 'TODAY' : '🔄 TODAY'
    tone = 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900'
  } else if (days <= 7) {
    label = `🔄 ${days}d`
    tone = 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900'
  } else if (days <= 14) {
    label = `🔄 ${days}d`
    tone = 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900'
  } else {
    label = `🔄 ${days}d`
    tone = 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-900'
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        tone,
        className
      )}
      title={`Renewal expires ${new Date(renewalExpiryDate).toLocaleDateString()}`}
    >
      {label}
    </span>
  )
}

/**
 * Returns true if the renewal expiry is within 7 days (inclusive) OR already expired.
 */
export function isRenewalSoonOrExpired(renewalExpiryDate: string | null | undefined): boolean {
  if (!renewalExpiryDate) return false
  try {
    const days = differenceInCalendarDays(parseISO(renewalExpiryDate), new Date())
    return days <= 7
  } catch {
    return false
  }
}
