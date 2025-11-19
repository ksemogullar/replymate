import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

// DELETE - Remove a competitor
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const competitorId = id

    if (!competitorId) {
      return NextResponse.json({ error: 'Competitor ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership through business
    const { data: competitor, error: competitorError } = await supabase
      .from('competitors')
      .select('id, business_id')
      .eq('id', competitorId)
      .single()

    if (competitorError || !competitor) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', competitor.business_id)
      .eq('user_id', user.id)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'You do not have permission to delete this competitor' }, { status: 403 })
    }

    // Delete competitor (cascade will delete reviews)
    const { error: deleteError } = await supabase.from('competitors').delete().eq('id', competitorId)

    if (deleteError) {
      console.error('Competitor delete error:', deleteError)
      return NextResponse.json({ error: 'Could not delete competitor' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Competitor deleted successfully',
    })
  } catch (error) {
    console.error('Delete competitor error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
