import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { apiCatch, jsonError } from '@/lib/api-helpers'
import { regenerateReply } from '@/lib/email-service'
import type { ReplyTone } from '@/lib/types'
import { TONES } from '@/lib/types'

export async function POST(request: Request) {
  try {
    await requireUser()
    const body = await request.json().catch(() => null)
    if (!body || typeof body.emailText !== 'string' || typeof body.tone !== 'string' || typeof body.category !== 'string') {
      return jsonError('emailText, tone, and category are required', 400)
    }
    if (!TONES.includes(body.tone as ReplyTone)) {
      return jsonError(`tone must be one of: ${TONES.join(', ')}`, 400)
    }
    const sender = typeof body.sender === 'string' ? body.sender : ''
    const assigneeName =
      typeof body.assigneeName === 'string' && body.assigneeName.length > 0
        ? body.assigneeName
        : null
    const companyName =
      typeof body.companyName === 'string' && body.companyName.length > 0
        ? body.companyName
        : 'WorkFlow Hub'

    const replyDraft = await regenerateReply(
      body.emailText,
      sender,
      body.tone as ReplyTone,
      body.category,
      assigneeName,
      companyName
    )
    return NextResponse.json({ replyDraft })
  } catch (err) {
    return apiCatch(err)
  }
}
