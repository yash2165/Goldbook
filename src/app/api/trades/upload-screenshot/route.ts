import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!tradeId) {
      return NextResponse.json({ error: 'Missing tradeId' }, { status: 400 })
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.' }, { status: 400 })
    }

    // Limit size to 4MB for high-fidelity trading charts
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 4MB.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const fileExt = file.name.split('.').pop() || 'png'
    const fileName = `screenshots/${tradeId}_${Date.now()}.${fileExt}`

    // Upload to Supabase Storage bucket 'chat_images'
    const { data: uploadData, error: uploadErr } = await supabase
      .storage
      .from('chat_images')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true
      })

    if (uploadErr) {
      console.error('Supabase storage upload error:', uploadErr)
      return NextResponse.json({ error: uploadErr.message }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase
      .storage
      .from('chat_images')
      .getPublicUrl(uploadData.path)

    const screenshotUrl = urlData.publicUrl

    // Update screenshot_url inside trades table
    const { error: dbErr } = await supabase
      .from('trades')
      .update({ screenshot_url: screenshotUrl })
      .eq('id', tradeId)
      .eq('user_id', user.id)

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, screenshotUrl })
  } catch (error: any) {
    console.error('Screenshot upload error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
