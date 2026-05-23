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
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.' }, { status: 400 })
    }

    // Limit file size to 2MB to save storage space
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size allowed is 2MB.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const fileExt = file.name.split('.').pop() || 'jpg'
    const fileName = `avatars/${user.id}_${Date.now()}.${fileExt}`

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

    const avatarUrl = urlData.publicUrl

    // Update profile in DB
    const { error: dbErr } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id)

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, avatarUrl })
  } catch (error: any) {
    console.error('Avatar upload error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
