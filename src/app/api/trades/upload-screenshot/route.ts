import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET handler to fetch all screenshots for a specific trade
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const tradeId = searchParams.get('tradeId')

    if (!tradeId) {
      return NextResponse.json({ error: 'Missing tradeId' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('trade_screenshots')
      .select('*')
      .eq('trade_id', tradeId)
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, screenshots: data })
  } catch (error: any) {
    console.error('Fetch screenshots error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}

// POST handler to upload a new screenshot for a trade
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const tradeId = formData.get('tradeId') as string | null
    const caption = formData.get('caption') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!tradeId) {
      return NextResponse.json({ error: 'Missing tradeId' }, { status: 400 })
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, GIF, and WEBP images are allowed.' }, { status: 400 })
    }

    // Limit size to 4MB
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 4MB.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const fileExt = file.name.split('.').pop() || 'png'
    const fileName = `screenshots/${tradeId}_${Date.now()}.${fileExt}`

    // Upload to Supabase Storage 'chat_images' bucket
    const { data: uploadData, error: uploadErr } = await supabase
      .storage
      .from('chat_images')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true
      })

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr)
      return NextResponse.json({ error: uploadErr.message }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase
      .storage
      .from('chat_images')
      .getPublicUrl(uploadData.path)

    const screenshotUrl = urlData.publicUrl

    // Insert new row into trade_screenshots
    const { data, error: dbErr } = await supabase
      .from('trade_screenshots')
      .insert({
        trade_id: tradeId,
        user_id: user.id,
        url: screenshotUrl,
        caption: caption || '',
        sort_order: Date.now() // default sorting
      })
      .select()
      .single()

    if (dbErr) {
      console.error('DB insert error:', dbErr)
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, screenshot: data })
  } catch (error: any) {
    console.error('Screenshot upload error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}

// PUT handler to update caption or sort_order of screenshots
export async function PUT(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { updates } = body // Expects Array of { id: string, caption?: string, sort_order?: number }

    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: 'updates must be an array' }, { status: 400 })
    }

    const results = []
    for (const update of updates) {
      const { id, caption, sort_order } = update
      const updateData: any = {}
      if (caption !== undefined) updateData.caption = caption
      if (sort_order !== undefined) updateData.sort_order = sort_order

      const { data, error } = await supabase
        .from('trade_screenshots')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (!error && data) {
        results.push(data)
      }
    }

    return NextResponse.json({ success: true, screenshots: results })
  } catch (error: any) {
    console.error('Update screenshots error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}

// DELETE handler to delete a specific screenshot
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing screenshot ID' }, { status: 400 })
    }

    // Fetch the screenshot first to verify ownership and get storage URL
    const { data: screenshot, error: fetchErr } = await supabase
      .from('trade_screenshots')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchErr || !screenshot) {
      return NextResponse.json({ error: 'Screenshot not found' }, { status: 404 })
    }

    // Delete row from database
    const { error: dbErr } = await supabase
      .from('trade_screenshots')
      .delete()
      .eq('id', id)

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    // Attempt to extract the path to clean up storage
    try {
      const urlParts = screenshot.url.split('/chat_images/')
      if (urlParts.length > 1) {
        const filePath = urlParts[1]
        await supabase.storage.from('chat_images').remove([filePath])
      }
    } catch (storageErr) {
      console.error('Failed to remove file from storage:', storageErr)
    }

    return NextResponse.json({ success: true, message: 'Screenshot deleted successfully' })
  } catch (error: any) {
    console.error('Screenshot deletion error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
