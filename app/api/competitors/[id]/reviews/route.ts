import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Verify ownership
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
      return NextResponse.json({ error: 'You do not have permission to view these reviews' }, { status: 403 })
    }

    // Fetch reviews
    const { data: reviews, error: reviewsError } = await supabase
      .from('competitor_reviews')
      .select('*')
      .eq('competitor_id', competitorId)
      .order('review_created_at', { ascending: false })

    if (reviewsError) {
      console.error('Competitor reviews fetch error:', reviewsError)
      return NextResponse.json({ error: 'Could not fetch reviews' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      reviews: reviews || [],
      competitor: {
        id: competitor.id,
        name: competitor.competitor_name,
        rating: competitor.rating,
        total_reviews: competitor.total_reviews,
      },
    })
  } catch (error) {
    console.error('Get competitor reviews error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
