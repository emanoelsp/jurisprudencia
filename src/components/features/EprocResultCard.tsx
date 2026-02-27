// src/components/features/EprocResultCard.tsx
'use client'
import { useState } from 'react'
import type { EprocResult } from '@/types'
import ConfidenceBadge from '@/components/ui/ConfidenceBadge'
import { ChevronDown, ChevronUp, PlusCircle, Cpu } from 'lucide-react'

interface Props {
  result: EprocResult
  index: number
  onInsert: (text: string) => void
  streaming?: boolean
  justificativa?: string
}

export default function EprocResultCard({ result, index, onInsert, streaming, justificativa }: Props) {
  const [expanded, setExpanded] = useState(index === 0)

  function buildInsertText() {
    return `${result.tribunal} – ${result.numero}
EMENTA: ${result.ementa}
Relator: ${result.relator}, julgado em ${result.dataJulgamento}.`
  }

  return (
    <div className={`card overflow-hidden transition-all duration-300 ${index === 0 ? 'border-brand-indigo/30' : ''}`}>
      {/* Header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-brand-navy/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-6 h-6 rounded-md bg-brand-indigo/15 border border-brand-indigo/25 flex items-center justify-center text-xs font-mono font-bold text-brand-indigo flex-shrink-0 mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="font-body font-semibold text-brand-cream text-sm">{result.tribunal}</span>
            <ConfidenceBadge badge={result.badge} score={result.rerankScore ?? result.score} />
            {result.fonte && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-brand-border text-brand-slate">
                {result.fonte === 'datajud_cnj' ? 'DataJud CNJ' : result.fonte}
              </span>
            )}
            {result.alreadyUsed && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-300 bg-amber-500/10">
                parecer já usado {result.usageCount ? `(${result.usageCount}x)` : ''}
              </span>
            )}
          </div>
          <p className="font-mono text-brand-slate text-xs">{result.numero}</p>
          <p className="font-body text-brand-slate text-xs mt-1">
            Rel. {result.relator} · {result.dataJulgamento}
          </p>
        </div>
        <button className="text-brand-slate flex-shrink-0 mt-0.5">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-brand-border px-4 pb-4 space-y-4">
          {/* Ementa */}
          <div className="mt-4">
            <p className="label">Ementa</p>
            <p className="font-body text-brand-slate text-sm leading-relaxed">{result.ementa}</p>
          </div>

          {/* Streaming justificativa */}
          {(justificativa || streaming) && (
            <div className="bg-brand-navy/60 border border-brand-indigo/20 rounded-lg p-3 space-y-2">
	              <div className="flex items-center gap-2">
	                <Cpu size={12} className="text-brand-indigo" />
	                <p className="font-body text-xs font-semibold text-brand-indigo uppercase tracking-wider">
	                  Análise do JurisprudencIA
	                </p>
                {streaming && (
                  <span className="flex gap-0.5 ml-auto">
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1 h-1 bg-brand-indigo rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                )}
              </div>
              <p className="font-body text-brand-slate text-sm leading-relaxed">
                {justificativa || '…'}
              </p>
            </div>
          )}

          {/* Actions */}
          <button
            onClick={() => onInsert(buildInsertText())}
            className="btn-gold w-full justify-center text-xs py-2"
          >
            <PlusCircle size={14} />
            Inserir no Editor
          </button>
        </div>
      )}
    </div>
  )
}
