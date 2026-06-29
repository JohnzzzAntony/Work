import type { Priority } from './types'

type SettingsLike = {
  urgentHours: number
  highDays: number
  mediumDays: number
  lowDays: number
}

const DEFAULTS: Required<SettingsLike> = {
  urgentHours: 4,
  highDays: 1,
  mediumDays: 3,
  lowDays: 7,
}

/**
 * Compute an ISO due-date string from a priority, using the settings-derived
 * defaults (urgent=4h, high=1d, medium=3d, low=7d). Shared between the
 * email-service (single-task) and the analyze-summary route (multi-task).
 */
export function dueDateFromPriorityHelper(
  priority: Priority,
  settings?: SettingsLike | null
): string {
  const s = { ...DEFAULTS, ...(settings ?? {}) }
  const now = new Date()
  switch (priority) {
    case 'urgent':
      now.setHours(now.getHours() + s.urgentHours)
      break
    case 'high':
      now.setDate(now.getDate() + s.highDays)
      break
    case 'medium':
      now.setDate(now.getDate() + s.mediumDays)
      break
    case 'low':
      now.setDate(now.getDate() + s.lowDays)
      break
  }
  return now.toISOString()
}
