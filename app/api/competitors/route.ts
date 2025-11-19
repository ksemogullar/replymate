import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

type PlaceDetails = {
  name?: string
  formatted_address?: string
  rating?: number
  user_ratings_total?: number
}

async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    throw new Error('Google Places API key missing')
  }

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,rating,user_ratings_total&key=${apiKey}`

  const response = await fetch(url)
  const data = await response.json()

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || 'Google Places API error')
  }

  return data.result || null
}

// GET - List competitors for a business
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

    // Verify business ownership
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .eq('user_id', user.id)
      .single()

    if (businessError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Fetch competitors
    const { data: competitors, error: competitorsError } = await supabase
      .from('competitors')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (competitorsError) {
      console.error('Competitors fetch error:', competitorsError)
      return NextResponse.json({ error: 'Could not fetch competitors' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      competitors: competitors || [],
    })
  } catch (error) {
    console.error('Get competitors error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST - Add a new competitor
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { businessId, placeId } = await request.json()

    if (!businessId || !placeId) {
      return NextResponse.json({ error: 'Business ID and Place ID are required' }, { status: 400 })
    }

    // Verify business ownership
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, place_id')
      .eq('id', businessId)
      .eq('user_id', user.id)
      .single()

    if (businessError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Don't allow adding own business as competitor
    if (business.place_id === placeId) {
      return NextResponse.json({ error: 'Cannot add your own business as a competitor' }, { status: 400 })
    }

    // Check if competitor already exists
    const { data: existingCompetitor } = await supabase
      .from('competitors')
      .select('id')
      .eq('business_id', businessId)
      .eq('competitor_place_id', placeId)
      .maybeSingle()

    if (existingCompetitor) {
      return NextResponse.json({ error: 'This competitor is already added' }, { status: 409 })
    }

    // Fetch place details from Google
    const placeDetails = await fetchPlaceDetails(placeId)

    if (!placeDetails || !placeDetails.name) {
      return NextResponse.json({ error: 'Could not fetch competitor details from Google' }, { status: 404 })
    }

    // Insert competitor
    const { data: competitor, error: insertError } = await supabase
      .from('competitors')
      .insert({
        business_id: businessId,
        competitor_place_id: placeId,
        competitor_name: placeDetails.name,
        address: placeDetails.formatted_address || null,
        rating: placeDetails.rating || null,
        total_reviews: placeDetails.user_ratings_total || 0,
        last_sync_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error('Competitor insert error:', insertError)
      return NextResponse.json({ error: 'Could not add competitor' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      competitor,
      message: 'Competitor added successfully',
    })
  } catch (error) {
    console.error('Add competitor error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
