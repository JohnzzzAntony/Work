import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireUser } from '@/lib/auth'
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

export async function GET(request: Request) {
  try {
    await requireUser()
    const url = new URL(request.url)
    const activeOnly = url.searchParams.get('active')
    const where: Record<string, unknown> = {}
    if (activeOnly === 'true') where.active = true
    if (activeOnly === 'false') where.active = false

    const branches = await db.branch.findMany({
      where,
      orderBy: { name: 'asc' },
      include: BRANCH_INCLUDE,
    })
    const dto: BranchDTO[] = branches.map(branchToDTO)
    return NextResponse.json(dto)
  } catch (err) {
    return apiCatch(err)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()
    const body = await request.json().catch(() => null)
    if (!body || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return jsonError('name is required', 400)
    }

    const data: Record<string, unknown> = {
      name: body.name.trim(),
      type: typeof body.type === 'string' && body.type.trim().length > 0 ? body.type : 'branch',
      active: typeof body.active === 'boolean' ? body.active : true,
    }
    if (typeof body.address === 'string') data.address = body.address
    if (typeof body.phone === 'string') data.phone = body.phone
    if (typeof body.email === 'string') data.email = body.email

    const created = await db.branch.create({
      data: data as Parameters<typeof db.branch.create>[0]['data'],
      include: BRANCH_INCLUDE,
    })
    return NextResponse.json(branchToDTO(created), { status: 201 })
  } catch (err) {
    return apiCatch(err)
  }
}
