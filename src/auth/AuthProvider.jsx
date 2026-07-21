import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  OPS_LOGIN_ROLES,
  canAccessPos,
  canEditQueueOperations,
  canManageCrew,
  canUseOperations,
  canViewAssignedTasks,
  canViewQueueOperations,
  isAdmin,
  isSuperAdmin,
} from './permissions'

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
      const next = { ...staffProfile, email: user.email, source: 'staff_profiles' }
      setProfile(next)
      return next
    }

    const { data, error } = await supabase
      .from('customers')
      .select('id, full_name, email, phone, role, is_archived')
      .eq('id', user.id)
      .eq('is_archived', false)
      .maybeSingle()

    if (error) throw error
    if (data && (OPS_LOGIN_ROLES.includes(data.role) || data.role === 'customer')) {
      const next = { ...data, branch_slug: null, source: 'customers' }
      setProfile(next)
      return next
    }

    // ponytail: RLS may block customer self-select until migration; metadata is enough for portal
    if (user.user_metadata?.role === 'customer' || (!data && user.email?.includes('@customers.hakumautocare.com'))) {
      const next = {
        id: user.id,
        full_name: user.user_metadata?.full_name || 'Customer',
        email: user.email,
        phone: user.user_metadata?.phone || null,
        role: 'customer',
        branch_slug: null,
        source: 'auth_metadata',
      }
      setProfile(next)
      return next
    }

    setProfile(null)
    return null
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
      isStaff: canUseOperations(profile),
      isAdmin: isAdmin(profile),
      isSuperAdmin: isSuperAdmin(profile),
      canManageQueue: canEditQueueOperations(profile),
      canManageCrew: canManageCrew(profile),
      canViewQueueOperations: canViewQueueOperations(profile),
      canViewAssignedTasks: canViewAssignedTasks(profile),
      canUseOperations: canUseOperations(profile),
      canUsePos: canAccessPos(profile),
      canUseFuturePOS: canAccessPos(profile),
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
