/** Finance Vendors — supplier directory (Owner Revisions P5). */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { normalizeVendorPayload } from '@/lib/financeCorporate'
import { toast } from 'sonner'
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
  const [form, setForm] = useState({ name: '', contact: '', notes: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('vendors')
      .select('id, name, contact, notes, is_active, created_at')
      .order('name')
    if (error) toast.error(error.message)
    else {
      setRows(data || [])
      onVendorsChange?.(data || [])
    }
    setLoading(false)
  }, [onVendorsChange])

  useEffect(() => {
    load()
  }, [load])

  const metrics = useMemo(() => {
    const active = rows.filter((r) => r.is_active).length
    return { total: rows.length, active }
  }, [rows])

  async function save(event) {
    event.preventDefault()
    if (!canManage) return toast.error('Only Super Admin / ASA with finance write can manage vendors')
    const payload = normalizeVendorPayload(form)
    if (!payload) return toast.error('Vendor name is required')
    const { error } = await supabase.from('vendors').insert(payload)
    if (error) toast.error(error.message)
    else {
      toast.success('Vendor added')
      setForm({ name: '', contact: '', notes: '' })
      load()
    }
  }

  async function toggleActive(row) {
    if (!canManage) return
    const { error } = await supabase
      .from('vendors')
      .update({ is_active: !row.is_active, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    if (error) toast.error(error.message)
    else load()
  }

  async function remove(row) {
    if (!canManage || !window.confirm(`Delete vendor "${row.name}"?`)) return
    const { error } = await supabase.from('vendors').delete().eq('id', row.id)
    if (error) toast.error(error.message)
    else {
      toast.success('Vendor deleted')
      load()
    }
  }

  if (loading) return <FinanceTabSkeleton metrics={2} />

  return (
    <div className="finance-dash flex flex-col gap-5">
      <FinanceMetricStrip label="Vendor totals">
        <FinanceMetricCell label="Vendors" value={String(metrics.total)} hint="Directory" tone="ink" />
        <FinanceMetricCell label="Active" value={String(metrics.active)} hint="Available on bills" tone="up" />
      </FinanceMetricStrip>

      {canManage ? (
        <FinancePanel title="Add vendor" description="Supplier name and contact for bills.">
          <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="vendor-name">Name</Label>
              <Input
                id="vendor-name"
                required
                className="min-h-10"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="vendor-contact">Contact</Label>
              <Input
                id="vendor-contact"
                className="min-h-10"
                placeholder="Phone, email, or person"
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="vendor-notes">Notes</Label>
              <Textarea
                id="vendor-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" className="min-h-10 cursor-pointer">
                <Plus data-icon="inline-start" />
                Add vendor
              </Button>
            </div>
          </form>
        </FinancePanel>
      ) : null}

      <FinancePanel title="Vendors" description={`${metrics.total} supplier${metrics.total === 1 ? '' : 's'}`}>
        {!rows.length ? (
          <FinanceEmpty
            title="No vendors yet"
            body={canManage ? 'Add a supplier above.' : 'Ask Super Admin to add vendors.'}
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
                      <TableCell className="space-x-1">
                        <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => toggleActive(row)}>
                          {row.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => remove(row)}>
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
