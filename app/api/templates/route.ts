import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: businesses } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (!businesses || businesses.length === 0) {
      return NextResponse.json({ templates: [] })
    }

    const businessIds = businesses.map((business) => business.id)

    const { data: templates, error } = await supabase
      .from('tone_templates')
      .select('*')
      .in('business_id', businessIds)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ templates: templates || [] })
  } catch (error) {
    console.error('Templates fetch error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

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

    const body = await request.json()
    const { business_id, name, description, tone_type, language, instructions, example_response } = body

    if (!business_id || !name || !tone_type || !language || !instructions) {
      return NextResponse.json({ error: 'Eksik alanlar var' }, { status: 400 })
    }

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', business_id)
      .eq('user_id', user.id)
      .single()

    if (businessError || !business) {
      return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
    }

    const { data: template, error: insertError } = await supabase
      .from('tone_templates')
      .insert({
        business_id,
        name,
        description,
        tone_type,
        language,
        instructions,
        example_response,
      })
      .select('*')
      .single()

    if (insertError || !template) {
      throw insertError
    }

    return NextResponse.json({ success: true, template })
  } catch (error) {
    console.error('Template create error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
