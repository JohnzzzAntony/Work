import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireCronOrAdmin } from '@/lib/auth'
import { apiCatch, jsonError, taskToDTO, TASK_INCLUDES } from '@/lib/api-helpers'
import { analyzeEmail } from '@/lib/email-service'
import { resolveCategory, autoAssignForCategory } from '@/lib/assign'
import { pushNotification } from '@/lib/notif-client'
import { dueDateFromPriorityHelper } from '@/lib/due-date'
import type { Priority } from '@/lib/types'

export async function POST(request: Request) {
  try {
    // Authenticate client (either admin session or secret cron key query)
    await requireCronOrAdmin(request)

    const body = await request.json().catch(() => null)
    if (!body || typeof body.body !== 'string' || body.body.trim().length === 0) {
      return jsonError('body (email text) is required', 400)
    }

    const senderEmail = typeof body.senderEmail === 'string' ? body.senderEmail.trim() : 'unknown@domain.com'
    const senderName = typeof body.senderName === 'string' ? body.senderName.trim() : ''
    const subject = typeof body.subject === 'string' ? body.subject.trim() : 'New email'

    // 1. Analyze email content via AI
    const analysis = await analyzeEmail({
      emailText: `Subject: ${subject}\n\n${body.body}`,
      sender: senderEmail,
      tone: 'formal', // default to formal tone
    })

    // 2. Resolve category from AI detection
    const resolvedCat = await resolveCategory(analysis.category)
    if (!resolvedCat) {
      return jsonError(`Failed to resolve category: ${analysis.category}`, 400)
    }

    // 3. Find the best employee using auto-assignment
    const assigneeId = await autoAssignForCategory(resolvedCat.id)

    // 4. Find the first admin to associate with system-created task
    const firstAdmin = await db.user.findFirst({
      where: { role: 'admin', active: true },
    })
    const adminId = firstAdmin?.id || 'singleton'

    // Determine priority (defaulting to medium if invalid)
    const priority: Priority = ['low', 'medium', 'high', 'urgent'].includes(analysis.priority)
      ? (analysis.priority as Priority)
      : 'medium'

    // Compute due date from priority based on system settings
    const settings = await db.setting.findUnique({ where: { id: 'singleton' } })
    const computedDueDate = dueDateFromPriorityHelper(priority, settings)

    // Set initial status: "assigned" if assignee found, otherwise "new"
    const status = assigneeId ? 'assigned' : 'new'

    // 5. Create task in database
    const createdTask = await db.task.create({
      data: {
        title: analysis.title,
        description: analysis.summary,
        categoryId: resolvedCat.id,
        priority,
        status,
        assigneeId,
        createdById: adminId,
        sourceEmailText: body.body,
        sourceSender: senderEmail,
        generatedReplyText: analysis.replyDraft,
        replySent: false,
        dueDate: new Date(computedDueDate),
      },
      include: TASK_INCLUDES,
    })

    // 6. Log activity: creation
    await db.activityLog.create({
      data: {
        taskId: createdTask.id,
        userId: adminId,
        actionType: 'created',
        content: `Task created automatically from email: "${analysis.title}"`,
      },
    })

    // 7. If assigned, log assignment + create notification + push in real-time
    if (assigneeId) {
      await db.activityLog.create({
        data: {
          taskId: createdTask.id,
          userId: adminId,
          actionType: 'assigned',
          content: `Assigned automatically to ${createdTask.assignee?.name ?? 'employee'}`,
        },
      })

      const notification = await db.notification.create({
        data: {
          userId: assigneeId,
          taskId: createdTask.id,
          type: 'assigned',
          message: `You were assigned a new email task: ${createdTask.title}`,
        },
      })

      // Push real-time notification via WebSockets (notif-service)
      const unreadCount = await db.notification.count({
        where: { userId: assigneeId, read: false },
      })
      pushNotification(assigneeId, notification, { count: unreadCount })
    }

    return NextResponse.json({
      ok: true,
      task: taskToDTO(createdTask),
      replyDraft: analysis.replyDraft,
    }, { status: 201 })
  } catch (err) {
    return apiCatch(err)
  }
}
