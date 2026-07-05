import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { apiCatch, jsonError } from '@/lib/api-helpers'

export async function POST(request: Request) {
  try {
    await requireAdmin()
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return jsonError('Invalid body', 400)
    }

    const simulation = !!body.outlookSimulation
    if (simulation) {
      return NextResponse.json({ ok: true, message: 'Simulation mode is active.' })
    }

    const accessToken = typeof body.outlookAccessToken === 'string' ? body.outlookAccessToken.trim() : ''
    const tenantId = typeof body.outlookTenantId === 'string' ? body.outlookTenantId.trim() : ''
    const clientId = typeof body.outlookClientId === 'string' ? body.outlookClientId.trim() : ''
    const clientSecret = typeof body.outlookClientSecret === 'string' ? body.outlookClientSecret.trim() : ''
    const userEmail = typeof body.outlookUserEmail === 'string' ? body.outlookUserEmail.trim() : ''

    // 1. If manual access token is provided, test it by fetching /me
    if (accessToken) {
      const graphRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!graphRes.ok) {
        const errText = await graphRes.text()
        return NextResponse.json({
          ok: false,
          error: `Graph API call failed: ${graphRes.statusText} (${graphRes.status}) - ${errText}`,
        })
      }

      const profile = await graphRes.json()
      return NextResponse.json({
        ok: true,
        method: 'AccessToken',
        user: {
          displayName: profile.displayName || 'Outlook User',
          mail: profile.mail || profile.userPrincipalName || userEmail || 'unknown',
        },
      })
    }

    // 2. Otherwise, test client credentials grant flow
    if (!tenantId || !clientId || !clientSecret || !userEmail) {
      return jsonError('Missing Tenant ID, Client ID, Client Secret, or User Email', 400)
    }

    // Try acquiring OAuth token
    const tokenParams = new URLSearchParams()
    tokenParams.append('client_id', clientId)
    tokenParams.append('scope', 'https://graph.microsoft.com/.default')
    tokenParams.append('client_secret', clientSecret)
    tokenParams.append('grant_type', 'client_credentials')

    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      body: tokenParams,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      return NextResponse.json({
        ok: false,
        error: `OAuth Authentication Failed: ${tokenRes.statusText} (${tokenRes.status}) - ${errText}`,
      })
    }

    const tokenData = await tokenRes.json()
    const acquiredToken = tokenData.access_token

    // Test querying the user profile using the acquired token
    const userRes = await fetch(`https://graph.microsoft.com/v1.0/users/${userEmail}`, {
      headers: { Authorization: `Bearer ${acquiredToken}` },
    })

    if (!userRes.ok) {
      const errText = await userRes.text()
      return NextResponse.json({
        ok: false,
        error: `Fetch user profile failed: ${userRes.statusText} (${userRes.status}) - ${errText}`,
      })
    }

    const profile = await userRes.json()
    return NextResponse.json({
      ok: true,
      method: 'ClientCredentials',
      user: {
        displayName: profile.displayName || 'Outlook User',
        mail: profile.mail || profile.userPrincipalName || userEmail,
      },
    })
  } catch (err) {
    return apiCatch(err)
  }
}
