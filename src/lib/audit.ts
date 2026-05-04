// Audit log for Escritório+ plans
// Written server-side via adminDb (never client-side)

import { adminDb } from '@/lib/auth/firebase-admin'

export type AuditAction =
  | 'analysis_run'
  | 'parecer_approved'
  | 'parecer_exported'
  | 'batch_analysis_run'
  | 'version_restored'

export interface AuditEntry {
  id?: string
  userId: string
  action: AuditAction
  processoId?: string
  processoNumero?: string
  meta?: Record<string, unknown>
  createdAt: string
}

export async function writeAuditLog(entry: Omit<AuditEntry, 'id' | 'createdAt'>): Promise<void> {
  try {
    await adminDb().collection('auditLog').add({
      ...entry,
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('[audit] write failed (non-blocking)', err)
  }
}
