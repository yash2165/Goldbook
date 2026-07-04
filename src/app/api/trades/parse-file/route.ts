import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseAngelOneTaxReportText } from '@/lib/angel-one-parser'
import { extractText } from 'unpdf'
import * as XLSX from 'xlsx'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    let text = ''
    const fileName = file.name.toLowerCase()

    if (fileName.endsWith('.pdf')) {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const res = await extractText(uint8Array)
      text = Array.isArray(res.text) ? res.text.join('\n') : (res.text || '')
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      text = XLSX.utils.sheet_to_csv(worksheet)
    } else {
      text = await file.text()
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Could not extract text from uploaded file.' }, { status: 400 })
    }

    const parsedReport = parseAngelOneTaxReportText(text)

    return NextResponse.json({
      success: true,
      filename: file.name,
      extractedTextSnippet: text.substring(0, 500),
      parsedReport
    })
  } catch (err: any) {
    console.error('File parsing route error:', err)
    return NextResponse.json({ error: err.message || 'Failed to parse file' }, { status: 500 })
  }
}
