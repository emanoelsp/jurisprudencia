'use client'
// src/lib/auth-context.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser,
  updateProfile,
  deleteUser,
  getAdditionalUserInfo,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { User } from '@/types'
import { normalizePlan, PlanId } from '@/lib/plans'

interface AuthContextValue {
  user: FirebaseUser | null
  userData: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string, plan: PlanId) => Promise<void>
  signInWithGoogle: (plan?: PlanId) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,     setUser]     = useState<FirebaseUser | null>(null)
  const [userData, setUserData] = useState<User | null>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      setLoading(false)
    }, 4000)

    if (!auth) {
      setLoading(false)
      clearTimeout(fallbackTimer)
      return
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const ref = doc(db, 'users', firebaseUser.uid)
        const snap = await getDoc(ref)
        if (snap.exists()) {
          setUserData(snap.data() as User)
        }
      } else {
        setUserData(null)
      }
      setLoading(false)
      clearTimeout(fallbackTimer)
    })
    return () => {
      clearTimeout(fallbackTimer)
      unsub()
    }
  }, [])

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function provisionUserPlan(input: { uid: string; email?: string | null; displayName?: string | null; plan?: string }) {
    const token = await auth.currentUser?.getIdToken()
    if (!token) throw new Error('Sessão inválida para provisionar plano.')
    const res = await fetch('/api/billing/register', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: input.email || '',
        displayName: input.displayName || '',
        plan: normalizePlan(input.plan),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || 'Falha ao registrar plano.')
    setUserData(data.user as User)
  }

  async function signUp(email: string, password: string, name: string, plan: PlanId) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    try {
      await updateProfile(cred.user, { displayName: name })
      await provisionUserPlan({
        uid: cred.user.uid,
        email,
        displayName: name,
        plan,
      })
    } catch (err) {
      try {
        await deleteUser(cred.user)
      } catch {}
      throw err
    }
  }

  async function signInWithGoogle(plan: PlanId = 'free') {
    const provider = new GoogleAuthProvider()
    const cred = await signInWithPopup(auth, provider)
    const info = getAdditionalUserInfo(cred)
    const isNewUser = Boolean(info?.isNewUser)
    const ref = doc(db, 'users', cred.user.uid)
    const snap = await getDoc(ref)
    if (!snap.exists() || isNewUser) {
      try {
        await provisionUserPlan({
          uid: cred.user.uid,
          email: cred.user.email,
          displayName: cred.user.displayName,
          plan,
        })
      } catch (err) {
        await firebaseSignOut(auth)
        throw err
      }
    } else {
      setUserData(snap.data() as User)
    }
  }

  async function signOut() {
    await firebaseSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, userData, loading, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
