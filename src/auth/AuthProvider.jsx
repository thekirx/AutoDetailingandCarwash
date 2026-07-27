import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { shouldReloadProfile } from '../lib/session'
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

  const loadProfile = useCallback(async (user, { quiet = false } = {}) => {
    if (!user) {
      setProfile(null)
      return null
    }

    const { data: staffProfile, error: staffError } = await supabase
      .from('staff_profiles')
      .select('id, full_name, role, branch_slug, phone, is_active, permission_grants')
      .eq('id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (staffError) throw staffError
    if (staffProfile) {
      const { data: assigns, error: assignErr } = await supabase
        .from('staff_branch_assignments')
        .select('branch_slug')
        .eq('staff_id', user.id)
      if (assignErr) {
        console.warn('[auth] branch assignments unavailable', assignErr.message || assignErr)
      }
      const branch_slugs = (assigns || []).map((a) => a.branch_slug).filter(Boolean)
      const next = {
        ...staffProfile,
        permission_grants: staffProfile.permission_grants || {},
        branch_slugs: branch_slugs.length ? branch_slugs : staffProfile.branch_slug ? [staffProfile.branch_slug] : [],
        email: user.email,
        source: 'staff_profiles',
      }
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

    if (!quiet) setProfile(null)
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
      } catch (err) {
        console.warn('[auth] profile load failed', err?.message || err)
        if (active && !data.session?.user) setProfile(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    initialize()

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      setSession(nextSession)

      if (!shouldReloadProfile(event)) {
        if (event === 'SIGNED_OUT' || !nextSession?.user) setProfile(null)
        return
      }

      if (event === 'SIGNED_OUT') {
        setProfile(null)
        setLoading(false)
        return
      }

      setLoading(true)
      queueMicrotask(() => {
        loadProfile(nextSession?.user)
          .catch((err) => {
            console.warn('[auth] profile load failed', err?.message || err)
            if (!nextSession?.user) setProfile(null)
          })
          .finally(() => {
            if (active) setLoading(false)
          })
      })
    })

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      supabase.auth.getSession().then(({ data }) => {
        if (!active) return
        setSession(data.session)
        if (data.session?.user) {
          loadProfile(data.session.user, { quiet: true }).catch(() => {})
        }
      })
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      active = false
      listener.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadProfile])

  // Live RBAC: Super Admin grant/branch edits apply without re-login
  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return undefined

    const channel = supabase
      .channel(`rbac-profile-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff_profiles', filter: `id=eq.${userId}` },
        () => {
          loadProfile(session.user, { quiet: true }).catch((err) => {
            console.warn('[auth] rbac profile refresh failed', err?.message || err)
          })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff_branch_assignments', filter: `staff_id=eq.${userId}` },
        () => {
          loadProfile(session.user, { quiet: true }).catch((err) => {
            console.warn('[auth] rbac branch refresh failed', err?.message || err)
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session?.user?.id, session?.user, loadProfile])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) throw error
    setSession(null)
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return null
    return loadProfile(session.user, { quiet: true })
  }, [loadProfile, session?.user])

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
      refreshProfile,
    }),
    [session, profile, loading, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
