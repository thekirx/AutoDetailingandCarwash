import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (user) => {
    if (!user) {
      setProfile(null)
      return null
    }

    const { data, error } = await supabase
      .from('customers')
      .select('id, full_name, email, role, is_archived')
      .eq('id', user.id)
      .in('role', ['staff', 'admin'])
      .eq('is_archived', false)
      .maybeSingle()

    if (error) throw error
    setProfile(data)
    return data
  }, [])

  useEffect(() => {
    let active = true

    const initialize = async () => {
      const { data } = await supabase.auth.getSession()
      if (!active) return

      setSession(data.session)
      try {
        await loadProfile(data.session?.user)
      } catch {
        if (active) setProfile(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    initialize()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(true)

      // Run the profile request after the auth callback finishes to avoid
      // contention with Supabase's internal session lock.
      setTimeout(() => {
        loadProfile(nextSession?.user)
          .catch(() => setProfile(null))
          .finally(() => setLoading(false))
      }, 0)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signOut = useCallback(() => supabase.auth.signOut(), [])
  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isStaff: profile?.role === 'staff' || profile?.role === 'admin',
      isAdmin: profile?.role === 'admin',
      loading,
      signOut,
    }),
    [session, profile, loading, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
