/**
 * renewal-engine.ts — generates renewal alert notifications + activity logs for
 * tasks flagged as renewals (isRenewal=true, renewalExpiryDate set, not done/closed).
 *
 * The engine is IDEMPOTENT — for each (taskId, threshold) pair, a notification
 * is only created once. The dedup key is (taskId, notification.type) where
 * `type` is one of `renewal_30d`/`renewal_14d`/`renewal_7d`/`renewal_1d` or
 * `renewal_expired`.
 *
 * Notifications go to the assignee (if any) AND the first active admin user.
 *
 * Public API: `runRenewalAlerts()` → returns the number of notifications
 * created during this run.
 */
import { db } from '@/lib/db'

const MS_PER_DAY = 1000 * 60 * 60 * 24

async function getOrCreateSettings() {
  let settings = await db.setting.findUnique({ where: { id: 'singleton' } })
  if (!settings) {
    settings = await db.setting.create({ data: { id: 'singleton' } })
  }
  return settings
}

function parseAlertDays(raw: string): number[] {
  // Parse "30,14,7,1" → [30,14,7,1] (deduped + sorted descending)
  const seen = new Set<number>()
  for (const part of raw.split(',')) {
    const n = Number(part.trim())
    if (Number.isFinite(n) && n > 0 && Number.isInteger(n)) {
      seen.add(Math.floor(n))
    }
  }
  return Array.from(seen).sort((a, b) => b - a)
}

export async function runRenewalAlerts(): Promise<number> {
  const settings = await getOrCreateSettings()
  const thresholds = parseAlertDays(settings.renewalAlertDays)

  if (thresholds.length === 0) return 0

  const now = new Date()

  const [tasks, firstAdmin] = await Promise.all([
    db.task.findMany({
      where: {
        isRenewal: true,
        renewalExpiryDate: { not: null },
        status: { notIn: ['done', 'closed'] },
      },
      select: {
        id: true,
        title: true,
        renewalExpiryDate: true,
        assigneeId: true,
        assignee: { select: { id: true, name: true } },
      },
    }),
    db.user.findFirst({
      where: { role: 'admin', active: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  let created = 0

  for (const task of tasks) {
    if (!task.renewalExpiryDate) continue
    const expiry = task.renewalExpiryDate
    const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / MS_PER_DAY)

    if (daysUntilExpiry < 0) {
      // Expired — create a single renewal_expired notification (deduped)
      const existing = await db.notification.findFirst({
        where: { taskId: task.id, type: 'renewal_expired' },
        select: { id: true },
      })
      if (!existing) {
        const targets = collectTargets(task.assigneeId, firstAdmin?.id ?? null)
        if (targets.length > 0) {
          const message = `Renewal OVERDUE: ${task.title} expired on ${expiry.toISOString()}`
          await db.notification.createMany({
            data: targets.map((userId) => ({
              userId,
              taskId: task.id,
              type: 'renewal_expired',
              message,
            })),
          })
          await db.activityLog.create({
            data: {
              taskId: task.id,
              userId: null,
              actionType: 'renewal_alert',
              content: `Renewal alert: expired on ${expiry.toISOString()}`,
            },
          })
          created += targets.length
        }
      }
      continue
    }

    // For each threshold (e.g. 30, 14, 7, 1): if daysUntilExpiry <= threshold
    // and >= 0, fire the renewal_${threshold}d alert (deduped).
    for (const threshold of thresholds) {
      if (daysUntilExpiry <= threshold && daysUntilExpiry >= 0) {
        const type = `renewal_${threshold}d`
        const existing = await db.notification.findFirst({
          where: { taskId: task.id, type },
          select: { id: true },
        })
        if (existing) continue
        const targets = collectTargets(task.assigneeId, firstAdmin?.id ?? null)
        if (targets.length === 0) continue
        const message = `Renewal alert: ${task.title} expires in ${threshold} days (${expiry.toISOString()})`
        await db.notification.createMany({
          data: targets.map((userId) => ({
            userId,
            taskId: task.id,
            type,
            message,
          })),
        })
        await db.activityLog.create({
          data: {
            taskId: task.id,
            userId: null,
            actionType: 'renewal_alert',
            content: `Renewal alert: expires in ${threshold} days`,
          },
        })
        created += targets.length
      }
    }
  }

  return created
}

function collectTargets(assigneeId: string | null, adminId: string | null): string[] {
  const set = new Set<string>()
  if (assigneeId) set.add(assigneeId)
  if (adminId) set.add(adminId)
  return Array.from(set)
}
