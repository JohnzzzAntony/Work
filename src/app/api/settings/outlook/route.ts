import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { apiCatch, jsonError } from '@/lib/api-helpers'
import fs from 'fs'
import path from 'path'

const envPath = path.join(process.cwd(), '.env')

function readEnvFile(): Record<string, string> {
  if (!fs.existsSync(envPath)) return {}
  const content = fs.readFileSync(envPath, 'utf8')
  const result: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      let val = match[2].trim()
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
      result[key] = val
    }
  }
  return result
}

function writeEnvFile(updates: Record<string, string>) {
  let content = ''
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8')
  }

  const lines = content.split('\n')
  const keysToUpdate = new Set(Object.keys(updates))

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/)
    if (match) {
      const key = match[1]
      if (keysToUpdate.has(key)) {
        lines[i] = `${key}=${updates[key]}`
        keysToUpdate.delete(key)
      }
    }
  }

  // Append new keys
  for (const key of keysToUpdate) {
    if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
      lines.push('')
    }
    lines.push(`${key}=${updates[key]}`)
  }

  fs.writeFileSync(envPath, lines.join('\n'), 'utf8')

  // Update process.env dynamically
  for (const [key, val] of Object.entries(updates)) {
    process.env[key] = val
  }
}

export async function GET() {
  try {
    await requireAdmin()
    const env = readEnvFile()
    return NextResponse.json({
      outlookSimulation: env.OUTLOOK_SIMULATION === 'true',
      outlookTenantId: env.OUTLOOK_TENANT_ID || '',
      outlookClientId: env.OUTLOOK_CLIENT_ID || '',
      outlookClientSecret: env.OUTLOOK_CLIENT_SECRET || '',
      outlookUserEmail: env.OUTLOOK_USER_EMAIL || '',
      outlookAccessToken: env.OUTLOOK_ACCESS_TOKEN || '',
      outlookAutoReply: env.OUTLOOK_AUTO_REPLY === 'true',
      outlookPollIntervalSeconds: parseInt(env.OUTLOOK_POLL_INTERVAL_SECONDS || '30', 10),
    })
  } catch (err) {
    return apiCatch(err)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return jsonError('Invalid body', 400)
    }

    const updates: Record<string, string> = {}

    if (body.outlookSimulation !== undefined) {
      updates.OUTLOOK_SIMULATION = body.outlookSimulation ? 'true' : 'false'
    }
    if (typeof body.outlookTenantId === 'string') {
      updates.OUTLOOK_TENANT_ID = body.outlookTenantId.trim()
    }
    if (typeof body.outlookClientId === 'string') {
      updates.OUTLOOK_CLIENT_ID = body.outlookClientId.trim()
    }
    if (typeof body.outlookClientSecret === 'string') {
      updates.OUTLOOK_CLIENT_SECRET = body.outlookClientSecret.trim()
    }
    if (typeof body.outlookUserEmail === 'string') {
      updates.OUTLOOK_USER_EMAIL = body.outlookUserEmail.trim()
    }
    if (typeof body.outlookAccessToken === 'string') {
      updates.OUTLOOK_ACCESS_TOKEN = body.outlookAccessToken.trim()
    }
    if (body.outlookAutoReply !== undefined) {
      updates.OUTLOOK_AUTO_REPLY = body.outlookAutoReply ? 'true' : 'false'
    }
    if (typeof body.outlookPollIntervalSeconds === 'number') {
      updates.OUTLOOK_POLL_INTERVAL_SECONDS = String(
        Math.max(5, Math.floor(body.outlookPollIntervalSeconds))
      )
    }

    writeEnvFile(updates)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiCatch(err)
  }
}
