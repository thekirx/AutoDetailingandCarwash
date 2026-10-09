/** Finance Vendors — supplier directory (Owner Revisions P5). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { catalogWriteError } from '@/lib/financeBooks'
import { toast } from 'sonner'
import FinanceVendorDialog from './FinanceVendorDialog'
import {
  FinanceEmpty,
  FinanceMetricCell,
  FinanceMetricStrip,
  FinancePanel,
  FinanceTabSkeleton,
} from './FinanceChrome'

export default function FinanceVendorsTab({ canManage, onVendorsChange }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [dialog, setDialog] = useState(null)
  const onVendorsChangeRef = useRef(onVendorsChange)
  onVendorsChangeRef.current = onVendorsChange

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    const { data, error } = await supabase
      .from('vendors')
      .select('id, name, contact, notes, is_active, created_at')
      .order('name')
    if (error) {
      setLoadError(error.message)
      toast.error(error.message)
    } else {
      setRows(data || [])
      onVendorsChangeRef.current?.(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const metrics = useMemo(() => {
    const active = rows.filter((r) => r.is_active).length
    return { total: rows.length, active }
  }, [rows])

  async function toggleActive(row) {
    if (!canManage) return
    const { error } = await supabase
      .from('vendors')
      .update({ is_active: !row.is_active, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    if (error) toast.error(catalogWriteError(error, 'vendor'))
    else load()
  }

  async function remove(row) {
    if (!canManage || !window.confirm(`Delete vendor "${row.name}"? Bills from them will show no vendor. Deactivate instead to keep the name on old bills.`)) return
    const { error } = await supabase.from('vendors').delete().eq('id', row.id)
    if (error) toast.error(catalogWriteError(error, 'vendor'))
    else {
      toast.success('Vendor deleted')
      load()
    }
  }

  if (loading && !rows.length && !loadError) return <FinanceTabSkeleton metrics={2} />

  return (
    <div className="finance-dash flex flex-col gap-5">
      <FinanceMetricStrip label="Vendor totals">
        <FinanceMetricCell label="Vendors" value={String(metrics.total)} hint="Directory" tone="ink" />
        <FinanceMetricCell label="Active" value={String(metrics.active)} hint="Available on bills" tone="up" />
      </FinanceMetricStrip>

      <FinanceVendorDialog
        open={Boolean(dialog)}
        onOpenChange={(open) => { if (!open) setDialog(null) }}
        editing={dialog?.row || null}
        onSaved={load}
      />

      <FinancePanel
        title="Vendors"
        description={`${metrics.total} supplier${metrics.total === 1 ? '' : 's'}`}
        actions={canManage ? (
          <Button type="button" className="min-h-11 cursor-pointer" onClick={() => setDialog({ row: null })}>
            <Plus data-icon="inline-start" />
            Add vendor
          </Button>
        ) : null}
      >
        {loadError ? (
          <FinanceEmpty
            title="Vendors failed to load"
            body={loadError}
            action={{ label: 'Retry', onClick: load }}
          />
        ) : !rows.length ? (
          <FinanceEmpty
            title="No vendors yet"
            body={canManage ? 'Use Add vendor to create the first supplier.' : 'Ask Super Admin to add vendors.'}
          />
        ) : (
          <div className="finance-table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.contact || '—'}</TableCell>
                    <TableCell className="max-w-xs truncate">{row.notes || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={row.is_active ? 'default' : 'secondary'}>
                        {row.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    {canManage ? (
                      <TableCell className="space-x-1 whitespace-nowrap">
                        <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setDialog({ row })}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => toggleActive(row)}>
                          {row.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button size="sm" variant="ghost" className="cursor-pointer" aria-label={`Delete ${row.name}`} onClick={() => remove(row)}>
                          <Trash2 data-icon="inline-start" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </FinancePanel>
    </div>
  )
}
