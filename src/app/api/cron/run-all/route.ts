import { NextResponse } from 'next/server'
import { requireCronOrAdmin } from '@/lib/auth'
import { apiCatch } from '@/lib/api-helpers'
import { runRenewalAlerts } from '@/lib/renewal-engine'
import { runFollowUps } from '@/lib/followup-engine'

export async function POST(request: Request) {
  try {
    await requireCronOrAdmin(request)
    const [renewals, followUps] = await Promise.all([
      runRenewalAlerts(),
      runFollowUps(),
    ])
    return NextResponse.json({ ok: true, renewals, followUps })
  } catch (err) {
    return apiCatch(err)
  }
}
