import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

type CategoryKey = 'service' | 'price' | 'quality' | 'staff' | 'cleanliness' | 'speed' | 'other'

const CATEGORY_KEYWORDS: Record<CategoryKey, string[]> = {
  service: ['servis', 'service', 'müşteri', 'customer', 'experience', 'deneyim', 'karşılama'],
  price: ['fiyat', 'price', 'pahalı', 'cheap', 'ücret', 'discount'],
  quality: ['lezzet', 'tat', 'quality', 'ürün', 'product', 'tatlı', 'kahve'],
  staff: ['personel', 'çalışan', 'staff', 'garson', 'barista', 'waiter'],
  cleanliness: ['temiz', 'clean', 'hijyen', 'kirli', 'pis'],
  speed: ['bekleme', 'hızlı', 'slow', 'fast', 'queue', 'sıra', 'gecikme'],
  other: [],
}

function detectCategory(text?: string | null): CategoryKey {
  if (!text) return 'other'
  const lower = text.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return category as CategoryKey
    }
  }
  return 'other'
}

function sentimentFromRating(rating: number | null) {
  if (rating === null || rating === undefined) return 'neutral'
  if (rating >= 4) return 'positive'
  if (rating <= 2) return 'negative'
  return 'neutral'
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
      .select('id')
      .eq('id', businessId)
      .eq('user_id', user.id)
      .single()

    if (businessError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const oneMonthAgo = new Date(Date.now() - 30 * 86400000).toISOString()

    const [{ data: ownReviews }, { data: competitorList }] = await Promise.all([
      supabase
        .from('reviews')
        .select('rating, review_created_at, text')
        .eq('business_id', businessId)
        .gte('review_created_at', oneMonthAgo),
      supabase
        .from('competitors')
        .select('id, competitor_name')
        .eq('business_id', businessId),
    ])

    const competitorIds = (competitorList || []).map((c) => c.id)

    const { data: competitorReviews } = await supabase
      .from('competitor_reviews')
      .select('competitor_id, rating, review_created_at, text')
      .in('competitor_id', competitorIds.length ? competitorIds : ['00000000-0000-0000-0000-000000000000'])
      .gte('review_created_at', oneMonthAgo)

    const buildAggregation = (items: any[]) => {
      const result: Record<CategoryKey, { positive: number; negative: number; neutral: number }> = {
        service: { positive: 0, negative: 0, neutral: 0 },
        price: { positive: 0, negative: 0, neutral: 0 },
        quality: { positive: 0, negative: 0, neutral: 0 },
        staff: { positive: 0, negative: 0, neutral: 0 },
        cleanliness: { positive: 0, negative: 0, neutral: 0 },
        speed: { positive: 0, negative: 0, neutral: 0 },
        other: { positive: 0, negative: 0, neutral: 0 },
      }

      items.forEach((item) => {
        const category = detectCategory(item.text)
        const sentiment = sentimentFromRating(item.rating)
        result[category][sentiment as 'positive' | 'negative' | 'neutral'] += 1
      })

      return result
    }

    const ownCategories = buildAggregation(ownReviews || [])

    const competitorCategories = (competitorList || []).map((competitor) => ({
      id: competitor.id,
      name: competitor.competitor_name,
      categories: buildAggregation((competitorReviews || []).filter((r) => r.competitor_id === competitor.id)),
    }))

    return NextResponse.json({
      success: true,
      own_categories: ownCategories,
      competitor_categories: competitorCategories,
    })
  } catch (error) {
    console.error('Competitor category insights error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
