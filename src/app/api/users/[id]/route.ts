import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, requireAdmin, toSafeUser } from '@/lib/auth'
import { apiCatch, jsonError } from '@/lib/api-helpers'
import type { UserDTO } from '@/lib/types'

function parseSkills(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string')
    } catch {
      /* ignore */
    }
  }
  return []
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return jsonError('Invalid body', 400)
    }
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) return jsonError('User not found', 404)

    const data: Record<string, unknown> = {}
    if (typeof body.name === 'string') data.name = body.name
    if (typeof body.email === 'string') data.email = body.email.toLowerCase()
    if (body.role === 'admin' || body.role === 'employee') data.role = body.role
    if (typeof body.active === 'boolean') data.active = body.active
    if (body.categorySkills !== undefined) {
      data.categorySkills = JSON.stringify(parseSkills(body.categorySkills))
    }
    if (typeof body.password === 'string' && body.password.length > 0) {
      data.passwordHash = hashPassword(body.password)
    }
    if (data.email && data.email !== existing.email) {
      const conflict = await db.user.findUnique({ where: { email: data.email as string } })
      if (conflict && conflict.id !== id) {
        return jsonError('Email already in use', 400)
      }
    }

    const updated = await db.user.update({ where: { id }, data })
    const dto: UserDTO = {
      ...toSafeUser(updated),
      createdAt: updated.createdAt.toISOString(),
    }
    return NextResponse.json(dto)
  } catch (err) {
    return apiCatch(err)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) return jsonError('User not found', 404)
    await db.user.update({ where: { id }, data: { active: false } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiCatch(err)
  }
}
