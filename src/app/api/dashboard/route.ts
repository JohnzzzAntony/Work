import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { apiCatch } from '@/lib/api-helpers'
import type { DashboardSummary, Priority } from '@/lib/types'

const MS_PER_HOUR = 1000 * 60 * 60
const MS_PER_DAY = MS_PER_HOUR * 24

export async function GET() {
  try {
    const currentUser = await requireUser()
    const now = new Date()
    const todayIso = now.toISOString().slice(0, 10)
    const sevenDaysAgo = new Date(now.getTime() - 7 * MS_PER_DAY)

    const where =
      currentUser.role === 'admin'
        ? {}
        : { OR: [{ assigneeId: currentUser.id }, { createdById: currentUser.id }] }

    const [tasks, employees, categories, departments] = await Promise.all([
      db.task.findMany({
        where,
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              departmentId: true,
              department: { select: { id: true, name: true, color: true } },
            },
          },
          category: { select: { id: true, name: true, color: true } },
        },
      }),
      db.user.findMany({
        where: { role: 'employee', active: true },
        select: { id: true, name: true, departmentId: true },
      }),
      db.category.findMany({ select: { id: true, name: true, color: true } }),
      db.department.findMany({ select: { id: true, name: true, color: true } }),
    ])

    const isOpen = (t: (typeof tasks)[number]) => t.status !== 'done' && t.status !== 'closed'
    const isOverdue = (t: (typeof tasks)[number]) =>
      isOpen(t) && !!t.dueDate && t.dueDate < now

    const open = tasks.filter(isOpen).length
    const overdue = tasks.filter(isOverdue).length

    const dueToday = tasks.filter(
      (t) => isOpen(t) && t.dueDate && t.dueDate.toISOString().slice(0, 10) === todayIso
    ).length

    const doneThisWeek = tasks.filter(
      (t) =>
        (t.status === 'done' || t.status === 'closed') &&
        t.updatedAt >= sevenDaysAgo
    ).length

    const byCategory = categories.map((cat) => ({
      categoryId: cat.id,
      name: cat.name,
      color: cat.color,
      count: tasks.filter((t) => t.categoryId === cat.id && isOpen(t)).length,
    }))

    const byEmployee = employees.map((emp) => {
      const assigned = tasks.filter((t) => t.assigneeId === emp.id)
      return {
        userId: emp.id,
        name: emp.name,
        openCount: assigned.filter(isOpen).length,
        overdueCount: assigned.filter(isOverdue).length,
      }
    })

    // byDepartment — for each department with at least one employee who has open tasks,
    // count open + overdue tasks (using assignee.departmentId).
    const deptAgg = new Map<
      string,
      { departmentId: string; name: string; color: string; openCount: number; overdueCount: number }
    >()
    for (const dept of departments) {
      deptAgg.set(dept.id, {
        departmentId: dept.id,
        name: dept.name,
        color: dept.color,
        openCount: 0,
        overdueCount: 0,
      })
    }
    for (const t of tasks) {
      if (!isOpen(t)) continue
      const deptId = t.assignee?.departmentId ?? null
      if (!deptId) continue
      const entry = deptAgg.get(deptId)
      if (!entry) continue
      entry.openCount += 1
      if (isOverdue(t)) entry.overdueCount += 1
    }
    const byDepartment = Array.from(deptAgg.values()).filter((d) => d.openCount > 0)

    // upcomingRenewals — all tasks where isRenewal AND status NOT closed, sorted by expiry asc.
    const upcomingRenewals = tasks
      .filter((t) => t.isRenewal && t.status !== 'closed' && t.renewalExpiryDate)
      .slice()
      .sort(
        (a, b) =>
          (a.renewalExpiryDate!.getTime()) - (b.renewalExpiryDate!.getTime()),
      )
      .map((t) => {
        const daysUntilExpiry = Math.floor(
          (t.renewalExpiryDate!.getTime() - now.getTime()) / MS_PER_DAY,
        )
        return {
          id: t.id,
          title: t.title,
          renewalExpiryDate: t.renewalExpiryDate!.toISOString(),
          daysUntilExpiry,
          assigneeName: t.assignee?.name ?? null,
          renewalProvider: t.renewalProvider ?? null,
          isExpired: daysUntilExpiry < 0,
        }
      })

    // pendingFollowUps — tasks not done/closed with followUpFrequencyHours set
    // and overdue for a follow-up (lastFollowUpAt is null OR
    // (now - lastFollowUpAt) > followUpFrequencyHours). Limit 10, sorted by
    // hoursSinceLastFollowUp descending.
    const pendingFollowUps = tasks
      .filter((t) => isOpen(t) && t.followUpFrequencyHours !== null)
      .map((t) => {
        const hoursSinceLastFollowUp = t.lastFollowUpAt
          ? (now.getTime() - t.lastFollowUpAt.getTime()) / MS_PER_HOUR
          : null
        return {
          task: t,
          id: t.id,
          title: t.title,
          assigneeName: t.assignee?.name ?? null,
          lastFollowUpAt: t.lastFollowUpAt ? t.lastFollowUpAt.toISOString() : null,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          hoursSinceLastFollowUp,
        }
      })
      .filter((entry) => {
        const freq = entry.task.followUpFrequencyHours as number | null
        if (freq === null) return false
        if (entry.hoursSinceLastFollowUp === null) return true // never followed up
        return entry.hoursSinceLastFollowUp >= freq
      })
      .sort((a, b) => {
        const aKey = a.hoursSinceLastFollowUp ?? Number.POSITIVE_INFINITY
        const bKey = b.hoursSinceLastFollowUp ?? Number.POSITIVE_INFINITY
        return bKey - aKey
      })
      .slice(0, 10)
      .map(({ task: _task, ...rest }) => rest)

    // Needs attention
    type AttentionItem = {
      id: string
      title: string
      reason: string
      assigneeName: string | null
      dueDate: string | null
      priority: Priority
      _sortRank: number // 0 overdue, 1 reply_not_sent, 2 due_today
      _dueMs: number
    }
    const attention: AttentionItem[] = []
    for (const t of tasks) {
      if (!isOpen(t)) continue
      const dueIso = t.dueDate ? t.dueDate.toISOString() : null
      if (t.dueDate && t.dueDate < now) {
        attention.push({
          id: t.id,
          title: t.title,
          reason: 'overdue',
          assigneeName: t.assignee?.name ?? null,
          dueDate: dueIso,
          priority: t.priority as Priority,
          _sortRank: 0,
          _dueMs: t.dueDate.getTime(),
        })
      } else if (t.sourceEmailText && !t.replySent) {
        attention.push({
          id: t.id,
          title: t.title,
          reason: 'reply_not_sent',
          assigneeName: t.assignee?.name ?? null,
          dueDate: dueIso,
          priority: t.priority as Priority,
          _sortRank: 1,
          _dueMs: t.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER,
        })
      } else if (t.dueDate && t.dueDate.toISOString().slice(0, 10) === todayIso) {
        attention.push({
          id: t.id,
          title: t.title,
          reason: 'due_today',
          assigneeName: t.assignee?.name ?? null,
          dueDate: dueIso,
          priority: t.priority as Priority,
          _sortRank: 2,
          _dueMs: t.dueDate.getTime(),
        })
      }
    }
    attention.sort((a, b) => {
      if (a._sortRank !== b._sortRank) return a._sortRank - b._sortRank
      return a._dueMs - b._dueMs
    })

    const summary: DashboardSummary = {
      open,
      overdue,
      dueToday,
      doneThisWeek,
      byCategory,
      byEmployee,
      byDepartment,
      upcomingRenewals,
      pendingFollowUps,
      needsAttention: attention.slice(0, 8).map(({ _sortRank, _dueMs, ...rest }) => rest),
    }
    return NextResponse.json(summary)
  } catch (err) {
    return apiCatch(err)
  }
}
