import { NextResponse } from 'next/server'
import { getCurrentUser, toSafeUser } from '@/lib/auth'
import { apiCatch, jsonError } from '@/lib/api-helpers'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return jsonError('Unauthorized', 401)
    }
    return NextResponse.json({ user: toSafeUser(user) })
  } catch (err) {
    return apiCatch(err)
  }
}
