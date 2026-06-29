import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { apiCatch } from '@/lib/api-helpers'
import type { DashboardSummary, Priority } from '@/lib/types'

export async function GET() {
  try {
    const currentUser = await requireUser()
    const now = new Date()
    const todayIso = now.toISOString().slice(0, 10)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const where =
      currentUser.role === 'admin'
        ? {}
        : { OR: [{ assigneeId: currentUser.id }, { createdById: currentUser.id }] }

    const [tasks, employees, categories] = await Promise.all([
      db.task.findMany({
        where,
        include: {
          assignee: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, color: true } },
        },
      }),
      db.user.findMany({
        where: { role: 'employee', active: true },
        select: { id: true, name: true },
      }),
      db.category.findMany({ select: { id: true, name: true, color: true } }),
    ])

    const isOpen = (t: (typeof tasks)[number]) => t.status !== 'done' && t.status !== 'closed'
    const isOverdue = (t: (typeof tasks)[number]) =>
      isOpen(t) && t.dueDate && t.dueDate < now

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
      needsAttention: attention.slice(0, 8).map(({ _sortRank, _dueMs, ...rest }) => rest),
    }
    return NextResponse.json(summary)
  } catch (err) {
    return apiCatch(err)
  }
}
