import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json()

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Verify API key and get user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    // Fetch user's businesses with settings
    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, place_id, rating, total_reviews, default_language, default_tone, custom_instructions')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (businessError) {
      console.error('Businesses fetch error:', businessError)
      return NextResponse.json({ error: 'Could not fetch businesses' }, { status: 500 })
    }

    // Check if user has Google connection
    const { data: connection } = await supabase
      .from('google_connections')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
      businesses: businesses || [],
      hasGoogleConnection: Boolean(connection),
    })
  } catch (error) {
    console.error('Extension auth error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
