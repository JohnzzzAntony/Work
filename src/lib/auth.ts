import crypto from 'crypto'
import { cookies } from 'next/headers'
import { db } from './db'

const SESSION_COOKIE = 'wf_session'
const SESSION_SECRET = process.env.SESSION_SECRET || 'workflowhub-dev-secret-change-me'

// Hash a password using scrypt (built-in to Node, no extra deps)
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

// Verify a password against a stored hash
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const testHash = crypto.scryptSync(password, salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'))
}

// Create a signed session token: base64(userId).signature
export function createSessionToken(userId: string): string {
  const payload = Buffer.from(userId).toString('base64url')
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex')
  return `${payload}.${sig}`
}

// Verify and decode a session token; returns userId or null
export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex')
  if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
    return null
  }
  try {
    return Buffer.from(payload, 'base64url').toString('utf8')
  } catch {
    return null
  }
}

// Get the current user from the session cookie, or null
export async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const userId = verifySessionToken(token)
  if (!userId) return null
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      department: { select: { name: true } },
      branch: { select: { name: true } },
    },
  })
  if (!user || !user.active) return null
  return user
}

// Require an authenticated user; throws if not logged in
export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}

// Require an admin user
export async function requireAdmin() {
  const user = await requireUser()
  if (user.role !== 'admin') {
    throw new Error('FORBIDDEN')
  }
  return user
}

// Set the session cookie on a response (used in API route handlers)
export const SESSION_COOKIE_NAME = SESSION_COOKIE
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

// Shared secret used by cron endpoints so they can be triggered by an external
// scheduler without an admin session. Override via the RENEWAL_CRON_KEY env var.
export const CRON_SHARED_KEY =
  process.env.RENEWAL_CRON_KEY || 'workflowhub-renewal-cron'

/**
 * Authenticate a cron-style request either via an existing admin session OR a
 * shared-secret query parameter (?key=<CRON_SHARED_KEY>). Returns the admin
 * user when the session path succeeds (so engines can attribute actions to a
 * real user), or `null` when only the shared-secret path was used. Throws
 * 'UNAUTHORIZED' when neither path is satisfied so it composes with apiCatch.
 */
export async function requireCronOrAdmin(request: Request) {
  try {
    const admin = await requireAdmin()
    return admin
  } catch {
    // fall through to shared-secret check
  }
  try {
    const url = new URL(request.url)
    const key = url.searchParams.get('key')
    if (typeof key === 'string' && key.length > 0 && key === CRON_SHARED_KEY) {
      return null
    }
  } catch {
    /* ignore URL parse errors */
  }
  throw new Error('UNAUTHORIZED')
}

// Type for the safe user object returned to the client (no passwordHash)
export type SafeUser = {
  id: string
  email: string
  name: string
  role: 'admin' | 'employee'
  categorySkills: string[]
  departmentId: string | null
  departmentName: string | null
  branchId: string | null
  branchName: string | null
  jobTitle: string | null
  phone: string | null
  active: boolean
  createdAt: Date
}

export function toSafeUser(user: {
  id: string
  email: string
  name: string
  role: string
  categorySkills: string
  departmentId?: string | null
  department?: { name: string } | null
  branchId?: string | null
  branch?: { name: string } | null
  jobTitle?: string | null
  phone?: string | null
  active: boolean
  createdAt: Date
}): SafeUser {
  let skills: string[] = []
  try {
    skills = JSON.parse(user.categorySkills || '[]')
  } catch {
    skills = []
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as 'admin' | 'employee',
    categorySkills: skills,
    departmentId: user.departmentId ?? null,
    departmentName: user.department?.name ?? null,
    branchId: user.branchId ?? null,
    branchName: user.branch?.name ?? null,
    jobTitle: user.jobTitle ?? null,
    phone: user.phone ?? null,
    active: user.active,
    createdAt: user.createdAt,
  }
}
