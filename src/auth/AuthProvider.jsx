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

    const { data: staffProfile, error: staffError } = await supabase
      .from('staff_profiles')
      .select('id, full_name, role, branch_slug, phone, is_active')
      .eq('id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (staffError) throw staffError
    if (staffProfile) {
      const profile = { ...staffProfile, email: user.email, source: 'staff_profiles' }
      setProfile(profile)
      return profile
    }

    const { data, error } = await supabase
      .from('customers')
      .select('id, full_name, email, phone, role, is_archived')
      .eq('id', user.id)
      .in('role', ['staff', 'admin', 'team_lead', 'cashier'])
      .eq('is_archived', false)
      .maybeSingle()

    if (error) throw error
    const profile = data ? { ...data, branch_slug: null, source: 'customers' } : null
    setProfile(profile)
    return profile
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
      role: profile?.role ?? 'public',
      isStaff: ['staff', 'team_lead', 'admin'].includes(profile?.role),
      isAdmin: profile?.role === 'admin',
      canManageQueue: profile?.role === 'admin' || profile?.role === 'team_lead',
      canViewAssignedTasks: ['staff', 'team_lead', 'admin'].includes(profile?.role),
      canUseOperations: ['staff', 'team_lead', 'admin'].includes(profile?.role),
      canUseFuturePOS: profile?.role === 'cashier',
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
