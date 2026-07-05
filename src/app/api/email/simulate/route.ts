import { NextResponse } from 'next/server'
import { requireCronOrAdmin } from '@/lib/auth'
import { apiCatch, jsonError } from '@/lib/api-helpers'

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

export async function POST(request: Request) {
  try {
    // Authenticate (admin or cron key)
    await requireCronOrAdmin(request)

    // Select a random email from the mock list
    const randomIndex = Math.floor(Math.random() * MOCK_EMAILS.length)
    const mockEmail = MOCK_EMAILS[randomIndex]

    // Construct local URL to /api/email/incoming with cron key auth
    const cronKey = process.env.RENEWAL_CRON_KEY || 'workflowhub-renewal-cron'
    const targetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/email/incoming?key=${cronKey}`

    // Post to the incoming endpoint
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        senderEmail: mockEmail.senderEmail,
        senderName: mockEmail.senderName,
        subject: mockEmail.subject,
        body: mockEmail.body
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[email-simulation] Ingestion failed:', errorText)
      return jsonError(`Simulation ingestion failed: ${response.statusText}`, 500)
    }

    const result = await response.json()
    return NextResponse.json({
      ok: true,
      simulated: mockEmail,
      result
    })
  } catch (err) {
    return apiCatch(err)
  }
}
