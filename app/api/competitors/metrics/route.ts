import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

type TimeSeriesPoint = {
  date: string
  review_count: number
  avg_rating: number | null
}

type RankingItem = {
  id: string
  name: string
  rating: number | null
  total_reviews: number
  last_sync_at: string | null
}

async function fetchBusinessTimeSeries(supabase: ReturnType<typeof createClient>, businessId: string) {
  const { data, error } = await supabase
    .from('reviews')
    .select('rating, review_created_at')
    .eq('business_id', businessId)
    .gte('review_created_at', new Date(Date.now() - 30 * 86400000).toISOString())

  if (error) {
    throw error
  }

  const seriesMap = new Map<string, { count: number; total: number }>()

  ;(data || []).forEach((review) => {
    const date = new Date(review.review_created_at).toISOString().slice(0, 10)
    const entry = seriesMap.get(date) || { count: 0, total: 0 }
    entry.count += 1
    entry.total += review.rating
    seriesMap.set(date, entry)
  })

  const points: TimeSeriesPoint[] = [...seriesMap.entries()].map(([date, entry]) => ({
    date,
    review_count: entry.count,
    avg_rating: entry.count ? parseFloat((entry.total / entry.count).toFixed(2)) : null,
  }))

  return points.sort((a, b) => a.date.localeCompare(b.date))
}

async function fetchCompetitorTimeSeries(
  supabase: ReturnType<typeof createClient>,
  competitorId: string
) {
  const { data, error } = await supabase
    .from('competitor_reviews')
    .select('rating, review_created_at')
    .eq('competitor_id', competitorId)
    .gte('review_created_at', new Date(Date.now() - 30 * 86400000).toISOString())

  if (error) {
    throw error
  }

  const seriesMap = new Map<string, { count: number; total: number }>()

  ;(data || []).forEach((review) => {
    const date = new Date(review.review_created_at).toISOString().slice(0, 10)
    const entry = seriesMap.get(date) || { count: 0, total: 0 }
    entry.count += 1
    entry.total += review.rating
    seriesMap.set(date, entry)
  })

  const points: TimeSeriesPoint[] = [...seriesMap.entries()].map(([date, entry]) => ({
    date,
    review_count: entry.count,
    avg_rating: entry.count ? parseFloat((entry.total / entry.count).toFixed(2)) : null,
  }))

  return points.sort((a, b) => a.date.localeCompare(b.date))
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 })
    }

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('id', businessId)
      .eq('user_id', user.id)
      .single()

    if (businessError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const { data: competitors, error: competitorsError } = await supabase
      .from('competitors')
      .select('*')
      .eq('business_id', businessId)
      .order('rating', { ascending: false })

    if (competitorsError) {
      throw competitorsError
    }

    const ownSeries = await fetchBusinessTimeSeries(supabase, businessId)

    const competitorRankings: RankingItem[] = (competitors || []).map((competitor) => ({
      id: competitor.id,
      name: competitor.competitor_name,
      rating: competitor.rating,
      total_reviews: competitor.total_reviews,
      last_sync_at: competitor.last_sync_at,
    }))

    const competitorSeries = await Promise.all(
      (competitors || []).map(async (competitor) => ({
        id: competitor.id,
        name: competitor.competitor_name,
        data: await fetchCompetitorTimeSeries(supabase, competitor.id),
      }))
    )

    return NextResponse.json({
      success: true,
      business: {
        id: business.id,
        name: business.name,
        time_series: ownSeries,
      },
      competitor_rankings: competitorRankings,
      competitor_series: competitorSeries,
    })
  } catch (error) {
    console.error('Competitor metrics error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
