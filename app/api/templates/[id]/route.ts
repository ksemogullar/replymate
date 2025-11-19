import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const templateId = id
    const body = await request.json()
    const { name, description, tone_type, language, instructions, example_response } = body

    if (!templateId) {
      return NextResponse.json({ error: 'Template id is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: template, error: templateError } = await supabase
      .from('tone_templates')
      .select('id, business_id')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: 'Şablon bulunamadı' }, { status: 404 })
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', template.business_id)
      .eq('user_id', user.id)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'Bu şablonu düzenleme izniniz yok' }, { status: 403 })
    }

    const { data: updatedTemplate, error: updateError } = await supabase
      .from('tone_templates')
      .update({
        name,
        description,
        tone_type,
        language,
        instructions,
        example_response,
      })
      .eq('id', templateId)
      .select('*')
      .single()

    if (updateError || !updatedTemplate) {
      throw updateError
    }

    return NextResponse.json({ success: true, template: updatedTemplate })
  } catch (error) {
    console.error('Template update error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const templateId = id
    if (!templateId) {
      return NextResponse.json({ error: 'Template id is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: template, error: templateError } = await supabase
      .from('tone_templates')
      .select('id, business_id')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: 'Şablon bulunamadı' }, { status: 404 })
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', template.business_id)
      .eq('user_id', user.id)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'Bu şablonu silme izniniz yok' }, { status: 403 })
    }

    const { error: deleteError } = await supabase
      .from('tone_templates')
      .delete()
      .eq('id', templateId)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Template delete error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
