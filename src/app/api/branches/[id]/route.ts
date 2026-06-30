import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { apiCatch, jsonError } from '@/lib/api-helpers'
import type { BranchDTO } from '@/lib/types'

const BRANCH_INCLUDE = {
  _count: {
    select: {
      users: true,
      tasks: true,
    },
  },
} as const

function branchToDTO(b: {
  id: string
  name: string
  type: string
  address: string | null
  phone: string | null
  email: string | null
  active: boolean
  createdAt: Date
  _count: { users: number; tasks: number }
}): BranchDTO {
  return {
    id: b.id,
    name: b.name,
    type: b.type,
    address: b.address,
    phone: b.phone,
    email: b.email,
    active: b.active,
    createdAt: b.createdAt.toISOString(),
    employeeCount: b._count.users,
    taskCount: b._count.tasks,
  }
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
    const existing = await db.branch.findUnique({ where: { id } })
    if (!existing) return jsonError('Branch not found', 404)

    const data: Record<string, unknown> = {}
    if (typeof body.name === 'string' && body.name.trim().length > 0) {
      data.name = body.name.trim()
    }
    if (typeof body.type === 'string' && body.type.trim().length > 0) {
      data.type = body.type
    }
    if (typeof body.address === 'string') data.address = body.address
    if (typeof body.phone === 'string') data.phone = body.phone
    if (typeof body.email === 'string') data.email = body.email
    if (typeof body.active === 'boolean') data.active = body.active

    const updated = await db.branch.update({
      where: { id },
      data: data as Parameters<typeof db.branch.update>[0]['data'],
      include: BRANCH_INCLUDE,
    })
    return NextResponse.json(branchToDTO(updated))
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
    const existing = await db.branch.findUnique({ where: { id } })
    if (!existing) return jsonError('Branch not found', 404)

    const [userCount, taskCount] = await Promise.all([
      db.user.count({ where: { branchId: id } }),
      db.task.count({ where: { branchId: id } }),
    ])
    if (userCount > 0 || taskCount > 0) {
      const bits: string[] = []
      if (userCount > 0) bits.push(`${userCount} user(s)`)
      if (taskCount > 0) bits.push(`${taskCount} task(s)`)
      return jsonError(
        `Cannot delete branch "${existing.name}" — ${bits.join(' and ')} still reference it. Reassign them first.`,
        400,
      )
    }

    await db.branch.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiCatch(err)
  }
}
