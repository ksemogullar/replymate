import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

type PlaceSearchResult = {
  place_id: string
  name: string
  formatted_address?: string
  rating?: number
  user_ratings_total?: number
  geometry?: {
    location: {
      lat: number
      lng: number
    }
  }
}

async function searchPlaces(query: string, location?: string): Promise<PlaceSearchResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    throw new Error('Google Places API key missing')
  }

  let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`

  if (location) {
    url += `&location=${location}&radius=5000`
  }

  const response = await fetch(url)
  const data = await response.json()

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || 'Google Places API error')
  }

  return (data.results as PlaceSearchResult[] | undefined) ?? []
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
    const query = searchParams.get('query')
    const location = searchParams.get('location') // Optional: "lat,lng" format

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ error: 'Search query must be at least 2 characters' }, { status: 400 })
    }

    // Search for places
    const results = await searchPlaces(query, location || undefined)

    // Limit to top 10 results
    const limitedResults = results.slice(0, 10).map((place) => ({
      place_id: place.place_id,
      name: place.name,
      address: place.formatted_address || '',
      rating: place.rating || null,
      total_reviews: place.user_ratings_total || 0,
      location: place.geometry?.location || null,
    }))

    return NextResponse.json({
      success: true,
      results: limitedResults,
    })
  } catch (error) {
    console.error('Search places error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
