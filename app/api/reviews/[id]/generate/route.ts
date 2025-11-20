import { NextResponse } from 'next/server'

import { buildReviewPrompt, generateGeminiReply } from '@/lib/ai/replies'
import { createClient } from '@/lib/supabase/server'

type GenerateParams = {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: Request, { params }: GenerateParams) {
  try {
    const { id: reviewId } = await params

    if (!reviewId) {
      return NextResponse.json({ error: 'Review ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tone, language } = await request.json().catch(() => ({}))

    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select('id, business_id, text, author_name, rating, language, google_review_id')
      .eq('id', reviewId)
      .single()

    if (reviewError || !review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, default_language, default_tone, custom_instructions')
      .eq('id', review.business_id)
      .eq('user_id', user.id)
      .single()

    if (businessError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const finalLanguage = language || review.language || business.default_language || 'Türkçe'
    const finalTone = tone || business.default_tone || 'Profesyonel'

    const { data: template } = await supabase
      .from('tone_templates')
      .select('instructions, example_response')
      .eq('business_id', business.id)
      .eq('tone_type', finalTone)
      .eq('language', finalLanguage)
      .maybeSingle()

    const fallbackReviewText =
      review.text?.trim() ||
      `Müşteri yorum yazmadı ancak işletmenize ${
        review.rating ? `${review.rating}/5` : ''
      } yıldız verdi. Bu duruma uygun teşekkür yanıtı oluştur.`

    let enrichedReview = fallbackReviewText
    if (review.author_name) {
      enrichedReview = `Yorum Sahibi: ${review.author_name}\n${enrichedReview}`
    }
    if (review.rating) {
      enrichedReview = `Puan: ${review.rating}/5\n${enrichedReview}`
    }
    if (review.google_review_id) {
      enrichedReview += `\nReview ID: ${review.google_review_id}`
    }

    const prompt = buildReviewPrompt({
      review: enrichedReview,
      language: finalLanguage,
      tone: finalTone,
      customInstructions: business.custom_instructions || undefined,
      templateInstructions: template?.instructions || undefined,
      exampleResponse: template?.example_response || undefined,
    })

    const reply = await generateGeminiReply(prompt)

    const { data: aiResponse, error: insertError } = await supabase
      .from('ai_responses')
      .insert({
        review_id: review.id,
        business_id: business.id,
        response_text: reply,
        tone: finalTone,
        language: finalLanguage,
      })
      .select()
      .single()

    if (insertError || !aiResponse) {
      console.error('AI response insert error:', insertError)
      return NextResponse.json({ error: 'AI response could not be saved' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      reply,
      response: aiResponse,
      business: {
        id: business.id,
        name: business.name,
        language: finalLanguage,
        tone: finalTone,
      },
    })
  } catch (error) {
    console.error('Generate review reply error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
