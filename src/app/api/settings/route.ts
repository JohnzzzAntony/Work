import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireUser } from '@/lib/auth'
import { apiCatch, jsonError } from '@/lib/api-helpers'
import { TONES } from '@/lib/types'
import type { ReplyTone, SettingsDTO } from '@/lib/types'

async function getOrCreateSettings() {
  let settings = await db.setting.findUnique({ where: { id: 'singleton' } })
  if (!settings) {
    settings = await db.setting.create({ data: { id: 'singleton' } })
  }
  return settings
}

function settingsToDTO(s: Awaited<ReturnType<typeof getOrCreateSettings>>): SettingsDTO {
  return {
    id: s.id,
    companyName: s.companyName,
    defaultTone: s.defaultTone as ReplyTone,
    urgentHours: s.urgentHours,
    highDays: s.highDays,
    mediumDays: s.mediumDays,
    lowDays: s.lowDays,
    reminderHoursBefore: s.reminderHoursBefore,
    overdueCheckHours: s.overdueCheckHours,
    inReviewReminderHours: s.inReviewReminderHours,
    replyNotSentHours: s.replyNotSentHours,
    renewalAlertDays: s.renewalAlertDays,
    defaultFollowUpHours: s.defaultFollowUpHours,
    escalationOverdueHours: s.escalationOverdueHours,
  }
}

export async function GET() {
  try {
    await requireUser()
    const settings = await getOrCreateSettings()
    return NextResponse.json(settingsToDTO(settings))
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

    if (typeof body.renewalAlertDays === 'string') {
      // Validate the string parses to a comma-separated list of positive integers
      const cleaned = body.renewalAlertDays
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      const nums = cleaned.map((s) => Number(s))
      if (nums.every((n) => Number.isFinite(n) && n > 0)) {
        data.renewalAlertDays = nums.join(',')
      } else {
        return jsonError('renewalAlertDays must be a comma-separated list of positive integers', 400)
      }
    }
    if (typeof body.defaultFollowUpHours === 'number' && body.defaultFollowUpHours >= 0) {
      data.defaultFollowUpHours = Math.floor(body.defaultFollowUpHours)
    }
    if (typeof body.escalationOverdueHours === 'number' && body.escalationOverdueHours >= 0) {
      data.escalationOverdueHours = Math.floor(body.escalationOverdueHours)
    }

    const settings = await getOrCreateSettings()
    const updated = await db.setting.update({
      where: { id: settings.id },
      data: data as Parameters<typeof db.setting.update>[0]['data'],
    })
    return NextResponse.json(settingsToDTO(updated))
  } catch (err) {
    return apiCatch(err)
  }
}
