import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const businessId = id
    if (!businessId) {
      return NextResponse.json({ error: 'Business id is required' }, { status: 400 })
    }

    const body = await request.json()
    const { default_language, default_tone, custom_instructions } = body

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .eq('user_id', user.id)
      .single()

    if (businessError || !business) {
      return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
    }

    const { data: updatedBusiness, error: updateError } = await supabase
      .from('businesses')
      .update({
        default_language,
        default_tone,
        custom_instructions,
      })
      .eq('id', businessId)
      .select('*')
      .single()

    if (updateError) {
      console.error('Business settings update error:', updateError)
      return NextResponse.json({ error: 'Ayarlar güncellenemedi' }, { status: 500 })
    }

    return NextResponse.json({ success: true, business: updatedBusiness })
  } catch (error) {
    console.error('Business settings error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
