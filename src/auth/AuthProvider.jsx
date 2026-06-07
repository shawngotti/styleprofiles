import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const AuthContext = createContext(null)

/**
 * Loads the Supabase session and the signed-in user's roles, and exposes them
 * to the app. Roles are additive (a person can be client + pro). The roles here
 * drive the perspective switcher only — they are NOT a security boundary.
 * Security is enforced by RLS + Edge Function checks on the server.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)

  // Track the session. We deliberately do NOT call other supabase methods
  // inside onAuthStateChange (it holds an internal lock); role loading happens
  // in the separate effect below, keyed off the user id.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Load the user's roles whenever the signed-in user changes.
  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      setRoles([])
      return
    }
    let active = true
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          console.error('Failed to load roles:', error.message)
          setRoles([])
          return
        }
        setRoles(data.map((r) => r.role))
      })
    return () => {
      active = false
    }
  }, [session?.user?.id])

  const value = {
    session,
    user: session?.user ?? null,
    roles,
    loading,
    hasRole: (role) => roles.includes(role),
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
