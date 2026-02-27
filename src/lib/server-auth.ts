import { NextRequest } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'

export type AuthenticatedUser = {
  uid: string
  email?: string
}

export async function requireServerAuth(req: NextRequest): Promise<AuthenticatedUser> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    throw new Error('UNAUTHORIZED: Missing bearer token.')
  }

  const token = match[1]?.trim()
  if (!token) {
    throw new Error('UNAUTHORIZED: Invalid bearer token.')
  }

  const decoded = await adminAuth().verifyIdToken(token)
  return {
    uid: decoded.uid,
    email: decoded.email,
  }
}
