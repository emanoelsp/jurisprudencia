import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { requireServerAuth } from '@/lib/auth/server-auth'
import { v4 as uuidv4 } from 'uuid'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireServerAuth(req)

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Apenas arquivos PDF são aceitos.' }, { status: 400 })
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'PDF excede o limite de 20 MB.' }, { status: 400 })
    }

    const filename = `processos/${authUser.uid}/${uuidv4()}.pdf`
    const blob = await put(filename, file, { access: 'public', contentType: 'application/pdf' })

    return NextResponse.json({ url: blob.url })
  } catch (err: any) {
    if (String(err?.message || '').startsWith('UNAUTHORIZED:')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[processes/upload-pdf]', err)
    return NextResponse.json({ error: err.message || 'Erro ao fazer upload do PDF.' }, { status: 500 })
  }
}
