import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

const STAR_RATING_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
}

type GoogleConnection = {
  id: string
  access_token: string
  refresh_token: string | null
  expires_at: string | null
}

type GoogleReview = {
  reviewId: string
  starRating: string
  comment?: string
  createTime?: string
  reviewerLanguage?: string
  reviewer?: {
    displayName?: string
    profilePhotoUrl?: string
  }
  reviewReply?: {
    comment?: string
    updateTime?: string
  }
}

type PlacesReview = {
  author_name: string
  author_url?: string
  language?: string
  profile_photo_url?: string
  rating: number
  relative_time_description?: string
  text?: string
  time: number
}

async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth ortam değişkenleri eksik')
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
    throw new Error(errorData?.error || 'Google erişim tokenı yenilenemedi')
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
    throw new Error(data.error?.message || 'Google Business hesapları alınamadı')
  }

  return (data.accounts as Array<{ name: string }> | undefined) ?? []
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
      throw new Error(data.error?.message || 'Google lokasyonları alınamadı')
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

async function fetchAllReviews({
  accessToken,
  locationName,
}: {
  accessToken: string
  locationName: string
}) {
  let pageToken: string | undefined
  const reviews: GoogleReview[] = []
  let averageRating: number | null = null
  let totalReviewCount: number | null = null

  do {
    const url = new URL(`https://mybusiness.googleapis.com/v4/${locationName}/reviews`)
    url.searchParams.set('pageSize', '200')
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken)
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Google yorumları alınamadı')
    }

    if (typeof data.averageRating === 'number') {
      averageRating = data.averageRating
    }

    if (typeof data.totalReviewCount === 'number') {
      totalReviewCount = data.totalReviewCount
    }

    reviews.push(...(((data.reviews as GoogleReview[]) ?? [])))
    pageToken = data.nextPageToken as string | undefined
  } while (pageToken)

  return { reviews, averageRating, totalReviewCount }
}

function normalizeRating(starRating: string) {
  return STAR_RATING_MAP[starRating as keyof typeof STAR_RATING_MAP] ?? 1
}

async function fetchReviewsFromPlacesAPI(placeId: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    throw new Error('Google Places API key eksik')
  }

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total&key=${apiKey}`

  const response = await fetch(url)
  const data = await response.json()

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || 'Google Places API hatası')
  }

  const reviews = (data.result?.reviews as PlacesReview[] | undefined) ?? []
  const averageRating = (data.result?.rating as number | undefined) ?? null
  const totalReviewCount = (data.result?.user_ratings_total as number | undefined) ?? null

  return { reviews, averageRating, totalReviewCount }
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

    const { businessId } = await request.json()

    if (!businessId) {
      return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })
    }

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .eq('user_id', user.id)
      .single()

    if (businessError || !business) {
      return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
    }

    const { data: connection } = await supabase
      .from('google_connections')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    const typedConnection = connection as GoogleConnection | null
    const fetchedAt = new Date().toISOString()

    let reviews: any[] = []
    let averageRating: number | null = null
    let totalReviewCount: number | null = null
    let usedPlacesAPI = false

    // Try My Business API first if google_connections exists
    if (typedConnection) {
      try {
        let accessToken = typedConnection.access_token
        const now = new Date()

        if (typedConnection.expires_at && new Date(typedConnection.expires_at) <= now) {
          if (!typedConnection.refresh_token) {
            throw new Error('Token expired and no refresh token available')
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

        const googleLocation = await findLocationName({
          accessToken,
          placeId: business.place_id,
        })

        if (!googleLocation) {
          throw new Error('Location not found in My Business account')
        }

        const result = await fetchAllReviews({
          accessToken,
          locationName: googleLocation.locationName,
        })

        // Map My Business API reviews to common format
        reviews = result.reviews.map((review) => ({
          google_review_id: review.reviewId,
          author_name: review.reviewer?.displayName || 'Anonim Kullanıcı',
          author_photo_url: review.reviewer?.profilePhotoUrl || null,
          rating: normalizeRating(review.starRating),
          text: review.comment || '',
          language: review.reviewerLanguage || null,
          has_reply: Boolean(review.reviewReply?.comment),
          reply_text: review.reviewReply?.comment || null,
          reply_author: review.reviewReply?.comment ? 'İşletme Sahibi' : null,
          replied_at: review.reviewReply?.updateTime || null,
          review_created_at: review.createTime || fetchedAt,
        }))

        averageRating = result.averageRating
        totalReviewCount = result.totalReviewCount
      } catch (error: any) {
        console.warn('My Business API failed, falling back to Places API:', error.message)
        usedPlacesAPI = true
      }
    } else {
      usedPlacesAPI = true
    }

    // Fallback to Places API if My Business API failed or no connection exists
    if (usedPlacesAPI) {
      const result = await fetchReviewsFromPlacesAPI(business.place_id)

      // Map Places API reviews to common format
      reviews = result.reviews.map((review, index) => ({
        google_review_id: `places_${business.place_id}_${review.time}_${index}`,
        author_name: review.author_name || 'Anonim Kullanıcı',
        author_photo_url: review.profile_photo_url || null,
        rating: review.rating,
        text: review.text || '',
        language: review.language || null,
        has_reply: false,
        reply_text: null,
        reply_author: null,
        replied_at: null,
        review_created_at: new Date(review.time * 1000).toISOString(),
      }))

      averageRating = result.averageRating
      totalReviewCount = result.totalReviewCount
    }

    const { data: existingReviews } = await supabase
      .from('reviews')
      .select('id, google_review_id, has_reply, reply_text, reply_author, replied_at')
      .eq('business_id', business.id)

    const existingMap = new Map(
      (existingReviews || []).map((review) => [review.google_review_id, review])
    )

    const newReviews: any[] = []
    const updatedReviews: any[] = []

    reviews.forEach((review) => {
      if (!review.google_review_id) {
        return
      }

      const existingReview = existingMap.get(review.google_review_id)

      // If Places API is used and existing review has reply info, preserve it
      // (Places API doesn't return reply data, so we keep what we have)
      const shouldPreserveReply = usedPlacesAPI && existingReview && existingReview.has_reply

      const baseReview = {
        business_id: business.id,
        google_review_id: review.google_review_id,
        author_name: review.author_name,
        author_photo_url: review.author_photo_url,
        rating: review.rating,
        text: review.text,
        language: review.language,
        sentiment: null,
        has_reply: shouldPreserveReply ? existingReview.has_reply : review.has_reply,
        reply_text: shouldPreserveReply ? existingReview.reply_text : review.reply_text,
        reply_author: shouldPreserveReply ? existingReview.reply_author : review.reply_author,
        replied_at: shouldPreserveReply ? existingReview.replied_at : review.replied_at,
        review_created_at: review.review_created_at,
        fetched_at: fetchedAt,
      }

      if (existingReview) {
        updatedReviews.push({ ...baseReview, id: existingReview.id })
      } else {
        newReviews.push(baseReview)
      }
    })

    if (newReviews.length) {
      const { error: insertError } = await supabase.from('reviews').insert(newReviews)

      if (insertError) {
        console.error('Review insert error:', insertError)
        return NextResponse.json({ error: 'Yorumlar kaydedilemedi' }, { status: 500 })
      }
    }

    if (updatedReviews.length) {
      const { error: updateError } = await supabase.from('reviews').upsert(updatedReviews)

      if (updateError) {
        console.error('Review update error:', updateError)
        return NextResponse.json({ error: 'Yorumlar güncellenemedi' }, { status: 500 })
      }
    }

    const syncTimestamp = new Date().toISOString()

    await supabase
      .from('businesses')
      .update({
        rating: averageRating ?? business.rating,
        total_reviews: totalReviewCount ?? reviews.length,
        last_sync_at: syncTimestamp,
        updated_at: syncTimestamp,
      })
      .eq('id', business.id)

    return NextResponse.json({
      success: true,
      inserted: newReviews.length,
      updated: updatedReviews.length,
      usedPlacesAPI,
      message: usedPlacesAPI
        ? 'Yorumlar Places API ile senkronize edildi (maksimum 5 yorum). Tüm yorumlar için Google Business hesabınızı bağlamanız gerekiyor.'
        : 'Yorumlar My Business API ile senkronize edildi.',
      business: {
        id: business.id,
        rating: averageRating ?? business.rating,
        total_reviews: totalReviewCount ?? reviews.length,
        last_sync_at: syncTimestamp,
      },
    })
  } catch (error: any) {
    console.error('Review sync error:', error)
    return NextResponse.json(
      { error: error.message || 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
