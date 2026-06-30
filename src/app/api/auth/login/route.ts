import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  toSafeUser,
  verifyPassword,
} from '@/lib/auth'
import { apiCatch, jsonError } from '@/lib/api-helpers'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
      return jsonError('Email and password are required', 400)
    }
    const user = await db.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: {
        department: { select: { name: true } },
        branch: { select: { name: true } },
      },
    })
    if (!user || !user.active) {
      return jsonError('Invalid email or password', 401)
    }
    const ok = verifyPassword(body.password, user.passwordHash)
    if (!ok) {
      return jsonError('Invalid email or password', 401)
    }
    const token = createSessionToken(user.id)
    const res = NextResponse.json({ user: toSafeUser(user) })
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    })
    return res
  } catch (err) {
    return apiCatch(err)
  }
}
