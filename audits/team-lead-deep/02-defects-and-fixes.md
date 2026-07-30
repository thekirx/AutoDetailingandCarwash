# Team Lead defects and fixes

| ID | Pri | Defect | Status |
|----|-----|--------|--------|
| TL-C1 | CRITICAL | `/api/booking-status` service-role update ignored branch | **Fixed** `canStaffUpdateBookingStatus` + load-before-update |
| TL-C2 | CRITICAL | `provision-customer` excluded `team_lead` → New Ticket 403 | **Fixed** `QUEUE_PROVISION_ROLES` |
| TL-C3 | CRITICAL | `get_crew_kpi` null TL branch → all branches | **Fixed** raise 42501 |
| TL-C4 | CRITICAL | sales SELECT bare `team_lead` company-wide | **Fixed** `branch = current_user_branch()` |
| TL-H1 | HIGH | staff_profiles UPDATE USING any role on branch | **Fixed** TL USING/CHECK `role = 'staff'` |
| TL-H2 | HIGH | complaints SELECT unscoped for TL | **Fixed** branch predicate |
| TL-H5 | HIGH | TL could Mark redo then lose ticket | **Fixed** `canRedo` requires `canViewRedoLane` |
| TL-H7 | HIGH | customers UPDATE company-wide for TL | **Fixed** remove TL from update policy |
| TL-H8 | HIGH | loyalty_ledger SELECT included TL | **Fixed** drop TL |
| TL-M1 | MEDIUM | Bookings form defaulted `branches[0]` | **Fixed** `pickDefaultBranchSlug` |
| TL-M2 | MEDIUM | `hasValidTeamLeadBranch` ignored `branch_slugs` | **Fixed** |
| TL-M3 | MEDIUM | `__none__` truthy in geo/addStaff | **Fixed** reject `NO_BRANCH_SCOPE` |
| TL-M4 | MEDIUM | Crew Settings tab for TL (dead UX) | **Fixed** hide unless can edit settings |
| TL-C5 / H6 | — | customers SELECT + plate search still broad | **Deferred** (queue plate UX); writes tightened |

## Correct hypothesis

Service-role booking-status and bare-role RLS treated TL like company admin. Branch gates on the API + SQL close the mutate/leak paths; provision restore unblocks New Ticket.
