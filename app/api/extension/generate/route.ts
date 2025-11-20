import { NextResponse } from 'next/server'

import { buildReviewPrompt, generateGeminiReply } from '@/lib/ai/replies'
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

    const { businessId, reviewText, authorName, rating } = await request.json()

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 })
    }

    if (!reviewText || typeof reviewText !== 'string') {
      return NextResponse.json({ error: 'Review text is required' }, { status: 400 })
    }

    // Fetch business settings
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, default_language, default_tone, custom_instructions')
      .eq('id', businessId)
      .eq('user_id', user.id)
      .single()

    if (businessError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const language = business.default_language || 'Türkçe'
    const tone = business.default_tone || 'Profesyonel'

    // Try to fetch matching tone template
    const { data: template } = await supabase
      .from('tone_templates')
      .select('instructions, example_response')
      .eq('business_id', businessId)
      .eq('tone_type', tone)
      .eq('language', language)
      .maybeSingle()

    // Build enriched review text with metadata
    let enrichedReview = reviewText
    if (authorName) {
      enrichedReview = `Yorum Sahibi: ${authorName}\nYorum: ${reviewText}`
    }
    if (rating) {
      enrichedReview = `Puan: ${rating}/5\n${enrichedReview}`
    }

    const prompt = buildReviewPrompt({
      review: enrichedReview,
      language,
      tone,
      customInstructions: business.custom_instructions || undefined,
      templateInstructions: template?.instructions || undefined,
      exampleResponse: template?.example_response || undefined,
    })

    const reply = await generateGeminiReply(prompt)

    return NextResponse.json({
      success: true,
      reply,
      business: {
        name: business.name,
        language,
        tone,
      },
    })
  } catch (error) {
    console.error('Extension generate error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
