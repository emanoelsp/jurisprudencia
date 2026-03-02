'use client'
// src/app/dashboard/processos/page.tsx
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { useDropzone } from 'react-dropzone'
import type { Processo, FormularioProcesso } from '@/types'
import { statusLabel, statusColor, formatDate } from '@/lib/utils'
import {
  Upload, FileText, Search, Plus, Loader2,
  CheckCircle, X, ArrowRight, Sparkles, Download, Trash2, AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { v4 as uuidv4 } from 'uuid'

const emptyForm: FormularioProcesso = {
  numero: '', cliente: '', natureza: '', vara: '', tribunal: '', dataProtocolo: '',
}
const STORAGE_UPLOAD_TIMEOUT_MS = 90_000
const STORAGE_URL_TIMEOUT_MS = 20_000

export default function ProcessosPage() {
  const { user } = useAuth()
  const router   = useRouter()

  const [processos, setProcessos]   = useState<Processo[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [showModal, setShowModal]   = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [form, setForm]             = useState<FormularioProcesso>(emptyForm)
  const [pdfFile, setPdfFile]       = useState<File | null>(null)
  const [pdfText, setPdfText]       = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Processo | null>(null)
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1)
  const [deletePhraseInput, setDeletePhraseInput] = useState('')
  const [deleteNumeroInput, setDeleteNumeroInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timeout apos ${ms}ms`)), ms)
      ),
    ])
  }

  useEffect(() => { loadProcessos() }, [user])

  async function loadProcessos() {
    if (!user) return
    setLoading(true)
    const q = query(
      collection(db, 'processos'),
      where('userId', '==', user.uid),
    )
    const snap = await getDocs(q)
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Processo[]
    data.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    setProcessos(data)
    setLoading(false)
  }

  async function getAuthHeaders() {
    const headers: Record<string, string> = {}
    const token = await user?.getIdToken()
    if (token) headers.Authorization = `Bearer ${token}`
    return headers
  }

  // Dropzone
  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setPdfFile(file)
    setExtracting(true)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const headers = await getAuthHeaders()
      const res  = await fetch('/api/ingest', { method: 'POST', body: formData, headers })
      const data = await res.json()
      if (data.metadata) {
        setForm(f => ({ ...f, ...data.metadata }))
        setPdfText(data.text || '')
        toast.success('Metadados extraidos com sucesso!')
      }
    } catch {
      toast.error('Erro ao extrair metadados.')
    } finally {
      setExtracting(false)
    }
  }, [user])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  })

  async function handleSave() {
    if (!user || !form.numero || !form.cliente) {
      toast.error('Numero do processo e cliente sao obrigatorios.')
      return
    }

    setSaving(true)
    const t0 = performance.now()
    console.log('[save-processo] start', {
      hasPdfFile: !!pdfFile,
      numero: form.numero,
      cliente: form.cliente,
      textoChars: pdfText.length,
    })
    try {
      let storageUrl = ''
      let storagePath = ''

      const skipStorage = process.env.NEXT_PUBLIC_SKIP_FIREBASE_STORAGE === 'true'
      if (pdfFile && !skipStorage) {
        const tUpload = performance.now()
        console.log('[save-processo] upload start', { sizeBytes: pdfFile.size, type: pdfFile.type })
        try {
          const fileRef = ref(storage, `processos/${user.uid}/${uuidv4()}.pdf`)
          await withTimeout(uploadBytes(fileRef, pdfFile), STORAGE_UPLOAD_TIMEOUT_MS, 'uploadBytes')
          storagePath = fileRef.fullPath
          console.log('[save-processo] upload done', { ms: Math.round(performance.now() - tUpload) })
          try {
            storageUrl = await withTimeout(getDownloadURL(fileRef), STORAGE_URL_TIMEOUT_MS, 'getDownloadURL')
            console.log('[save-processo] storage URL generated')
          } catch (readErr: any) {
            console.error('[save-processo] getDownloadURL failed', readErr)
          }
        } catch (uploadErr) {
          const message = (uploadErr as any)?.code || (uploadErr as any)?.message || 'erro desconhecido'
          console.warn('[save-processo] upload failed, salvando sem anexo', message)
          toast.success('Processo salvo sem PDF (Storage indisponivel). O texto extraido foi armazenado.')
        }
      } else if (pdfFile && skipStorage) {
        toast.success('Processo salvo. PDF nao armazenado (modo sem Storage).')
      }

      const processo: Omit<Processo, 'id'> = {
        ...form,
        textoOriginal: pdfText,
        aprovadoPeloAdvogado: false,
        status: 'pending',
        userId: user.uid,
        storageUrl,
        storagePath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const headers = {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders()),
      }
      const createRes = await withTimeout(
        fetch('/api/processes', {
          method: 'POST',
          headers,
          body: JSON.stringify({ processo }),
        }),
        12000,
        'POST /api/processes'
      )
      const createPayload = await createRes.json().catch(() => ({}))
      if (!createRes.ok) {
        throw new Error(createPayload?.error || 'Erro ao criar processo')
      }
      const docRef = { id: String(createPayload.id) }
      console.log('[save-processo] firestore addDoc done', {
        docId: docRef.id,
        totalMs: Math.round(performance.now() - t0),
      })
      toast.success('Processo salvo!')
      setShowModal(false)
      setForm(emptyForm)
      setPdfFile(null)
      router.push(`/dashboard/analisar/${docRef.id}`)
    } catch (err) {
      console.error('[save-processo] failed', err)
      toast.error('Erro ao salvar processo.')
    } finally {
      console.log('[save-processo] end', { totalMs: Math.round(performance.now() - t0) })
      setSaving(false)
    }
  }

  async function handleDownloadProcess(processo: Processo) {
    if (processo.status !== 'approved') {
      toast.error('Download disponivel apenas para processos aprovados.')
      return
    }

    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/processes/download?id=${processo.id}`, { headers })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Falha ao baixar PDF')
      }
      const blob = await res.blob()
      const objectUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `processo-${processo.numero || processo.id}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(objectUrl)
    } catch (err) {
      console.error('[processo-download] failed', err)
      toast.error('Nao foi possivel baixar o PDF.')
    }
  }

  function openDeleteDialog(processo: Processo) {
    setDeleteTarget(processo)
    setDeleteStep(1)
    setDeletePhraseInput('')
    setDeleteNumeroInput('')
  }

  function closeDeleteDialog() {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteStep(1)
    setDeletePhraseInput('')
    setDeleteNumeroInput('')
  }

  async function confirmDeleteProcess() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/processes?id=${deleteTarget.id}`, { method: 'DELETE', headers })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao excluir processo')
      }
      setProcessos(prev => prev.filter(p => p.id !== deleteTarget.id))
      toast.success('Processo excluido com sucesso.')
      closeDeleteDialog()
    } catch (err: any) {
      console.error('[processo-delete] failed', err)
      toast.error(err.message || 'Erro ao excluir processo.')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = processos.filter(p =>
    p.numero?.toLowerCase().includes(search.toLowerCase()) ||
    p.cliente?.toLowerCase().includes(search.toLowerCase()) ||
    p.natureza?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="section-title text-xl sm:text-2xl">Processos</h1>
          <p className="font-body text-brand-slate text-sm mt-1">
            {processos.length} processo{processos.length !== 1 ? 's' : ''} cadastrado{processos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary self-start sm:self-auto">
          <Plus size={16} />
          Novo Processo
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-slate" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por numero, cliente ou natureza..."
          className="input pl-11"
        />
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 size={24} className="text-brand-indigo animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 sm:p-12 text-center space-y-3">
            <FileText size={40} className="text-brand-border mx-auto" />
            <p className="font-body text-brand-slate text-sm">
              {search ? 'Nenhum processo encontrado.' : 'Nenhum processo cadastrado ainda.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-brand-border">
                    {['Numero CNJ', 'Cliente', 'Natureza', 'Status', 'Data', ''].map(h => (
                      <th key={h} className="px-5 py-3 text-left font-body text-xs font-semibold text-brand-slate uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-brand-navy/40 transition-colors group">
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs text-brand-cream">{p.numero || '--'}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-body text-sm text-brand-cream font-medium">{p.cliente}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-body text-xs text-brand-slate">{p.natureza || '--'}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`status-dot ${statusColor(p.status)}`} />
                          <span className="font-body text-xs text-brand-slate">{statusLabel(p.status)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-body text-xs text-brand-slate">{formatDate(p.createdAt)}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 justify-end">
                          <Link href={`/dashboard/analisar/${p.id}`} className="btn-ghost py-1 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                            Analisar <ArrowRight size={12} />
                          </Link>
                          {p.status === 'approved' && (p.storageUrl || p.storagePath) ? (
                            <button
                              onClick={() => handleDownloadProcess(p)}
                              className="btn-ghost py-1 px-2 text-xs"
                              title="Baixar PDF do processo aprovado"
                            >
                              <Download size={12} />
                            </button>
                          ) : (
                            <span
                              className="btn-ghost py-1 px-2 text-xs opacity-40 cursor-not-allowed"
                              title="Download disponivel apenas para processos aprovados"
                            >
                              <Download size={12} />
                            </span>
                          )}
                          <button
                            onClick={() => openDeleteDialog(p)}
                            className="btn-ghost py-1 px-2 text-xs text-red-300 hover:text-red-200"
                            title="Excluir processo"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-brand-border">
              {filtered.map(p => (
                <div key={p.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm font-semibold text-brand-cream truncate">{p.cliente}</p>
                      <p className="font-mono text-[11px] text-brand-slate mt-0.5 truncate">{p.numero || '--'}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`status-dot ${statusColor(p.status)}`} />
                      <span className="font-body text-[11px] text-brand-slate">{statusLabel(p.status)}</span>
                    </div>
                  </div>
                  {p.natureza && (
                    <p className="font-body text-xs text-brand-slate truncate">{p.natureza}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="font-body text-[11px] text-brand-slate">{formatDate(p.createdAt)}</span>
                    <div className="flex items-center gap-1">
                      <Link href={`/dashboard/analisar/${p.id}`} className="btn-ghost py-1.5 px-2 text-xs">
                        Analisar <ArrowRight size={12} />
                      </Link>
                      {p.status === 'approved' && (p.storageUrl || p.storagePath) && (
                        <button
                          onClick={() => handleDownloadProcess(p)}
                          className="btn-ghost py-1.5 px-2 text-xs"
                        >
                          <Download size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => openDeleteDialog(p)}
                        className="btn-ghost py-1.5 px-2 text-xs text-red-300"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal: Upload + Auto-fill */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-float rounded-t-2xl sm:rounded-xl">
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-brand-border sticky top-0 bg-brand-navylt z-10">
              <div>
                <h2 className="font-display font-bold text-brand-cream text-lg sm:text-xl">Novo Processo</h2>
                <p className="font-body text-brand-slate text-xs sm:text-sm mt-0.5">
                  Faca upload do PDF e a IA preenchera os metadados automaticamente.
                </p>
              </div>
              <button onClick={() => { setShowModal(false); setForm(emptyForm); setPdfFile(null) }} className="btn-ghost p-2">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5 sm:space-y-6">
              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200',
                  isDragActive
                    ? 'border-brand-indigo bg-brand-indigo/10'
                    : pdfFile
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-brand-border hover:border-brand-indigo/50 hover:bg-brand-indigo/5',
                )}
              >
                <input {...getInputProps()} />
                {extracting ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-brand-indigo">
                      <Sparkles size={20} className="animate-pulse" />
                      <span className="font-body text-sm font-semibold">IA extraindo metadados...</span>
                    </div>
                    <p className="font-body text-brand-slate text-xs">Aguarde, lendo o documento</p>
                  </div>
                ) : pdfFile ? (
                  <div className="space-y-1">
                    <CheckCircle size={24} className="text-emerald-400 mx-auto" />
                    <p className="font-body font-semibold text-brand-cream text-sm">{pdfFile.name}</p>
                    <p className="font-body text-brand-slate text-xs">Clique para trocar o arquivo</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload size={28} className="text-brand-slate mx-auto" />
                    <p className="font-body font-semibold text-brand-cream text-sm">
                      Arraste o PDF ou clique para selecionar
                    </p>
                    <p className="font-body text-brand-slate text-xs">A IA preenchera numero, cliente e natureza automaticamente</p>
                  </div>
                )}
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label className="label">Numero CNJ *</label>
                  <input
                    value={form.numero}
                    onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                    placeholder="0000000-00.0000.0.00.0000"
                    className="input font-mono"
                  />
                </div>
                <div>
                  <label className="label">Cliente / Parte Autora *</label>
                  <input
                    value={form.cliente}
                    onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))}
                    placeholder="Nome completo do cliente"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Natureza da Acao</label>
                  <input
                    value={form.natureza}
                    onChange={e => setForm(f => ({ ...f, natureza: e.target.value }))}
                    placeholder="Ex: Acao de Indenizacao por Danos Morais"
                    className="input"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Vara / Camara</label>
                    <input
                      value={form.vara}
                      onChange={e => setForm(f => ({ ...f, vara: e.target.value }))}
                      placeholder="Ex: 3a Vara Civel"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Tribunal</label>
                    <input
                      value={form.tribunal}
                      onChange={e => setForm(f => ({ ...f, tribunal: e.target.value }))}
                      placeholder="Ex: TJSP, STJ, TRF3"
                      className="input"
                    />
                  </div>
                </div>
                <div className="sm:w-1/2">
                  <label className="label">Data de Protocolo</label>
                  <input
                    type="date"
                    value={form.dataProtocolo}
                    onChange={e => setForm(f => ({ ...f, dataProtocolo: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => { setShowModal(false); setForm(emptyForm); setPdfFile(null) }} className="btn-ghost flex-1 justify-center py-3 sm:py-2.5">
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center py-3 sm:py-2.5">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {saving ? 'Salvando...' : 'Salvar e Analisar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-sm animate-fade-in">
          <div className="card w-full sm:max-w-md p-5 sm:p-6 space-y-4 shadow-float rounded-t-2xl sm:rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center mt-0.5 flex-shrink-0">
                <AlertTriangle size={16} className="text-red-300" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-brand-cream">Excluir processo</h3>
                <p className="font-body text-brand-slate text-xs mt-1">
                  Esta acao e irreversivel e removera o processo da sua lista.
                </p>
              </div>
            </div>

            {deleteStep === 1 && (
              <div className="space-y-3">
                <p className="font-body text-xs text-brand-slate">
                  Digite <span className="text-brand-cream font-semibold">excluir processo</span> para continuar.
                </p>
                <input
                  value={deletePhraseInput}
                  onChange={e => setDeletePhraseInput(e.target.value)}
                  className="input"
                  placeholder="excluir processo"
                />
                <div className="flex gap-2">
                  <button onClick={closeDeleteDialog} className="btn-ghost flex-1 justify-center">Cancelar</button>
                  <button
                    onClick={() => setDeleteStep(2)}
                    disabled={deletePhraseInput.trim().toLowerCase() !== 'excluir processo'}
                    className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            )}

            {deleteStep === 2 && (
              <div className="space-y-3">
                <p className="font-body text-xs text-brand-slate">
                  Confirme digitando o numero do processo:
                </p>
                <p className="font-mono text-xs text-brand-cream bg-brand-navy border border-brand-border rounded-md px-3 py-2">
                  {deleteTarget.numero}
                </p>
                <input
                  value={deleteNumeroInput}
                  onChange={e => setDeleteNumeroInput(e.target.value)}
                  className="input font-mono"
                  placeholder={deleteTarget.numero}
                />
                <div className="flex gap-2">
                  <button onClick={() => setDeleteStep(1)} className="btn-ghost flex-1 justify-center">Voltar</button>
                  <button
                    onClick={confirmDeleteProcess}
                    disabled={deleting || deleteNumeroInput.trim() !== deleteTarget.numero}
                    className="btn-gold flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Excluir processo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
