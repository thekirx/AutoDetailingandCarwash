import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  CalendarCheck,
  CarFront,
  ClipboardList,
  Clock,
  Compass,
  Kanban,
  LoaderCircle,
  Package,
  Search,
  TicketPercent,
  UserCog,
  Users,
} from 'lucide-react'
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/auth/AuthProvider'
import { getAccessTokenFresh } from '@/lib/authToken'
import {
  buildQuickJumpDestinations,
  buildSmartSearchDestinations,
  describeSearchCapabilities,
  filterSmartSearchDestinations,
} from '@/lib/smartSearchCatalog'

const RECENT_KEY_PREFIX = 'hakum.smartSearchRecent.'
const MAX_RECENTS = 5
const SEARCH_CACHE_TTL_MS = 30_000
const SEARCH_CACHE_MAX = 30

const CATEGORY_META = {
  bookings: { heading: 'Bookings & Queue', Icon: CalendarCheck },
  customers: { heading: 'Customers', Icon: Users },
  vehicles: { heading: 'Vehicles / Plates', Icon: CarFront },
  tasks: { heading: 'Planner & My Tasks', Icon: Kanban },
  forms: { heading: 'Form Results', Icon: ClipboardList },
  catalog: { heading: 'Services & Inventory', Icon: Package },
  staff: { heading: 'Staff Directory', Icon: UserCog },
  vouchers: { heading: 'Vouchers', Icon: TicketPercent },
  branches: { heading: 'Branches', Icon: Building2 },
}

function stripTransientSearchQuery(to) {
  const [path, query = ''] = String(to || '').split('?')
  if (!query) return path
  const p = new URLSearchParams(query)
  p.delete('q')
  const qs = p.toString()
  return qs ? `${path}?${qs}` : path
}

function isEditableElement(target) {
  if (!target || typeof target.tagName !== 'string') return false
  const tag = target.tagName.toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(target.isContentEditable)
}

function HighlightMatch({ text, query }) {
  const str = String(text || '')
  const term = String(query || '').trim().split(/\s+/)[0] || ''
  if (!term || term.length < 2) return str
  const idx = str.toLowerCase().indexOf(term.toLowerCase())
  if (idx < 0) return str
  return (
    <>
      {str.slice(0, idx)}
      <mark className="rounded-sm bg-primary/15 px-0.5 text-primary font-semibold">{str.slice(idx, idx + term.length)}</mark>
      {str.slice(idx + term.length)}
    </>
  )
}

function isRecentAllowed(to, validPaths) {
  if (!to) return false
  const baseTo = stripTransientSearchQuery(to)
  if (validPaths.has(to) || validPaths.has(baseTo)) return true
  if (baseTo.startsWith('/operations/planning?') && [...validPaths].some((p) => p === '/operations/planning' || p.startsWith('/operations/planning?'))) {
    return true
  }
  if (baseTo.startsWith('/operations/forms/results/') && validPaths.has('/operations/forms/results')) {
    return true
  }
  return false
}

function readRecents(userId, validPaths) {
  if (!userId) return []
  try {
    const raw = globalThis.localStorage?.getItem(`${RECENT_KEY_PREFIX}${userId}`)
    const parsed = JSON.parse(raw || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => isRecentAllowed(item?.to, validPaths)).slice(0, MAX_RECENTS)
  } catch {
    return []
  }
}

function writeRecent(userId, item) {
  if (!userId || !item?.to) return
  try {
    const raw = globalThis.localStorage?.getItem(`${RECENT_KEY_PREFIX}${userId}`)
    const prev = Array.isArray(JSON.parse(raw || '[]')) ? JSON.parse(raw || '[]') : []
    const next = [
      { label: item.label, to: item.to, subtitle: item.subtitle || item.group || '' },
      ...prev.filter((r) => r?.to !== item.to || r?.label !== item.label),
    ].slice(0, MAX_RECENTS)
    globalThis.localStorage?.setItem(`${RECENT_KEY_PREFIX}${userId}`, JSON.stringify(next))
  } catch {
    /* ignore storage limits */
  }
}

/**
 * Omnichannel Operations Smart Search (Cmd/Ctrl+K):
 * Combines instant RBAC-filtered pages/tabs/settings with live RBAC + branch-scoped record search.
 */
export default function CommandMenu({ open: openProp, onOpenChange }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const [query, setQuery] = useState('')
  const [liveResults, setLiveResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [recents, setRecents] = useState([])
  const abortRef = useRef(null)
  const queryCacheRef = useRef(new Map())

  const destinations = useMemo(() => buildSmartSearchDestinations(profile), [profile])
  const quickJumps = useMemo(() => buildQuickJumpDestinations(profile, 8), [profile])
  const scopes = useMemo(() => describeSearchCapabilities(profile), [profile])
  const validPaths = useMemo(() => new Set(destinations.map((d) => d.to)), [destinations])

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
        return
      }
      if (!open && e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditableElement(e.target)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  useEffect(() => {
    queryCacheRef.current.clear()
  }, [user?.id, profile?.role])

  useEffect(() => {
    if (open) {
      setRecents(readRecents(user?.id, validPaths))
      return undefined
    }
    abortRef.current?.abort()
    setQuery('')
    setLiveResults([])
    setSearching(false)
    setSearchError('')
    return undefined
  }, [open, user?.id, validPaths])

  useEffect(() => {
    if (!open) return undefined
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      abortRef.current?.abort()
      setLiveResults([])
      setSearching(false)
      setSearchError('')
      return undefined
    }

    const cacheKey = trimmed.toLowerCase()
    const cached = queryCacheRef.current.get(cacheKey)
    if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL_MS) {
      setLiveResults(cached.results)
      setSearching(false)
      setSearchError('')
      return undefined
    }

    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    setSearching(true)
    setSearchError('')

    const timer = window.setTimeout(async () => {
      try {
        const token = await getAccessTokenFresh()
        if (controller.signal.aborted) return
        if (!token) {
          setSearchError('Session expired — sign in again to search live records.')
          setLiveResults([])
          setSearching(false)
          return
        }
        const res = await fetch(
          `/api/staff?operation=smart-search&q=${encodeURIComponent(trimmed)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        )
        const data = await res.json().catch(() => ({}))
        if (controller.signal.aborted) return
        if (!res.ok) {
          setSearchError(data.error || 'Could not search live records')
          setLiveResults([])
          return
        }
        const nextResults = Array.isArray(data.results) ? data.results : []
        if (queryCacheRef.current.size >= SEARCH_CACHE_MAX) {
          const oldest = queryCacheRef.current.keys().next().value
          if (oldest !== undefined) queryCacheRef.current.delete(oldest)
        }
        queryCacheRef.current.set(cacheKey, { at: Date.now(), results: nextResults })
        setLiveResults(nextResults)
      } catch (err) {
        if (!controller.signal.aborted) {
          setSearchError(err?.message || 'Search failed')
          setLiveResults([])
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 180)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, query])

  const trimmedQuery = query.trim()
  const filteredPages = useMemo(
    () => (trimmedQuery ? filterSmartSearchDestinations(destinations, trimmedQuery) : quickJumps),
    [destinations, quickJumps, trimmedQuery],
  )

  const groupedPages = useMemo(() => {
    const map = new Map()
    for (const item of filteredPages) {
      const list = map.get(item.group) || []
      list.push(item)
      map.set(item.group, list)
    }
    return [...map.entries()]
  }, [filteredPages])

  const groupedLive = useMemo(() => {
    const map = new Map()
    for (const row of liveResults) {
      const list = map.get(row.category) || []
      list.push(row)
      map.set(row.category, list)
    }
    return [...map.entries()]
  }, [liveResults])

  const selectDestination = useCallback(
    (item) => {
      if (!item?.to) return
      writeRecent(user?.id, item)
      setOpen(false)
      navigate(item.to)
    },
    [navigate, setOpen, user?.id],
  )

  const hasAnyMatches = filteredPages.length > 0 || liveResults.length > 0

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Smart Search"
      description="Jump to pages or search RBAC-scoped records"
      className="sm:max-w-xl"
    >
      <Command shouldFilter={false} className="rounded-xl">
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search pages, plates, customers, tasks, staff…"
          aria-label="Search pages and records"
        />
        <CommandList className="max-h-[min(65svh,28rem)]">
          {!trimmedQuery && recents.length > 0 ? (
            <>
              <CommandGroup heading="Recent">
                {recents.map((item) => (
                  <CommandItem
                    key={`recent-${item.to}-${item.label}`}
                    value={`recent-${item.to}-${item.label}`}
                    className="min-h-11"
                    onSelect={() => selectDestination(item)}
                  >
                    <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{item.label}</span>
                      {item.subtitle ? (
                        <span className="truncate text-xs text-muted-foreground">{item.subtitle}</span>
                      ) : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          ) : null}

          {trimmedQuery.length >= 2 ? (
            <>
              {searching ? (
                <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                  Searching live records…
                </div>
              ) : null}

              {searchError ? (
                <p className="px-3 py-2 text-xs text-destructive" role="alert">
                  {searchError}
                </p>
              ) : null}

              {groupedLive.map(([cat, rows]) => {
                const meta = CATEGORY_META[cat] || { heading: cat, Icon: Search }
                const Icon = meta.Icon
                return (
                  <CommandGroup key={`live-${cat}`} heading={meta.heading}>
                    {rows.map((row) => (
                      <CommandItem
                        key={row.id}
                        value={row.id}
                        className="min-h-11 gap-2.5"
                        onSelect={() => selectDestination(row)}
                      >
                        <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-medium">
                            <HighlightMatch text={row.label} query={trimmedQuery} />
                          </span>
                          {row.subtitle ? (
                            <span className="truncate text-xs text-muted-foreground">
                              <HighlightMatch text={row.subtitle} query={trimmedQuery} />
                            </span>
                          ) : null}
                        </div>
                        {row.badge ? (
                          <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">
                            {row.badge}
                          </Badge>
                        ) : null}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )
              })}

              {groupedLive.length > 0 && groupedPages.length > 0 ? <CommandSeparator /> : null}
            </>
          ) : null}

          {groupedPages.map(([groupLabel, items]) => (
            <CommandGroup key={`nav-${groupLabel}`} heading={groupLabel}>
              {items.map((item) => (
                <CommandItem
                  key={item.to}
                  value={`nav-${item.to}`}
                  className="min-h-11 gap-2.5"
                  onSelect={() => selectDestination(item)}
                >
                  <Compass className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate font-medium">
                    <HighlightMatch text={item.label} query={trimmedQuery} />
                  </span>
                  <span className="ml-auto hidden truncate text-xs text-muted-foreground sm:inline">
                    {item.to.replace('/operations/', '/')}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}

          {!trimmedQuery && destinations.length > quickJumps.length ? (
            <p className="px-3 pb-2 pt-1 text-[11px] text-muted-foreground">
              Type to search all {destinations.length} destinations, sub-tabs, settings &amp; live records — or press <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">/</kbd> anytime.
            </p>
          ) : null}

          {!searching && !hasAnyMatches ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No matching pages or accessible records for &ldquo;{trimmedQuery}&rdquo;.
            </div>
          ) : null}
        </CommandList>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          <span className="truncate">
            Access: {scopes.join(' · ')}
          </span>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd>
            <span>navigate</span>
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
            <span>open</span>
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>
          </span>
        </div>
      </Command>
    </CommandDialog>
  )
}
