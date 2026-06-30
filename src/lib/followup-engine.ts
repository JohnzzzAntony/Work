/**
 * followup-engine.ts — sends follow-up reminders and escalations for tasks.
 *
 * For every task that is not done/closed and has followUpFrequencyHours set:
 *   - If `hoursSinceLastFollowUp >= followUpFrequencyHours`, create a `reminder`
 *     FollowUp + a `follow_up` notification + bump the task's lastFollowUpAt /
 *     followUpCount, and log the action.
 *   - Additionally, if the task is overdue AND `hoursSinceLastFollowUp >=
 *     escalationOverdueHours`, create an `escalation` FollowUp + an `escalation`
 *     notification to the first admin.
 *
 * `hoursSinceLastFollowUp` is Infinity when `lastFollowUpAt` is null (i.e. the
 * task has never been followed up on).
 *
 * Public API: `runFollowUps()` → returns the total number of FollowUp records
 * created during this run.
 */
import { db } from '@/lib/db'

const MS_PER_HOUR = 1000 * 60 * 60

async function getOrCreateSettings() {
  let settings = await db.setting.findUnique({ where: { id: 'singleton' } })
  if (!settings) {
    settings = await db.setting.create({ data: { id: 'singleton' } })
  }
  return settings
}

export async function runFollowUps(): Promise<number> {
  const settings = await getOrCreateSettings()
  const defaultFollowUpHours = settings.defaultFollowUpHours
  const escalationOverdueHours = settings.escalationOverdueHours

  const now = new Date()

  const [tasks, firstAdmin] = await Promise.all([
    db.task.findMany({
      where: {
        status: { notIn: ['done', 'closed'] },
        followUpFrequencyHours: { not: null },
      },
      select: {
        id: true,
        title: true,
        assigneeId: true,
        assignee: { select: { id: true, name: true } },
        dueDate: true,
        lastFollowUpAt: true,
        followUpCount: true,
        followUpFrequencyHours: true,
        status: true,
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
    const frequency = task.followUpFrequencyHours ?? defaultFollowUpHours
    if (!frequency || frequency <= 0) continue

    const hoursSinceLastFollowUp = task.lastFollowUpAt
      ? (now.getTime() - task.lastFollowUpAt.getTime()) / MS_PER_HOUR
      : Number.POSITIVE_INFINITY

    const isOverdue = !!task.dueDate && task.dueDate < now

    // --- reminder ---
    if (hoursSinceLastFollowUp >= frequency) {
      const newCount = task.followUpCount + 1
      const message = `Follow-up reminder: ${task.title} — please provide a status update`

      await db.followUp.create({
        data: {
          taskId: task.id,
          type: 'reminder',
          message,
          sentToUserId: task.assigneeId ?? null,
        },
      })

      if (task.assigneeId) {
        await db.notification.create({
          data: {
            userId: task.assigneeId,
            taskId: task.id,
            type: 'follow_up',
            message: `Follow-up: ${task.title}`,
          },
        })
      }

      await db.task.update({
        where: { id: task.id },
        data: {
          lastFollowUpAt: now,
          followUpCount: newCount,
        },
      })

      await db.activityLog.create({
        data: {
          taskId: task.id,
          userId: null,
          actionType: 'follow_up',
          content: `Follow-up #${newCount} sent to ${task.assignee?.name ?? 'assignee'}`,
        },
      })
      created += 1
    }

    // --- escalation (independent of the reminder above) ---
    if (isOverdue && hoursSinceLastFollowUp >= escalationOverdueHours) {
      const escalationMessage = `ESCALATION: ${task.title} is overdue`
      const adminId = firstAdmin?.id ?? null

      await db.followUp.create({
        data: {
          taskId: task.id,
          type: 'escalation',
          message: escalationMessage,
          sentToUserId: adminId,
        },
      })

      if (adminId) {
        await db.notification.create({
          data: {
            userId: adminId,
            taskId: task.id,
            type: 'escalation',
            message: `Escalation: ${task.title} (assigned to ${
              task.assignee?.name ?? 'unassigned'
            }) is overdue`,
          },
        })
      }

      await db.activityLog.create({
        data: {
          taskId: task.id,
          userId: null,
          actionType: 'escalation',
          content: 'Escalated to admin (overdue)',
        },
      })
      created += 1
    }
  }

  return created
}
