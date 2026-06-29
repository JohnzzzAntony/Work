/**
 * notif-service — socket.io mini-service for WorkFlow Hub real-time notifications.
 *
 * Runs on port 3003 (hardcoded — Caddy routes to it via the XTransformPort=3003
 * query param convention).
 *
 * Responsibilities:
 *   1. Accept socket.io client connections on path "/" (DO NOT change — Caddy
 *      depends on it). Clients `emit('subscribe', { userId })` to join a per-user
 *      room `user:<userId>`.
 *   2. Expose an internal HTTP endpoint `POST /internal/notify` on the SAME port
 *      that the Next.js backend calls to push a notification. Body shape:
 *      `{ userId, notification, count? }`.
 *   3. On notify, emit `notification` and `notification_count` events to the
 *      target user's room.
 *   4. Any other HTTP request gets a 200 `{ service: 'notif-service' }` so health
 *      checks pass.
 *
 * Implementation note on sharing the port:
 *   With socket.io `path: '/'`, engine.io's `handlingRequest()` returns true for
 *   EVERY URL (every pathname starts with `/`), so engine.io claims all HTTP
 *   requests and our own routes never get hit. To coexist, we attach engine.io
 *   normally, then REPLACE the http server's 'request' listener with a small
 *   dispatcher that:
 *     - routes engine.io handshake/polling requests (those carrying `EIO=` or
 *       `transport=` query params) to `io.engine.handleRequest`, and
 *     - routes everything else to our own HTTP handler.
 *   The 'upgrade' (WebSocket) listener is left untouched — engine.io needs it
 *   and we have no WebSocket routes of our own.
 *
 * Reference pattern: /home/z/my-project/examples/websocket/server.ts
 */

import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server, Socket } from 'socket.io'

const PORT = 3003

// Forward declaration — assigned right after `createServer`, but referenced
// inside the request handler (which only runs once `io` exists).
let io: Server

/** Read & parse a JSON body from an IncomingMessage. Throws on invalid JSON. */
function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
      // 1MB safety cap
      if (Buffer.concat(chunks).length > 1_000_000) {
        req.destroy()
        reject(new Error('body too large'))
      }
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

/**
 * Detect engine.io requests. Engine.io handshake/polling URLs always carry
 * `EIO=<version>` and `transport=<kind>` query params, e.g.:
 *   /?EIO=4&transport=polling&t=...
 *   /?EIO=4&transport=websocket
 * Our own routes (`/`, `/internal/notify`) never have these params.
 */
function isEngineIoRequest(req: IncomingMessage): boolean {
  const url = req.url || ''
  return url.includes('EIO=') || url.includes('transport=')
}

/** Handle our own (non-engine.io) HTTP routes. */
async function handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Internal push endpoint — called by the Next.js backend.
  if (req.method === 'POST' && req.url === '/internal/notify') {
    let parsed: any
    try {
      parsed = await readJsonBody(req)
    } catch (err) {
      sendJson(res, 400, { ok: false, error: 'invalid JSON body' })
      return
    }

    const userId: unknown = parsed?.userId
    const notification: unknown = parsed?.notification
    const count: unknown = parsed?.count

    if (typeof userId !== 'string' || userId.length === 0) {
      sendJson(res, 400, { ok: false, error: 'userId (string) is required' })
      return
    }

    const room = `user:${userId}`
    // Deliver the notification payload to the user's room (no-op if room empty).
    io.to(room).emit('notification', notification)
    // Emit the unread-count event. If the backend didn't supply a count,
    // emit `null` per the task contract.
    io.to(room).emit('notification_count', {
      count: typeof count === 'number' ? count : null,
    })

    const roomSize = io.sockets.adapter.rooms.get(room)?.size ?? 0
    console.log(
      `[notif-service] notify → room=${room} sockets=${roomSize} hasCount=${typeof count === 'number'}`,
    )

    sendJson(res, 200, { ok: true })
    return
  }

  // Health check / default — any other request returns the service identifier
  // so probes (curl /, k8s liveness, etc.) get a 200.
  sendJson(res, 200, { service: 'notif-service' })
}

// 1) Create the http server with NO initial listener — we'll install our own
//    dispatcher after socket.io attaches.
const httpServer = createServer()

// 2) Attach socket.io. engine.io will install its own 'request' and 'upgrade'
//    listeners. With path:'/' the 'request' listener claims every URL, so we
//    need to replace it with a dispatcher.
io = new Server(httpServer, {
  // DO NOT change the path — Caddy uses it to route to this port.
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60_000,
  pingInterval: 25_000,
})

// 3) Replace the 'request' listener with our dispatcher. Leave the 'upgrade'
//    listener (engine.io's WebSocket upgrade handler) untouched.
httpServer.removeAllListeners('request')
httpServer.on('request', (req, res) => {
  if (isEngineIoRequest(req)) {
    io.engine.handleRequest(req, res)
    return
  }
  void handleHttpRequest(req, res)
})

io.on('connection', (socket: Socket) => {
  console.log(`[notif-service] client connected: ${socket.id}`)

  socket.on('subscribe', (data: unknown) => {
    const userId =
      typeof data === 'object' && data !== null
        ? (data as { userId?: unknown }).userId
        : undefined

    if (typeof userId !== 'string' || userId.length === 0) {
      console.warn(
        `[notif-service] invalid subscribe payload from ${socket.id}:`,
        data,
      )
      return
    }

    const room = `user:${userId}`
    void socket.join(room)
    console.log(`[notif-service] ${socket.id} joined ${room}`)
  })

  socket.on('unsubscribe', (data: unknown) => {
    const userId =
      typeof data === 'object' && data !== null
        ? (data as { userId?: unknown }).userId
        : undefined
    if (typeof userId !== 'string' || userId.length === 0) return
    const room = `user:${userId}`
    void socket.leave(room)
    console.log(`[notif-service] ${socket.id} left ${room}`)
  })

  socket.on('disconnect', (reason: string) => {
    console.log(`[notif-service] client disconnected: ${socket.id} (${reason})`)
  })

  socket.on('error', (err: unknown) => {
    console.error(`[notif-service] socket error (${socket.id}):`, err)
  })
})

httpServer.listen(PORT, () => {
  console.log(`[notif-service] listening on port ${PORT}`)
  console.log(
    `[notif-service] socket.io path=/  internal endpoint=POST /internal/notify`,
  )
})

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(`[notif-service] ${signal} received, shutting down...`)
  io.close(() => {
    httpServer.close(() => {
      console.log('[notif-service] closed')
      process.exit(0)
    })
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
