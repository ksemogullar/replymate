import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

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

async function fetchReviewsFromPlacesAPI(placeId: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    throw new Error('Google Places API key missing')
  }

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total&key=${apiKey}`

  const response = await fetch(url)
  const data = await response.json()

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || 'Google Places API error')
  }

  const reviews = (data.result?.reviews as PlacesReview[] | undefined) ?? []
  const averageRating = (data.result?.rating as number | undefined) ?? null
  const totalReviewCount = (data.result?.user_ratings_total as number | undefined) ?? null

  return { reviews, averageRating, totalReviewCount }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const competitorId = id

    if (!competitorId) {
      return NextResponse.json({ error: 'Competitor ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership and get competitor
    const { data: competitor, error: competitorError } = await supabase
      .from('competitors')
      .select('*, businesses!inner(user_id)')
      .eq('id', competitorId)
      .single()

    if (competitorError || !competitor) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
    }

    // @ts-ignore - businesses is joined
    if (competitor.businesses.user_id !== user.id) {
      return NextResponse.json({ error: 'You do not have permission to sync this competitor' }, { status: 403 })
    }

    const fetchedAt = new Date().toISOString()

    // Fetch reviews from Places API
    const result = await fetchReviewsFromPlacesAPI(competitor.competitor_place_id)

    // Map Places API reviews to our format
    const reviews = result.reviews.map((review, index) => ({
      google_review_id: `places_${competitor.competitor_place_id}_${review.time}_${index}`,
      author_name: review.author_name || 'Anonymous',
      author_photo_url: review.profile_photo_url || null,
      rating: review.rating,
      text: review.text || '',
      language: review.language || null,
      review_created_at: new Date(review.time * 1000).toISOString(),
    }))

    // Get existing reviews
    const { data: existingReviews } = await supabase
      .from('competitor_reviews')
      .select('id, google_review_id')
      .eq('competitor_id', competitorId)

    const existingMap = new Map((existingReviews || []).map((r) => [r.google_review_id, r.id]))

    const newReviews: any[] = []
    const updatedReviews: any[] = []

    reviews.forEach((review) => {
      const baseReview = {
        competitor_id: competitorId,
        google_review_id: review.google_review_id,
        author_name: review.author_name,
        author_photo_url: review.author_photo_url,
        rating: review.rating,
        text: review.text,
        language: review.language,
        review_created_at: review.review_created_at,
        fetched_at: fetchedAt,
      }

      const existingId = existingMap.get(review.google_review_id)
      if (existingId) {
        updatedReviews.push({ ...baseReview, id: existingId })
      } else {
        newReviews.push(baseReview)
      }
    })

    // Insert new reviews
    if (newReviews.length) {
      const { error: insertError } = await supabase.from('competitor_reviews').insert(newReviews)

      if (insertError) {
        console.error('Competitor reviews insert error:', insertError)
        return NextResponse.json({ error: 'Could not save reviews' }, { status: 500 })
      }
    }

    // Update existing reviews
    if (updatedReviews.length) {
      const { error: updateError } = await supabase.from('competitor_reviews').upsert(updatedReviews)

      if (updateError) {
        console.error('Competitor reviews update error:', updateError)
        return NextResponse.json({ error: 'Could not update reviews' }, { status: 500 })
      }
    }

    // Update competitor stats
    const syncTimestamp = new Date().toISOString()

    await supabase
      .from('competitors')
      .update({
        rating: result.averageRating,
        total_reviews: result.totalReviewCount ?? reviews.length,
        last_sync_at: syncTimestamp,
        updated_at: syncTimestamp,
      })
      .eq('id', competitorId)

    return NextResponse.json({
      success: true,
      inserted: newReviews.length,
      updated: updatedReviews.length,
      competitor: {
        id: competitorId,
        rating: result.averageRating,
        total_reviews: result.totalReviewCount ?? reviews.length,
        last_sync_at: syncTimestamp,
      },
      message: `Rakip verileri senkronize edildi. ${reviews.length} yorum (maksimum 5 yorum Places API limiti)`,
    })
  } catch (error: any) {
    console.error('Competitor sync error:', error)
    return NextResponse.json({ error: error.message || 'An error occurred' }, { status: 500 })
  }
}
