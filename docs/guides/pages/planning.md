# Planning

**Route:** `/operations/planning`  
**Shell:** Floor / Command

## Purpose

Boards, calendar, forms, review inbox, and configure (SA/ASA).

## Tabs by role

| Role | Tabs |
|---|---|
| Crew (`staff`) | Forms first, then Tasks (assigned cards only) |
| Video editor | Tasks + Calendar |
| Editors (SA/ASA/Ops Lead/…) | Tasks, Calendar, Forms, Events, Review, Configure |

## Form link (Michi C9)

A task can store `form_id`. The card shows that form’s name. **Open results** goes to Forms for that form. Feedback is the complaint template. Cash advance, equipment repair, and the detailing inquiry are the other published forms.

## Categories (Michi C13)

SA/ASA manage categories under **Configure**. Each category has `visible_roles` (`plan_categories.visible_roles`). Empty array = every role. Non-editors only see matching categories in filters and the task modal.

## Components

OpsTabList, TaskModal, calendar, FilterBar, PlanningConfigurePanel, PlanningFormsSmartPanel.
