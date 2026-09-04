import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useAuth } from '@/auth/AuthProvider'
import { getOperationsNav, groupOperationsNav } from '@/auth/permissions'

/** Global Cmd/Ctrl+K palette — items from getOperationsNav. */
export default function CommandMenu({ open: openProp, onOpenChange }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const groups = useMemo(() => groupOperationsNav(getOperationsNav(profile)), [profile])

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

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Go to" description="Jump to an operations page">
      <CommandInput placeholder="Search pages…" />
      <CommandList>
        <CommandEmpty>No matching page.</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group.id || group.label} heading={group.label}>
            {group.items.map((item) => (
              <CommandItem
                key={item.to}
                value={`${item.label} ${item.to}`}
                onSelect={() => {
                  setOpen(false)
                  navigate(item.to)
                }}
              >
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
