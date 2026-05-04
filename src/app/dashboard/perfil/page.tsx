'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/auth/firebase'
import { User, Save, Loader2, CheckCircle, Mail, Building2, BadgeCheck } from 'lucide-react'
import { planForUserPlan } from '@/lib/plans'
import toast from 'react-hot-toast'

export default function PerfilPage() {
  const { user, userData } = useAuth()

  const [displayName, setDisplayName] = useState(userData?.displayName || '')
  const [escritorio, setEscritorio]   = useState(userData?.escritorio || '')
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setSaved(false)
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim() || null,
        escritorio:  escritorio.trim()  || null,
        updatedAt:   new Date().toISOString(),
      })
      setSaved(true)
      toast.success('Perfil atualizado.')
      setTimeout(() => setSaved(false), 3000)
    } catch {
      toast.error('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-indigo/15 border border-brand-indigo/25 flex items-center justify-center">
          <User size={18} className="text-brand-indigo" />
        </div>
        <div>
          <h1 className="font-display font-bold text-brand-cream text-lg">Meu Perfil</h1>
          <p className="font-body text-brand-slate text-xs">Gerencie suas informações pessoais</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSave} className="card p-5 sm:p-6 space-y-5">
            <h2 className="font-body font-semibold text-brand-cream text-sm">Informações pessoais</h2>

            <div className="space-y-1.5">
              <label className="font-body text-xs font-semibold text-brand-slate uppercase tracking-wider">
                Nome completo
              </label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Dr. João da Silva"
                className="input w-full"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-body text-xs font-semibold text-brand-slate uppercase tracking-wider">
                E-mail
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-slate" />
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="input w-full pl-9 opacity-50 cursor-not-allowed"
                />
              </div>
              <p className="font-body text-[11px] text-brand-slate/60">O e-mail não pode ser alterado aqui.</p>
            </div>

            <div className="space-y-1.5">
              <label className="font-body text-xs font-semibold text-brand-slate uppercase tracking-wider">
                Escritório / OAB
              </label>
              <div className="relative">
                <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-slate" />
                <input
                  type="text"
                  value={escritorio}
                  onChange={e => setEscritorio(e.target.value)}
                  placeholder="Silva & Associados Advogados"
                  className="input w-full pl-9"
                />
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary text-sm py-2 px-5"
              >
                {saving ? (
                  <><Loader2 size={14} className="animate-spin" /> Salvando...</>
                ) : saved ? (
                  <><CheckCircle size={14} /> Salvo!</>
                ) : (
                  <><Save size={14} /> Salvar alterações</>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Plano */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <h2 className="font-body font-semibold text-brand-cream text-sm">Plano atual</h2>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center">
                <BadgeCheck size={18} className="text-brand-gold" />
              </div>
              <div>
                <p className="font-body font-semibold text-brand-cream text-sm">
                  {userData?.plano ? planForUserPlan(userData.plano).name : '—'}
                </p>
                <p className="font-body text-brand-slate text-xs capitalize">
                  {userData?.planoStatus || 'ativo'}
                </p>
              </div>
            </div>
            <a href="/dashboard/planos" className="btn-ghost text-xs py-1.5 w-full justify-center">
              Ver planos e upgrade
            </a>
          </div>

          <div className="card p-5 space-y-2">
            <h2 className="font-body font-semibold text-brand-cream text-sm">Conta</h2>
            <div className="space-y-1">
              <p className="font-body text-[11px] text-brand-slate">
                <span className="font-semibold text-brand-slate/80">Membro desde:</span>{' '}
                {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString('pt-BR') : '—'}
              </p>
              <p className="font-body text-[11px] text-brand-slate">
                <span className="font-semibold text-brand-slate/80">Papel:</span>{' '}
                {userData?.role === 'admin' ? 'Administrador' : 'Cliente'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
