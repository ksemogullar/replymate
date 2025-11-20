import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

async function exchangeCodeForTokens({
  code,
  redirectUri,
}: {
  code: string
  redirectUri: string
}) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID veya GOOGLE_CLIENT_SECRET eksik')
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.error || 'Google token alınamadı')
  }

  return response.json()
}

export async function GET(request: NextRequest) {
  const redirectBase = `${request.nextUrl.origin}/dashboard`
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  const finishWith = (search: string) => {
    const response = NextResponse.redirect(`${redirectBase}?${search}`)
    response.cookies.delete('google_oauth_state')
    return response
  }

  if (errorParam) {
    return finishWith(`google_error=${encodeURIComponent(errorParam)}`)
  }

  if (!code || !state) {
    return finishWith('google_error=missing_code')
  }

  const stateCookie = request.cookies.get('google_oauth_state')?.value
  if (!stateCookie) {
    return finishWith('google_error=invalid_state')
  }

  const [storedState, storedUserId] = stateCookie.split(':')
  if (state !== storedState) {
    return finishWith('google_error=state_mismatch')
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user || user.id !== storedUserId) {
      return finishWith('google_error=unauthorized')
    }

    const redirectUri = `${request.nextUrl.origin}/api/google/callback`
    const tokens = await exchangeCodeForTokens({ code, redirectUri })
    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000)

    console.log('✅ Successfully exchanged code for tokens')
    console.log('Token details:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      tokenType: tokens.token_type,
      scope: tokens.scope,
      expiresIn: tokens.expires_in,
    })

    const { data: existingConnection } = await supabase
      .from('google_connections')
      .select('id, refresh_token')
      .eq('user_id', user.id)
      .maybeSingle()

    const refreshToken = tokens.refresh_token || existingConnection?.refresh_token || null

    console.log('Saving connection to database:', {
      userId: user.id,
      hasRefreshToken: !!refreshToken,
      expiresAt: expiresAt.toISOString(),
    })

    const { error: upsertError } = await supabase
      .from('google_connections')
      .upsert(
        {
          user_id: user.id,
          access_token: tokens.access_token,
          refresh_token: refreshToken,
          token_type: tokens.token_type,
          scope: tokens.scope,
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (upsertError) {
      console.error('❌ Google bağlantısı kaydedilemedi:', upsertError)
      return finishWith('google_error=storage_failed')
    }

    console.log('✅ Google connection saved successfully')
    return finishWith('google=connected')
  } catch (error) {
    console.error('Google OAuth callback hatası:', error)
    return finishWith('google_error=callback_failed')
  }
}
