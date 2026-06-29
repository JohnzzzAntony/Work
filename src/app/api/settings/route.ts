import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireUser } from '@/lib/auth'
import { apiCatch, jsonError } from '@/lib/api-helpers'
import { TONES } from '@/lib/types'
import type { ReplyTone } from '@/lib/types'

async function getOrCreateSettings() {
  let settings = await db.setting.findUnique({ where: { id: 'singleton' } })
  if (!settings) {
    settings = await db.setting.create({ data: { id: 'singleton' } })
  }
  return settings
}

export async function GET() {
  try {
    await requireUser()
    const settings = await getOrCreateSettings()
    return NextResponse.json(settings)
  } catch (err) {
    return apiCatch(err)
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin()
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return jsonError('Invalid body', 400)

    const data: Record<string, unknown> = {}
    if (typeof body.companyName === 'string') data.companyName = body.companyName
    if (typeof body.defaultTone === 'string' && TONES.includes(body.defaultTone as ReplyTone)) {
      data.defaultTone = body.defaultTone
    }
    if (typeof body.urgentHours === 'number') data.urgentHours = body.urgentHours
    if (typeof body.highDays === 'number') data.highDays = body.highDays
    if (typeof body.mediumDays === 'number') data.mediumDays = body.mediumDays
    if (typeof body.lowDays === 'number') data.lowDays = body.lowDays
    if (typeof body.reminderHoursBefore === 'number') data.reminderHoursBefore = body.reminderHoursBefore
    if (typeof body.overdueCheckHours === 'number') data.overdueCheckHours = body.overdueCheckHours
    if (typeof body.inReviewReminderHours === 'number') data.inReviewReminderHours = body.inReviewReminderHours
    if (typeof body.replyNotSentHours === 'number') data.replyNotSentHours = body.replyNotSentHours

    const settings = await getOrCreateSettings()
    const updated = await db.setting.update({ where: { id: settings.id }, data })
    return NextResponse.json(updated)
  } catch (err) {
    return apiCatch(err)
  }
}
