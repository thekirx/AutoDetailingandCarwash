import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Building2, Pencil, Plus } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canManageBranches } from '@/auth/permissions'
import { archiveBranch, createBranch, listBranches, updateBranch } from '@/lib/adminApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

const empty = { name: '', slug: '', code: '', address: '' }

export default function BranchesManagePage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(empty)
  const [editingSlug, setEditingSlug] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setRows(await listBranches({ includeArchived: true }))
  }, [])

  useEffect(() => {
    if (canManageBranches(profile)) load().catch((e) => toast.error(e.message))
  }, [load, profile])

  if (!canManageBranches(profile)) return <Navigate to="/operations/access-denied" replace />

  async function onSubmit(event) {
    event.preventDefault()
    setSaving(true)
    try {
      if (editingSlug) {
        await updateBranch({
          slug: editingSlug,
          name: form.name,
          code: form.code,
          address: form.address || '',
          is_active: form.is_active ?? true,
        })
        toast.success('Branch updated')
        setEditingSlug(null)
      } else {
        await createBranch(form)
        toast.success('Branch created')
      }
      setForm(empty)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(row) {
    setEditingSlug(row.slug)
    setForm({
      name: row.name,
      slug: row.slug,
      code: row.code,
      address: row.address || '',
      is_active: row.is_active,
    })
  }

  function cancelEdit() {
    setEditingSlug(null)
    setForm(empty)
  }

  async function toggleActive(row) {
    try {
      await updateBranch({
        slug: row.slug,
        name: row.name,
        code: row.code,
        address: row.address || '',
        is_active: !row.is_active,
      })
      toast.success(row.is_active ? 'Branch deactivated' : 'Branch activated')
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function onArchive(slug) {
    if (!window.confirm(`Archive branch ${slug}?`)) return
    try {
      await archiveBranch(slug)
      toast.success('Branch archived')
      if (editingSlug === slug) cancelEdit()
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Sites</p>
        <h1 className="text-3xl font-semibold tracking-tight">Branches</h1>
        <p className="mt-2 text-sm text-muted-foreground">Create, edit, activate, and archive locations. Team leads and staff are scoped to one branch.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {editingSlug ? <Pencil size={18} /> : <Plus size={18} />}
              {editingSlug ? 'Edit branch' : 'New branch'}
            </CardTitle>
            <CardDescription>
              {editingSlug ? `Editing ${editingSlug} — slug cannot change.` : 'Slug must be lowercase URL-safe. Code is 2–5 letters.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="b-name">Name</Label>
                <Input id="b-name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Hakum Auto Care Imus" />
              </div>
              {!editingSlug && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="b-slug">Slug</Label>
                  <Input id="b-slug" required value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))} placeholder="imus" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" title="Lowercase letters, numbers, and hyphens" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="b-code">Code</Label>
                <Input id="b-code" required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="IMS" maxLength={5} minLength={2} pattern="[A-Z]{2,5}" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="b-addr">Address</Label>
                <Input id="b-addr" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="City, province" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? 'Saving…' : editingSlug ? 'Save changes' : 'Create branch'}
                </Button>
                {editingSlug && (
                  <Button type="button" variant="outline" onClick={cancelEdit}>Cancel</Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 size={18} /> All branches</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-muted-foreground">{row.address || 'No address'}</div>
                    </TableCell>
                    <TableCell>{row.slug}</TableCell>
                    <TableCell>{row.code}</TableCell>
                    <TableCell>
                      {row.is_archived ? <Badge variant="outline">Archived</Badge> : row.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!row.is_archived && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => startEdit(row)}>Edit</Button>
                            <Button size="sm" variant="outline" onClick={() => toggleActive(row)}>
                              {row.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => onArchive(row.slug)}>Archive</Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
