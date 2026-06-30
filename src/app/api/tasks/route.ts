import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { apiCatch, jsonError, taskToDTO, TASK_INCLUDES } from '@/lib/api-helpers'
import { PRIORITIES, STATUSES } from '@/lib/types'
import type { Priority, TaskDTO, TaskStatus } from '@/lib/types'

export async function GET(request: Request) {
  try {
    const currentUser = await requireUser()
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const categoryId = url.searchParams.get('categoryId')
    const assigneeId = url.searchParams.get('assigneeId')
    const priority = url.searchParams.get('priority')
    const branchId = url.searchParams.get('branchId')
    const isRenewal = url.searchParams.get('isRenewal')
    const q = url.searchParams.get('q')

    const where: Record<string, unknown> = {}
    if (status && STATUSES.includes(status as TaskStatus)) where.status = status
    if (categoryId) where.categoryId = categoryId
    if (assigneeId) where.assigneeId = assigneeId
    if (priority && PRIORITIES.includes(priority as Priority)) where.priority = priority
    if (branchId) where.branchId = branchId
    if (isRenewal === 'true') where.isRenewal = true
    if (isRenewal === 'false') where.isRenewal = false
    if (q && q.trim()) {
      where.title = { contains: q.trim() }
    }

    if (currentUser.role !== 'admin') {
      where.OR = [{ assigneeId: currentUser.id }, { createdById: currentUser.id }]
    }

    const tasks = await db.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: TASK_INCLUDES,
    })
    const dto: TaskDTO[] = tasks.map(taskToDTO)
    return NextResponse.json(dto)
  } catch (err) {
    return apiCatch(err)
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireUser()
    const body = await request.json().catch(() => null)
    if (!body || typeof body.title !== 'string' || typeof body.categoryId !== 'string' || typeof body.priority !== 'string') {
      return jsonError('title, categoryId, and priority are required', 400)
    }
    if (!PRIORITIES.includes(body.priority as Priority)) {
      return jsonError(`priority must be one of: ${PRIORITIES.join(', ')}`, 400)
    }
    const initialStatus: TaskStatus =
      typeof body.status === 'string' && STATUSES.includes(body.status as TaskStatus)
        ? (body.status as TaskStatus)
        : 'new'

    const category = await db.category.findUnique({ where: { id: body.categoryId } })
    if (!category) return jsonError('categoryId does not exist', 400)

    let assigneeId: string | null = null
    if (typeof body.assigneeId === 'string' && body.assigneeId.length > 0) {
      const assignee = await db.user.findUnique({ where: { id: body.assigneeId } })
      if (!assignee) return jsonError('assigneeId does not exist', 400)
      assigneeId = assignee.id
    }

    let branchId: string | null = null
    if (typeof body.branchId === 'string' && body.branchId.length > 0) {
      const branch = await db.branch.findUnique({ where: { id: body.branchId } })
      if (!branch) return jsonError('branchId does not exist', 400)
      branchId = branch.id
    }

    // Bump status to "assigned" if newly assigned and currently "new"
    const finalStatus: TaskStatus =
      assigneeId && initialStatus === 'new' ? 'assigned' : initialStatus

    const dueDate =
      typeof body.dueDate === 'string' && body.dueDate.length > 0
        ? new Date(body.dueDate)
        : null

    // Renewal tracking fields
    const isRenewal = typeof body.isRenewal === 'boolean' ? body.isRenewal : false
    const renewalExpiryDate =
      typeof body.renewalExpiryDate === 'string' && body.renewalExpiryDate.length > 0
        ? new Date(body.renewalExpiryDate)
        : null
    const renewalProvider =
      typeof body.renewalProvider === 'string' ? body.renewalProvider : null

    // Follow-up frequency (hours)
    let followUpFrequencyHours: number | null = null
    if (typeof body.followUpFrequencyHours === 'number' && Number.isFinite(body.followUpFrequencyHours)) {
      followUpFrequencyHours = Math.max(0, Math.floor(body.followUpFrequencyHours))
    }

    const created = await db.task.create({
      data: {
        title: body.title,
        description: typeof body.description === 'string' ? body.description : '',
        categoryId: body.categoryId,
        priority: body.priority,
        status: finalStatus,
        assigneeId,
        createdById: currentUser.id,
        branchId,
        sourceEmailText: typeof body.sourceEmailText === 'string' ? body.sourceEmailText : null,
        sourceSender: typeof body.sourceSender === 'string' ? body.sourceSender : null,
        generatedReplyText:
          typeof body.generatedReplyText === 'string' ? body.generatedReplyText : null,
        replySent: typeof body.replySent === 'boolean' ? body.replySent : false,
        dueDate,
        isRenewal,
        renewalExpiryDate,
        renewalProvider,
        followUpFrequencyHours,
      },
      include: TASK_INCLUDES,
    })

    // Activity log: created
    await db.activityLog.create({
      data: {
        taskId: created.id,
        userId: currentUser.id,
        actionType: 'created',
        content: `Task created: ${created.title}`,
      },
    })

    // If assigned at creation, log + notify
    if (assigneeId) {
      await db.activityLog.create({
        data: {
          taskId: created.id,
          userId: currentUser.id,
          actionType: 'assigned',
          content: `Assigned to ${created.assignee?.name ?? 'someone'}`,
        },
      })
      if (assigneeId !== currentUser.id) {
        await db.notification.create({
          data: {
            userId: assigneeId,
            taskId: created.id,
            type: 'assigned',
            message: `You were assigned: ${created.title}`,
          },
        })
      }
    }

    if (isRenewal) {
      await db.activityLog.create({
        data: {
          taskId: created.id,
          userId: currentUser.id,
          actionType: 'renewal_alert',
          content: `Task marked as renewal${renewalExpiryDate ? ` (expires ${renewalExpiryDate.toISOString()})` : ''}`,
        },
      })
    }

    // Re-fetch with includes so relations reflect the final state
    const fresh = await db.task.findUnique({
      where: { id: created.id },
      include: TASK_INCLUDES,
    })
    return NextResponse.json(taskToDTO(fresh!), { status: 201 })
  } catch (err) {
    return apiCatch(err)
  }
}
