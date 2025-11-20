import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

type GoogleConnection = {
  id: string
  access_token: string
  refresh_token: string | null
  expires_at: string | null
}

async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth environment variables missing')
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.error || 'Could not refresh Google access token')
  }

  const data = await response.json()
  return {
    accessToken: data.access_token as string,
    refreshToken: (data.refresh_token as string | undefined) ?? null,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
  }
}

async function fetchAccounts(accessToken: string) {
  const response = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error?.message || 'Could not fetch Google Business accounts')
  }

  return (data.accounts as Array<{ name: string }> | undefined) ?? []
}

async function findLocationInAccount({
  accountName,
  accessToken,
  placeId,
}: {
  accountName: string
  accessToken: string
  placeId: string
}) {
  let pageToken: string | undefined

  do {
    const url = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`)
    url.searchParams.set('readMask', 'name,storeCode,metadata')
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken)
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Could not fetch Google locations')
    }

    const locations = (data.locations as Array<any> | undefined) ?? []
    const match = locations.find((location) => {
      const metadataPlaceId = location?.metadata?.placeId
      return metadataPlaceId === placeId || location?.storeCode === placeId
    })

    if (match?.name) {
      return match.name as string
    }

    pageToken = data.nextPageToken as string | undefined
  } while (pageToken)

  return null
}

async function findLocationName({
  accessToken,
  placeId,
}: {
  accessToken: string
  placeId: string
}) {
  const accounts = await fetchAccounts(accessToken)

  for (const account of accounts) {
    const locationName = await findLocationInAccount({
      accountName: account.name,
      accessToken,
      placeId,
    })

    if (locationName) {
      return { accountName: account.name, locationName }
    }
  }

  return null
}

async function postReplyToGoogle({
  accessToken,
  locationName,
  reviewId,
  replyText,
}: {
  accessToken: string
  locationName: string
  reviewId: string
  replyText: string
}) {
  // Extract just the review ID from the full path if needed
  // reviewId might be like "accounts/XXX/locations/YYY/reviews/ZZZ"
  // We need just "ZZZ"
  const reviewIdOnly = reviewId.includes('/reviews/')
    ? reviewId.split('/reviews/')[1]
    : reviewId

  const url = `https://mybusiness.googleapis.com/v4/${locationName}/reviews/${reviewIdOnly}/reply`

  console.log('🔗 Posting reply to Google:', {
    url,
    originalReviewId: reviewId,
    extractedReviewId: reviewIdOnly,
    replyLength: replyText.length,
  })

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      comment: replyText,
    }),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    console.error('❌ Google API Error:', {
      status: response.status,
      statusText: response.statusText,
      error: data?.error,
      url,
    })
    throw new Error(data?.error?.message || 'Could not post reply to Google')
  }

  console.log('✅ Reply posted successfully to Google')
  return data
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { businessId, reviewId, replyText } = await request.json()

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 })
    }

    if (!reviewId) {
      return NextResponse.json({ error: 'Review ID is required' }, { status: 400 })
    }

    if (!replyText || typeof replyText !== 'string') {
      return NextResponse.json({ error: 'Reply text is required' }, { status: 400 })
    }

    // Fetch business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, place_id')
      .eq('id', businessId)
      .eq('user_id', user.id)
      .single()

    if (businessError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Fetch Google connection
    const { data: connection } = await supabase
      .from('google_connections')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    const typedConnection = connection as GoogleConnection | null

    if (!typedConnection) {
      return NextResponse.json(
        { error: 'Google Business account not connected. Please connect your Google account first.' },
        { status: 403 }
      )
    }

    // Refresh token if needed
    let accessToken = typedConnection.access_token
    const now = new Date()

    if (typedConnection.expires_at && new Date(typedConnection.expires_at) <= now) {
      if (!typedConnection.refresh_token) {
        return NextResponse.json(
          { error: 'Token expired and no refresh token available. Please reconnect your Google account.' },
          { status: 401 }
        )
      }

      const refreshed = await refreshAccessToken(typedConnection.refresh_token)
      accessToken = refreshed.accessToken

      await supabase
        .from('google_connections')
        .update({
          access_token: refreshed.accessToken,
          refresh_token: refreshed.refreshToken ?? typedConnection.refresh_token,
          expires_at: refreshed.expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', typedConnection.id)
    }

    // Find location name
    const googleLocation = await findLocationName({
      accessToken,
      placeId: business.place_id,
    })

    if (!googleLocation) {
      return NextResponse.json(
        { error: 'Location not found in My Business account' },
        { status: 404 }
      )
    }

    // Post reply to Google
    await postReplyToGoogle({
      accessToken,
      locationName: googleLocation.locationName,
      reviewId,
      replyText,
    })

    // Update review in database
    const repliedAt = new Date().toISOString()

    await supabase
      .from('reviews')
      .update({
        has_reply: true,
        reply_text: replyText,
        reply_author: 'İşletme Sahibi',
        replied_at: repliedAt,
      })
      .eq('business_id', businessId)
      .eq('google_review_id', reviewId)

    return NextResponse.json({
      success: true,
      message: 'Reply posted successfully',
      replied_at: repliedAt,
    })
  } catch (error: any) {
    console.error('Post reply error:', error)
    return NextResponse.json(
      { error: error.message || 'An error occurred' },
      { status: 500 }
    )
  }
}
