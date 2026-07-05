/**
 * outlook-service — background service for WorkFlow Hub Outlook integration.
 *
 * Polling loop that fetches unread emails from Microsoft Graph API,
 * posts them to the webapp for AI ingestion/auto-assignment, and sends replies if enabled.
 * If credentials are not set, it runs in simulation mode.
 */

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from the root .env file
dotenv.config({ path: path.join(__dirname, '../../.env') })

const POLL_INTERVAL_MS = (parseInt(process.env.OUTLOOK_POLL_INTERVAL_SECONDS || '30', 10) || 30) * 1000
const AUTO_REPLY = process.env.OUTLOOK_AUTO_REPLY === 'true'
const IS_SIMULATION =
  process.env.OUTLOOK_SIMULATION === 'true' ||
  !process.env.OUTLOOK_CLIENT_ID ||
  !process.env.OUTLOOK_CLIENT_SECRET ||
  !process.env.OUTLOOK_TENANT_ID ||
  !process.env.OUTLOOK_USER_EMAIL

const CRON_KEY = process.env.RENEWAL_CRON_KEY || 'workflowhub-renewal-cron'
const WEBAPP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'

const SIMULATED_SENDER_EMAILS = [
  'support-req@duall-logistics.com',
  'billing-issue@flowerdistrict.com',
  'operations@karjistore.com',
  'system-alerts@megh-tech.com',
  'vendor-portal@digital.ae'
]

const MOCK_EMAILS = [
  {
    senderEmail: 'billing-issue@duall-logistics.com',
    senderName: 'Jack Carter',
    subject: 'Urgent: Website checkout page gives 500 error during payments',
    body: 'Hi Team,\n\nWe are getting reports from multiple customers that the website checkout page is failing with a 500 internal server error when they select Online Payments. This is extremely critical as we are losing transaction volume. Please investigate immediately.\n\nBest regards,\nJack Carter'
  },
  {
    senderEmail: 'refunds@flowerdistrict.com',
    senderName: 'Sarah Jenkins',
    subject: 'Requesting refund for double-charged order #98221',
    body: 'Dear WorkFlow Hub,\n\nOur system shows that order #98221 was charged twice. The customer is asking for a refund of 250 AED for the duplicate charge. Please check the payment gateway and process the refund.\n\nThank you,\nSarah Jenkins'
  },
  {
    senderEmail: 'manager@karjistore.com',
    senderName: 'Ahmed Al Mansoor',
    subject: 'Store POS machine screen broken - Karji branch',
    body: 'Hello,\n\nThe POS machine at the main checkout counter in our Karji Store has a cracked screen and will not turn on. We are down to one working machine. Please dispatch a replacement unit or schedule a technician visit as soon as possible.\n\nAhmed Al Mansoor\nKarji Store Manager'
  },
  {
    senderEmail: 'alerts@megh-tech.com',
    senderName: 'Megh Tech Renewals',
    subject: 'Action Required: Domain SSL Certificate Expiry Alert',
    body: 'Dear Administrator,\n\nThis is an automated notice that your website SSL certificate is expiring in 7 days on July 11th. Please renew the certificate immediately to prevent secure connection errors for your users.\n\nBest,\nMegh Technologies'
  },
  {
    senderEmail: 'marketplace@digital.ae',
    senderName: 'Lina Ghadir',
    subject: 'Noon integration metadata mapping updates',
    body: 'Hello Support Team,\n\nWe need to update our product metadata sync script for the Noon marketplace. Noon recently updated their API schema, so some inventory fields are not syncing correctly. There is no rush, but please look into this during the week.\n\nLina Ghadir'
  }
]

let simulationCounter = 0

function cleanHtml(html: string): string {
  if (!html) return ''
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

async function getAccessToken(): Promise<string> {
  const tenantId = process.env.OUTLOOK_TENANT_ID!
  const clientId = process.env.OUTLOOK_CLIENT_ID!
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET!

  const params = new URLSearchParams()
  params.append('client_id', clientId)
  params.append('scope', 'https://graph.microsoft.com/.default')
  params.append('client_secret', clientSecret)
  params.append('grant_type', 'client_credentials')

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    body: params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

  if (!res.ok) {
    throw new Error(`OAuth failed: ${res.statusText} - ${await res.text()}`)
  }

  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

async function fetchUnreadMessages(accessToken: string): Promise<any[]> {
  const userEmail = process.env.OUTLOOK_USER_EMAIL!
  // Filter for unread messages, oldest first
  const url = `https://graph.microsoft.com/v1.0/users/${userEmail}/messages?$filter=isRead eq false&$orderby=receivedDateTime asc&$top=10`
  
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    throw new Error(`Fetch messages failed: ${res.statusText} - ${await res.text()}`)
  }

  const data = (await res.json()) as { value?: any[] }
  return data.value || []
}

async function markMessageRead(accessToken: string, messageId: string): Promise<void> {
  const userEmail = process.env.OUTLOOK_USER_EMAIL!
  const url = `https://graph.microsoft.com/v1.0/users/${userEmail}/messages/${messageId}`
  
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ isRead: true }),
  })

  if (!res.ok) {
    throw new Error(`Mark read failed: ${res.statusText} - ${await res.text()}`)
  }
}

async function sendReply(accessToken: string, messageId: string, replyText: string): Promise<void> {
  const userEmail = process.env.OUTLOOK_USER_EMAIL!
  const url = `https://graph.microsoft.com/v1.0/users/${userEmail}/messages/${messageId}/reply`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ comment: replyText }),
  })

  if (!res.ok) {
    throw new Error(`Send reply failed: ${res.statusText} - ${await res.text()}`)
  }
}

async function ingestToWebapp(
  senderEmail: string,
  senderName: string,
  subject: string,
  body: string
): Promise<any> {
  const targetUrl = `${WEBAPP_URL}/api/email/incoming?key=${CRON_KEY}`
  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senderEmail, senderName, subject, body }),
  })

  if (!res.ok) {
    throw new Error(`Webapp ingestion failed: ${res.statusText} - ${await res.text()}`)
  }

  return await res.json()
}

async function markReplySentInWebapp(taskId: string): Promise<void> {
  // We mock a request from the admin or trigger the PATCH /api/tasks/:id route.
  // Note: the PATCH task route requires requireUser() which checks cookies.
  // Since we are running in the background, we can patch the database directly or
  // we can use the RENEWAL_CRON_KEY to hit a custom internal route.
  // Wait, let's check if PATCH tasks requires admin session. Yes it does!
  // To bypass, we can make it hit a special query parameter, or let the webapp route
  // support cron key, OR since we have Prisma database access on the local filesystem,
  // we can import Prisma client or write to db if we were sharing.
  // Actually, we can hit `/api/cron/run-all` or we can implement an internal endpoint or
  // just let the incoming email endpoint handle database creation, and if auto-reply is enabled
  // and succeeds, mark it sent.
  // Wait! If the daemon does the auto-reply, it can just let the webapp know.
  // Let's check: Can we just support passing a bypass key to PATCH task or update it directly?
  // Let's implement database updating directly using a simple query or let's update it in Next.js.
  // Actually, if we update it in Next.js, it's easier. But wait, if the daemon is running in Bun,
  // it has direct access to the database using Prisma!
  // But wait, importing the Prisma client in a separate Bun process might conflict with SQLite/Postgres.
  // Actually, let's look at `index.ts` of notif-service: it doesn't use Prisma, it is lightweight.
  // To keep it simple, we can support updating the database via a PATCH /api/tasks/:id route that allows
  // authorization via `key=<CRON_SHARED_KEY>`. Let's check if the current task PATCH endpoint supports cron auth.
  // No, `src/app/api/tasks/[id]/route.ts` only does `requireUser()`.
  // Wait, we can modify the task PATCH endpoint to support `requireCronOrAdmin` instead of `requireUser()`!
  // That is incredibly elegant and allows our daemon to PATCH the task directly!
  // Yes! Let's do that.
}

async function processOutlookEmails(): Promise<void> {
  console.log(`[outlook-service] Polling Outlook inbox at ${new Date().toISOString()}...`)
  try {
    const token = await getAccessToken()
    const messages = await fetchUnreadMessages(token)

    if (messages.length === 0) {
      console.log('[outlook-service] No new unread emails.')
      return
    }

    console.log(`[outlook-service] Found ${messages.length} unread email(s).`)

    for (const msg of messages) {
      const senderEmail = msg.from?.emailAddress?.address || 'unknown@domain.com'
      const senderName = msg.from?.emailAddress?.name || ''
      const subject = msg.subject || 'No Subject'
      const rawBody = msg.uniqueBody?.content || msg.body?.content || ''
      const bodyText = cleanHtml(rawBody)

      console.log(`[outlook-service] Processing email from ${senderEmail}: "${subject}"`)

      // 1. Ingest email to Next.js API
      const result = await ingestToWebapp(senderEmail, senderName, subject, bodyText)
      console.log(`[outlook-service] Created task: ${result.task?.id} (${result.task?.title})`)

      // 2. Mark email as read in Outlook
      await markMessageRead(token, msg.id)
      console.log(`[outlook-service] Marked email ${msg.id} as read in Outlook.`)

      // 3. Auto-reply if enabled
      if (AUTO_REPLY && result.replyDraft) {
        console.log(`[outlook-service] Sending auto-reply to ${senderEmail}...`)
        await sendReply(token, msg.id, result.replyDraft)
        console.log('[outlook-service] Auto-reply sent successfully.')

        // Mark reply sent in Next.js webapp
        const patchUrl = `${WEBAPP_URL}/api/tasks/${result.task.id}?key=${CRON_KEY}`
        const patchRes = await fetch(patchUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ replySent: true }),
        })
        if (patchRes.ok) {
          console.log('[outlook-service] Reply marked as sent in webapp.')
        } else {
          console.error('[outlook-service] Failed to update replySent in webapp:', await patchRes.text())
        }
      }
    }
  } catch (err) {
    console.error('[outlook-service] Error processing Outlook emails:', err)
  }
}

async function processSimulatedEmails(): Promise<void> {
  console.log(`[outlook-service] [SIMULATION] Checking mock mailbox at ${new Date().toISOString()}...`)
  
  // We automatically ingest a simulated email every 3 intervals to not overflow the board too quickly,
  // or on-demand via the dashboard simulation button.
  simulationCounter++
  if (simulationCounter % 3 !== 0) {
    return
  }

  try {
    const randomIndex = Math.floor(Math.random() * MOCK_EMAILS.length)
    const mockEmail = MOCK_EMAILS[randomIndex]

    console.log(`[outlook-service] [SIMULATION] Found new mock email: "${mockEmail.subject}"`)

    const result = await ingestToWebapp(
      mockEmail.senderEmail,
      mockEmail.senderName,
      mockEmail.subject,
      mockEmail.body
    )

    console.log(`[outlook-service] [SIMULATION] Task created: ${result.task?.id} (${result.task?.title})`)

    if (AUTO_REPLY && result.replyDraft) {
      console.log(`[outlook-service] [SIMULATION] Sending auto-reply to ${mockEmail.senderEmail}...`)
      console.log(`[outlook-service] [SIMULATION] Reply text:\n${result.replyDraft}`)

      // Mark reply sent in Next.js webapp
      const patchUrl = `${WEBAPP_URL}/api/tasks/${result.task.id}?key=${CRON_KEY}`
      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replySent: true }),
      })
      if (patchRes.ok) {
        console.log('[outlook-service] [SIMULATION] Reply marked as sent in webapp.')
      } else {
        console.error('[outlook-service] [SIMULATION] Failed to update replySent:', await patchRes.text())
      }
    }
  } catch (err) {
    console.error('[outlook-service] [SIMULATION] Ingestion error:', err)
  }
}

async function main() {
  if (IS_SIMULATION) {
    console.log('==================================================================')
    console.log('  OUTLOOK INTEGRATION SERVICE RUNNING IN [SIMULATION MODE]         ')
    console.log('  - Simulated mock emails will arrive automatically periodically  ')
    console.log('  - Real-time ingestion is supported via API triggers            ')
    console.log('==================================================================')
  } else {
    console.log('==================================================================')
    console.log('  OUTLOOK INTEGRATION SERVICE RUNNING IN [LIVE OUTLOOK MODE]      ')
    console.log(`  - Mailbox: ${process.env.OUTLOOK_USER_EMAIL}                    `)
    console.log(`  - Tenant ID: ${process.env.OUTLOOK_TENANT_ID}                  `)
    console.log(`  - Client ID: ${process.env.OUTLOOK_CLIENT_ID}                  `)
    console.log('==================================================================')
  }

  // Poll loop
  while (true) {
    if (IS_SIMULATION) {
      await processSimulatedEmails()
    } else {
      await processOutlookEmails()
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

main().catch((err) => {
  console.error('[outlook-service] Fatal crash in service:', err)
  process.exit(1)
})
