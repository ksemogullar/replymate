import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

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

    const { businessId, limit = 50, offset = 0, filterByReplied } = await request.json()

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 })
    }

    // Verify business ownership
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, place_id, rating, total_reviews')
      .eq('id', businessId)
      .eq('user_id', user.id)
      .single()

    if (businessError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Build query
    let query = supabase
      .from('reviews')
      .select('*')
      .eq('business_id', businessId)
      .order('review_created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filter if specified
    if (filterByReplied === 'replied') {
      query = query.eq('has_reply', true)
    } else if (filterByReplied === 'not_replied') {
      query = query.eq('has_reply', false)
    }

    const { data: reviews, error: reviewsError } = await query

    if (reviewsError) {
      console.error('Reviews fetch error:', reviewsError)
      return NextResponse.json({ error: 'Could not fetch reviews' }, { status: 500 })
    }

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)

    return NextResponse.json({
      success: true,
      business,
      reviews: reviews || [],
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Extension reviews error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
