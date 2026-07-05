import { NextResponse } from 'next/server'
import { requireCronOrAdmin } from '@/lib/auth'
import { apiCatch, jsonError } from '@/lib/api-helpers'
import { ingestIncomingEmail } from '@/lib/email-ingest'

export async function POST(request: Request) {
  try {
    // Authenticate client (either admin session or secret cron key query)
    await requireCronOrAdmin(request)

    const body = await request.json().catch(() => null)
    if (!body || typeof body.body !== 'string' || body.body.trim().length === 0) {
      return jsonError('body (email text) is required', 400)
    }

    const result = await ingestIncomingEmail({
      senderEmail: typeof body.senderEmail === 'string' ? body.senderEmail.trim() : 'unknown@domain.com',
      senderName: typeof body.senderName === 'string' ? body.senderName.trim() : '',
      subject: typeof body.subject === 'string' ? body.subject.trim() : 'New email',
      body: body.body,
    })

    return NextResponse.json({
      ok: true,
      task: result.task,
      replyDraft: result.replyDraft,
    }, { status: 201 })
  } catch (err) {
    return apiCatch(err)
  }
}
