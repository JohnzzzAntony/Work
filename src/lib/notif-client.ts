/**
 * notif-client.ts — server-only helper for pushing notifications into the
 * notif-service socket.io mini-service (port 3003).
 *
 * Usage from Next.js API routes / server components:
 *
 *   import { pushNotification } from '@/lib/notif-client'
 *   pushNotification(user.id, notificationDto)              // fire-and-forget
 *   pushNotification(user.id, notificationDto, { count: 3 })// with unread count
 *
 * The function is async but NEVER rejects — all errors are caught and logged,
 * so callers can safely invoke it without `await` (fire-and-forget). A small
 * in-memory circuit breaker pauses pushes for a cooldown after repeated
 * failures, so a down/broken mini-service can never crash the Next.js process.
 *
 * This file is SERVER-ONLY. Do not import from client components — `fetch`
 * to localhost:3003 only makes sense server-side.
 */

const NOTIF_SERVICE_URL = 'http://localhost:3003/internal/notify'

// --- circuit breaker state (in-memory, per-process) ---
let consecutiveFailures = 0
let cooldownUntil = 0
const MAX_FAILURES = 5
const COOLDOWN_MS = 30_000
const REQUEST_TIMEOUT_MS = 5_000

export interface PushNotificationOptions {
  /** Optional new unread count to broadcast alongside the notification. */
  count?: number | null
}

/**
 * Push a notification to the notif-service so it can be delivered in
 * real-time to the user's connected socket.io client.
 *
 * Fire-and-forget: safe to call without `await`. Never throws.
 */
export async function pushNotification(
  userId: string,
  notification: unknown,
  options: PushNotificationOptions = {},
): Promise<void> {
  // Guard against accidental client-side imports — no-op + warn.
  if (typeof window !== 'undefined') {
    console.warn(
      '[notif-client] pushNotification called on the client — ignoring (server-only util).',
    )
    return
  }

  if (!userId || typeof userId !== 'string') {
    console.warn('[notif-client] pushNotification called without a valid userId — ignoring.')
    return
  }

  // Circuit breaker: skip while in cooldown.
  const now = Date.now()
  if (now < cooldownUntil) {
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(NOTIF_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        notification,
        count: options.count ?? null,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      console.warn(`[notif-client] notif-service responded with HTTP ${res.status}`)
      // Treat as soft failure — don't open the circuit on a non-network error,
      // but do count it so a persistently misbehaving service still trips.
      registerFailure()
      return
    }

    // Success — reset the breaker.
    consecutiveFailures = 0
    cooldownUntil = 0
  } catch (err) {
    registerFailure()
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[notif-client] push failed (service may be down): ${msg}`)
  } finally {
    clearTimeout(timeout)
  }
}

function registerFailure(): void {
  consecutiveFailures += 1
  if (consecutiveFailures >= MAX_FAILURES) {
    cooldownUntil = Date.now() + COOLDOWN_MS
    console.warn(
      `[notif-client] notif-service appears down after ${consecutiveFailures} failures — pausing pushes for ${COOLDOWN_MS}ms.`,
    )
    // Reset the counter so the next attempt after cooldown starts fresh.
    consecutiveFailures = 0
  }
}
