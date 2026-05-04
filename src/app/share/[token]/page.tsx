'use client'
// src/app/share/[token]/page.tsx
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Scale, AlertCircle, Clock, FileText } from 'lucide-react'
import Link from 'next/link'

interface ShareData {
  title: string
  content: string
  processNumber: string
  cliente: string
  expiresAt: string
  createdAt: string
}

export default function SharePage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<ShareData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/shares/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Erro ao carregar o parecer.'))
      .finally(() => setLoading(false))
  }, [token])

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0B1628] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-[#0B1628] flex flex-col items-center justify-center gap-4 px-4">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <AlertCircle size={26} className="text-red-400" />
      </div>
      <h1 className="text-[#F8F5EF] font-semibold text-lg text-center">{error}</h1>
      <p className="text-[#8899AA] text-sm text-center max-w-xs">
        O link pode ter expirado ou sido revogado pelo advogado responsável.
      </p>
      <Link href="/" className="mt-2 text-[#4F46E5] text-sm hover:underline">
        Conheça a IURISPRUDENTIA →
      </Link>
    </div>
  )

  if (!data) return null

  const expiresIn = Math.ceil((new Date(data.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  return (
    <div className="min-h-screen bg-[#0B1628]">
      {/* Header */}
      <header className="bg-[#0F1E35] border-b border-[#1E2D4A] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Scale size={20} className="text-[#4F46E5] flex-shrink-0" />
          <span className="text-[#F8F5EF] font-semibold text-sm truncate flex-1">{data.title}</span>
          <span className="hidden sm:flex items-center gap-1.5 text-[#8899AA] text-xs flex-shrink-0">
            <Clock size={12} />
            Expira em {expiresIn} {expiresIn === 1 ? 'dia' : 'dias'}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Meta */}
        <div className="mb-8 p-5 bg-[#0F1E35] border border-[#1E2D4A] rounded-xl space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={16} className="text-[#4F46E5]" />
            <h1 className="text-[#F8F5EF] font-semibold text-base">Parecer Jurídico</h1>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            {data.cliente && (
              <div>
                <span className="text-[#8899AA] text-xs">Cliente</span>
                <p className="text-[#F8F5EF] font-medium">{data.cliente}</p>
              </div>
            )}
            {data.processNumber && (
              <div>
                <span className="text-[#8899AA] text-xs">Nº do Processo</span>
                <p className="text-[#F8F5EF] font-mono text-xs">{data.processNumber}</p>
              </div>
            )}
            <div>
              <span className="text-[#8899AA] text-xs">Gerado em</span>
              <p className="text-[#F8F5EF]">{formatDate(data.createdAt)}</p>
            </div>
            <div>
              <span className="text-[#8899AA] text-xs">Link válido até</span>
              <p className="text-[#F8F5EF]">{formatDate(data.expiresAt)}</p>
            </div>
          </div>
        </div>

        {/* Parecer HTML */}
        <div
          className="prose prose-invert prose-sm sm:prose-base max-w-none bg-[#0F1E35] border border-[#1E2D4A] rounded-xl p-6 sm:p-8"
          dangerouslySetInnerHTML={{ __html: data.content }}
        />

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-[#1E2D4A] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8899AA]">
          <p>Este parecer foi gerado com assistência de IA e revisado pelo advogado responsável.</p>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[#4F46E5] hover:underline flex-shrink-0"
          >
            <Scale size={12} />
            Gerado com IURISPRUDENTIA
          </Link>
        </div>
      </main>
    </div>
  )
}
