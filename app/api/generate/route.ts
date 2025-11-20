import { NextResponse } from 'next/server'

import { buildReviewPrompt, generateGeminiReply } from '@/lib/ai/replies'

export async function POST(req: Request) {
  try {
    const { review, language, tone } = await req.json()

    if (!review || typeof review !== 'string') {
      return NextResponse.json({ error: 'Review text is required' }, { status: 400 })
    }

    if (!language || typeof language !== 'string') {
      return NextResponse.json({ error: 'Language is required' }, { status: 400 })
    }

    if (!tone || typeof tone !== 'string') {
      return NextResponse.json({ error: 'Tone is required' }, { status: 400 })
    }

    const prompt = buildReviewPrompt({ review, language, tone })
    const reply = await generateGeminiReply(prompt)

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Gemini API Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Server error', details: errorMessage }, { status: 500 })
  }
}
