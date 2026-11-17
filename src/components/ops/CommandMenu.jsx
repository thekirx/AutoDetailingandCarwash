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
  CommandEmpty,
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
  buildSmartSearchDestinations,
  describeSearchCapabilities,
  filterSmartSearchDestinations,
} from '@/lib/smartSearchCatalog'

const RECENT_KEY_PREFIX = 'hakum.smartSearchRecent.'
const MAX_RECENTS = 5

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

function readRecents(userId, validPaths) {
  if (!userId) return []
  try {
    const raw = globalThis.localStorage?.getItem(`${RECENT_KEY_PREFIX}${userId}`)
    const parsed = JSON.parse(raw || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => item?.to && validPaths.has(item.to)).slice(0, MAX_RECENTS)
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

  const destinations = useMemo(() => buildSmartSearchDestinations(profile), [profile])
  const scopes = useMemo(() => describeSearchCapabilities(profile), [profile])
  const validPaths = useMemo(() => new Set(destinations.map((d) => d.to)), [destinations])

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

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

    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    setSearching(true)
    setSearchError('')

    const timer = window.setTimeout(async () => {
      try {
        const token = await getAccessTokenFresh()
        if (!token || controller.signal.aborted) {
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
        setLiveResults(Array.isArray(data.results) ? data.results : [])
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

  const filteredPages = useMemo(
    () => filterSmartSearchDestinations(destinations, query),
    [destinations, query],
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

  const trimmedQuery = query.trim()
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
                          <span className="truncate font-medium">{row.label}</span>
                          {row.subtitle ? (
                            <span className="truncate text-xs text-muted-foreground">{row.subtitle}</span>
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
                  <span className="truncate font-medium">{item.label}</span>
                  <span className="ml-auto hidden truncate text-xs text-muted-foreground sm:inline">
                    {item.to.replace('/operations/', '/')}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}

          {!searching && !hasAnyMatches ? (
            <CommandEmpty>
              No matching pages or accessible records for &ldquo;{trimmedQuery}&rdquo;.
            </CommandEmpty>
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
