# Staff defects and fixes

| ID | Pri | Defect | Status |
|----|-----|--------|--------|
| STF-C1 | CRITICAL | Vehicles FOR ALL included bare `staff` | **Fixed** drop staff manage; read via assigned booking vehicle |
| STF-C2 | CRITICAL | `is_staff()` opened transactions R/W | **Fixed** dropped Staff transaction policies |
| STF-C3 | CRITICAL | Own queue_assignments UPDATE could change `booking_id` | **Fixed** drop policy; acknowledge/complete RPCs |
| STF-H2 | HIGH | No queue complete on My Tasks | **Fixed** Mark done → `complete_queue_assignment` |
| STF-H3 | HIGH | Time clock only on Crew (denied) | **Fixed** Attendance panel on My Tasks |
| STF-H4 | HIGH | plan_card_assignees could change `card_id` | **Fixed** trigger + client whitelist |
| STF-H5 | HIGH | Historical assignment unlocked booking forever | **Fixed** `staff_is_assigned_to_booking` pending/active only |
| STF-H6 | HIGH | NotificationBell → console for Staff | **Fixed** `redirectForRole` home |
| STF-H1 | HIGH | Client-only geofence | **Deferred** (UI restored; server geo RPC later) |

## Correct hypothesis

Staff reused floor-ops RLS helpers (`is_staff()`, vehicles manage) and open own-row UPDATEs. Narrow money/vehicle policies and status-only RPCs close the escalate path; My Tasks gets complete + clock.
