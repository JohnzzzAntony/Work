import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, requireAdmin, requireUser, toSafeUser } from '@/lib/auth'
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

const USER_INCLUDES = {
  department: { select: { name: true } },
  branch: { select: { name: true } },
} as const

export async function GET() {
  try {
    const currentUser = await requireUser()
    if (currentUser.role === 'admin') {
      const users = await db.user.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
          ...USER_INCLUDES,
          assignedTasks: {
            where: { status: { notIn: ['done', 'closed'] } },
            select: { id: true },
          },
        },
      })
      const dto: UserDTO[] = users.map((u) => ({
        ...toSafeUser(u),
        createdAt: u.createdAt.toISOString(),
        openTaskCount: u.assignedTasks.length,
      }))
      return NextResponse.json(dto)
    }
    // employees only see themselves
    const u = await db.user.findUnique({
      where: { id: currentUser.id },
      include: USER_INCLUDES,
    })
    if (!u) return jsonError('User not found', 404)
    const dto: UserDTO[] = [
      {
        ...toSafeUser(u),
        createdAt: u.createdAt.toISOString(),
      },
    ]
    return NextResponse.json(dto)
  } catch (err) {
    return apiCatch(err)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()
    const body = await request.json().catch(() => null)
    if (
      !body ||
      typeof body.email !== 'string' ||
      typeof body.name !== 'string' ||
      typeof body.password !== 'string'
    ) {
      return jsonError('name, email, and password are required', 400)
    }
    const role = body.role === 'admin' ? 'admin' : 'employee'
    const existing = await db.user.findUnique({ where: { email: body.email.toLowerCase() } })
    if (existing) {
      return jsonError('A user with that email already exists', 400)
    }

    const data: Record<string, unknown> = {
      name: body.name,
      email: body.email.toLowerCase(),
      passwordHash: hashPassword(body.password),
      role,
      categorySkills: JSON.stringify(parseSkills(body.categorySkills)),
      active: true,
    }

    // Optional department / branch / job title / phone
    if (typeof body.departmentId === 'string' && body.departmentId.length > 0) {
      const dept = await db.department.findUnique({ where: { id: body.departmentId } })
      if (!dept) return jsonError('departmentId does not exist', 400)
      data.departmentId = body.departmentId
    }
    if (typeof body.branchId === 'string' && body.branchId.length > 0) {
      const branch = await db.branch.findUnique({ where: { id: body.branchId } })
      if (!branch) return jsonError('branchId does not exist', 400)
      data.branchId = body.branchId
    }
    if (typeof body.jobTitle === 'string') data.jobTitle = body.jobTitle
    if (typeof body.phone === 'string') data.phone = body.phone

    const created = await db.user.create({
      data: data as Parameters<typeof db.user.create>[0]['data'],
      include: USER_INCLUDES,
    })
    const dto: UserDTO = {
      ...toSafeUser(created),
      createdAt: created.createdAt.toISOString(),
    }
    return NextResponse.json(dto, { status: 201 })
  } catch (err) {
    return apiCatch(err)
  }
}
