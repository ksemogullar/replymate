import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { placeId } = await request.json()

    if (!placeId) {
      return NextResponse.json({ error: 'Place ID gerekli' }, { status: 400 })
    }

    // Fetch business details from Google Places API
    const apiKey = process.env.GOOGLE_PLACES_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Places API key yapılandırılmamış' },
        { status: 500 }
      )
    }

    // Google Places API - Place Details
    const placeDetailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,types&key=${apiKey}`

    const placeResponse = await fetch(placeDetailsUrl)
    const placeData = await placeResponse.json()

    if (placeData.status !== 'OK') {
      return NextResponse.json(
        { error: `Google Places API hatası: ${placeData.status}` },
        { status: 400 }
      )
    }

    const place = placeData.result

    // Check if business already exists
    const { data: existingBusiness } = await supabase
      .from('businesses')
      .select('id')
      .eq('place_id', placeId)
      .single()

    if (existingBusiness) {
      return NextResponse.json(
        { error: 'Bu işletme zaten eklenmiş' },
        { status: 400 }
      )
    }

    // Insert business into database
    const { data: business, error: insertError } = await supabase
      .from('businesses')
      .insert({
        user_id: user.id,
        place_id: placeId,
        name: place.name,
        address: place.formatted_address,
        phone: place.formatted_phone_number,
        website: place.website,
        rating: place.rating,
        total_reviews: place.user_ratings_total,
        category: place.types?.[0] || null,
        is_active: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      return NextResponse.json(
        { error: 'İşletme kaydedilemedi' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      business,
    })
  } catch (error: any) {
    console.error('Business connect error:', error)
    return NextResponse.json(
      { error: error.message || 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
