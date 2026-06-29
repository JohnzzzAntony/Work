import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { apiCatch, jsonError } from '@/lib/api-helpers'
import { analyzeEmail } from '@/lib/email-service'
import type { EmailAnalyzeRequest, EmailAnalyzeResponse, ReplyTone } from '@/lib/types'
import { TONES } from '@/lib/types'

export async function POST(request: Request) {
  try {
    await requireUser()
    const body = await request.json().catch(() => null)
    if (!body || typeof body.emailText !== 'string' || body.emailText.trim().length === 0) {
      return jsonError('emailText is required', 400)
    }
    const tone: ReplyTone =
      typeof body.tone === 'string' && TONES.includes(body.tone as ReplyTone)
        ? (body.tone as ReplyTone)
        : 'formal'

    const req: EmailAnalyzeRequest = {
      emailText: body.emailText,
      sender: typeof body.sender === 'string' ? body.sender : undefined,
      tone,
      companyName: typeof body.companyName === 'string' ? body.companyName : undefined,
    }
    const result: EmailAnalyzeResponse = await analyzeEmail(req)
    return NextResponse.json(result)
  } catch (err) {
    return apiCatch(err)
  }
}
