/**
 * Tests for multi-branch customer notes and cross-branch history visibility.
 * Ensures that when an existing customer from Bacoor visits another branch (e.g. Imus),
 * all notes and visit history recorded by the Bacoor Team Lead are visible to the other TL or Admin.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  attachNoteAuthors,
  formatNoteAuthorDate,
  formatRoleLabel,
} from '../src/lib/customerNoteDisplay.js'
import {
  buildHistoryTimeline,
  filterHistoryTimeline,
  summarizeHistoryIdentity,
} from '../src/lib/customerHistory.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('Multi-Branch Customer Notes Display', () => {
  it('formats role labels accurately', () => {
    assert.equal(formatRoleLabel('team_lead'), 'Team Lead')
    assert.equal(formatRoleLabel('admin'), 'Admin')
    assert.equal(formatRoleLabel('BossMich'), 'Super Admin')
    assert.equal(formatRoleLabel('operations_lead'), 'Assistant Super Admin')
  })

  it('formats cross-branch note author, role, and branch', () => {
    const formatted = formatNoteAuthorDate({
      authorName: 'Carlo TL',
      authorRole: 'team_lead',
      authorBranch: 'bacoor',
      branch: 'bacoor',
      createdAt: '2026-10-15T14:30:00+08:00',
    })

    assert.match(formatted, /Carlo TL/)
    assert.match(formatted, /Team Lead/)
    assert.match(formatted, /bacoor/)
    assert.match(formatted, /Oct 15, 2026/)
  })

  it('attaches author branch from note or staff profile', () => {
    const rawNotes = [
      {
        id: 'n1',
        customer_id: 'c1',
        body: 'Prefers citrus scent, sensitive paint on hood',
        note_type: 'preference',
        branch_slug: 'bacoor',
        created_by: 'staff-bacoor-1',
        created_at: '2026-10-10T10:00:00Z',
      },
      {
        id: 'n2',
        customer_id: 'c1',
        body: 'Scratch on left fender before wash',
        note_type: 'vehicle_defect',
        branch_slug: null, // fallback to staff profile
        created_by: 'staff-imus-1',
        created_at: '2026-10-20T10:00:00Z',
      },
    ]

    const staffProfiles = [
      { id: 'staff-bacoor-1', full_name: 'Mark TL', role: 'team_lead', branch_slug: 'bacoor' },
      { id: 'staff-imus-1', full_name: 'Sarah TL', role: 'team_lead', branch_slug: 'imus' },
    ]

    const attached = attachNoteAuthors(rawNotes, staffProfiles)
    assert.equal(attached.length, 2)

    assert.equal(attached[0].author_name, 'Mark TL')
    assert.equal(attached[0].author_role, 'team_lead')
    assert.equal(attached[0].author_branch, 'bacoor')

    assert.equal(attached[1].author_name, 'Sarah TL')
    assert.equal(attached[1].author_role, 'team_lead')
    assert.equal(attached[1].author_branch, 'imus')
  })
})

describe('Multi-Branch Customer History Timeline & Identity', () => {
  const bookings = [
    {
      id: 'b-bacoor-1',
      vehicle_plate: 'NBD 1234',
      customer_name: 'Juan Dela Cruz',
      customer_phone: '09171234567',
      branch: 'bacoor',
      status: 'completed',
      created_at: '2026-09-10T08:00:00Z',
      final_price_minor: 50000,
      notes: 'Bacoor initial ceramic coating',
      services: { name: 'Ceramic Coating' },
    },
    {
      id: 'b-imus-1',
      vehicle_plate: 'NBD 1234',
      customer_name: 'Juan Dela Cruz',
      customer_phone: '09171234567',
      branch: 'imus',
      status: 'waiting',
      created_at: '2026-11-01T09:00:00Z',
      price_minor: 35000,
      notes: 'Imus maintenance wash',
      services: { name: 'Wash & Wax' },
    },
  ]

  const notes = [
    {
      id: 'note-bacoor-1',
      body: 'Guest requested extra wipe down on matte rims',
      note_type: 'preference',
      branch_slug: 'bacoor',
      created_at: '2026-09-10T08:15:00Z',
      author_name: 'Carlo TL',
      author_role: 'team_lead',
      author_branch: 'bacoor',
    },
  ]

  it('aggregates multiple branches in customer identity summary', () => {
    const identity = summarizeHistoryIdentity({ bookings, notes })
    assert.deepEqual(identity.branches.sort(), ['bacoor', 'imus'].sort())
    assert.deepEqual(identity.plates, ['NBD 1234'])
    assert.equal(identity.names[0], 'Juan Dela Cruz')
  })

  it('builds unified timeline including bookings and guest notes across branches', () => {
    const timeline = buildHistoryTimeline({ bookings, notes })
    assert.equal(timeline.length, 3)

    const noteEvent = timeline.find((e) => e.kind === 'note')
    assert.ok(noteEvent)
    assert.equal(noteEvent.branch, 'bacoor')
    assert.equal(noteEvent.author, 'Carlo TL')
    assert.equal(noteEvent.authorRole, 'team_lead')
    assert.match(noteEvent.notes, /matte rims/)
  })

  it('filters timeline by branch and event kinds', () => {
    const timeline = buildHistoryTimeline({ bookings, notes })

    // Filter to Bacoor only
    const bacoorEvents = filterHistoryTimeline(timeline, { branch: 'bacoor' })
    assert.equal(bacoorEvents.length, 2)
    assert.ok(bacoorEvents.every((e) => e.branch === 'bacoor'))

    // Filter to notes only
    const noteEvents = filterHistoryTimeline(timeline, { kinds: ['note'] })
    assert.equal(noteEvents.length, 1)
    assert.equal(noteEvents[0].kind, 'note')
  })
})

describe('Database Migration & Cross-Branch Policy Verification', () => {
  it('migration file defines multi-branch customer notes schema and RLS', () => {
    const migration = read('supabase/migrations/20261108200000_multi_branch_customer_notes.sql')

    // Adds branch_slug to customer_notes
    assert.match(migration, /alter table public\.customer_notes[\s\S]*?add column if not exists branch_slug text/i)
    assert.match(migration, /customer_notes_branch_idx/)

    // Updates staff_display_names RPC to expose branch_slug without branch restriction
    assert.match(migration, /CREATE OR REPLACE FUNCTION public\.staff_display_names/i)
    assert.match(migration, /sp\.branch_slug/)

    // Updates bookings_select policy so staff can read customer history across branches
    assert.match(migration, /DROP POLICY IF EXISTS "?bookings_select"? ON public\.bookings/i)
    assert.match(migration, /public\.is_staff\(\)/)
  })
})

describe('Frontend Component Multi-Branch Compatibility', () => {
  it('CustomerNotesPanel selects branch_slug and links plate and customer_id', () => {
    const panel = read('src/components/CustomerNotesPanel.jsx')
    assert.match(panel, /branch_slug/)
    assert.match(panel, /branch = ''/)
    assert.match(panel, /customer_id\.eq\.\$\{customerId\},plate_normalized\.eq\.\$\{plateNorm\}/)
    assert.match(panel, /formatNoteAuthorDate/)
    assert.match(panel, /data-testid="note-author-date"/)
  })

  it('QueueTicketEditor passes branch to CustomerNotesPanel', () => {
    const editor = read('src/components/QueueTicketEditor.jsx')
    assert.match(editor, /<CustomerNotesPanel[\s\S]*?branch=\{ticket\.branch \|\| ''\}/)
  })

  it('TeamLeadQueuePage preserves branch and notes in history mapping', () => {
    const tlPage = read('src/pages/TeamLeadQueuePage.jsx')
    assert.match(tlPage, /branch:\s*v\.branch/)
    assert.match(tlPage, /notes:\s*v\.notes/)
    assert.match(tlPage, /row\.branch/)
  })

  it('HistoryPage includes guest notes in KIND_FILTERS and shows note badges', () => {
    const historyPage = read('src/pages/HistoryPage.jsx')
    assert.match(historyPage, /\{ id: 'note', label: 'Guest notes' \}/)
    assert.match(historyPage, /Guest Note/)
    assert.match(historyPage, /Author/)
  })

  it('customerHistoryApi returns notes and searches across branches', () => {
    const api = read('server/customerHistoryApi.mjs')
    assert.match(api, /from\('customer_notes'\)/)
    assert.match(api, /buildHistoryTimeline/)
    assert.match(api, /notes[\s\S]*?timeline/)
  })
})
