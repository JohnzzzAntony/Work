import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { apiCatch } from '@/lib/api-helpers'
import { PRIORITIES } from '@/lib/types'
import type { Priority, ReportsSummary } from '@/lib/types'

function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60)
}

export async function GET() {
  try {
    await requireAdmin()
    const now = new Date()

    const [
      totalTasks,
      closedTasks,
      allTasks,
      employees,
      categories,
      followUpTasks,
    ] = await Promise.all([
      db.task.count(),
      db.task.count({ where: { status: 'closed' } }),
      db.task.findMany({
        include: {
          assignee: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, color: true } },
          activityLogs: {
            where: { actionType: 'comment' },
            select: { id: true },
          },
        },
      }),
      db.user.findMany({
        where: { role: 'employee' },
        select: { id: true, name: true },
      }),
      db.category.findMany({ select: { id: true, name: true, color: true } }),
      // Tasks that have at least one comment activity log and are not done/closed
      db.task.findMany({
        where: {
          status: { notIn: ['done', 'closed'] },
          activityLogs: { some: { actionType: 'comment' } },
        },
        select: { id: true },
      }),
    ])

    const closedList = allTasks.filter((t) => t.status === 'closed' && t.closedAt)
    const avgCompletionHours =
      closedList.length > 0
        ? closedList.reduce(
            (sum, t) => sum + hoursBetween(t.createdAt, t.closedAt!),
            0
          ) / closedList.length
        : null

    const overdueCount = allTasks.filter(
      (t) =>
        t.dueDate &&
        t.dueDate < now &&
        t.status !== 'done' &&
        t.status !== 'closed'
    ).length

    const followUpCount = followUpTasks.length

    // Per employee
    const perEmployee = employees.map((emp) => {
      const assigned = allTasks.filter((t) => t.assigneeId === emp.id)
      const completed = assigned.filter((t) => t.status === 'closed')
      const overdue = assigned.filter(
        (t) =>
          t.dueDate &&
          t.dueDate < now &&
          t.status !== 'done' &&
          t.status !== 'closed'
      )
      const completedWithClosed = completed.filter((t) => t.closedAt)
      const empAvg =
        completedWithClosed.length > 0
          ? completedWithClosed.reduce(
              (s, t) => s + hoursBetween(t.createdAt, t.closedAt!),
              0
            ) / completedWithClosed.length
          : null
      return {
        userId: emp.id,
        name: emp.name,
        assigned: assigned.length,
        completed: completed.length,
        overdue: overdue.length,
        avgCompletionHours: empAvg,
      }
    })

    // Per category
    const perCategory = categories.map((cat) => {
      const inCat = allTasks.filter((t) => t.categoryId === cat.id)
      return {
        categoryId: cat.id,
        name: cat.name,
        color: cat.color,
        total: inCat.length,
        closed: inCat.filter((t) => t.status === 'closed').length,
        overdue: inCat.filter(
          (t) =>
            t.dueDate &&
            t.dueDate < now &&
            t.status !== 'done' &&
            t.status !== 'closed'
        ).length,
      }
    })

    // Per priority
    const perPriority = PRIORITIES.map((p: Priority) => {
      const inP = allTasks.filter((t) => t.priority === p)
      return {
        priority: p,
        total: inP.length,
        closed: inP.filter((t) => t.status === 'closed').length,
      }
    })

    // Recent completions — last 5 closed tasks
    const recentCompletions = closedList
      .slice()
      .sort((a, b) => (b.closedAt!.getTime() - a.closedAt!.getTime()))
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        title: t.title,
        assigneeName: t.assignee?.name ?? null,
        closedAt: t.closedAt!.toISOString(),
        hoursToClose: hoursBetween(t.createdAt, t.closedAt!),
      }))

    const summary: ReportsSummary = {
      totalTasks,
      closedTasks,
      avgCompletionHours,
      overdueCount,
      followUpCount,
      perEmployee,
      perCategory,
      perPriority,
      recentCompletions,
    }
    return NextResponse.json(summary)
  } catch (err) {
    return apiCatch(err)
  }
}
