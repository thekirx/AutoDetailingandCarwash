-- OPT-07 remaining unindexed FKs (content / CRM / inventory / SMS).

create index if not exists blogs_created_by_idx on public.blogs (created_by) where created_by is not null;
create index if not exists complaints_booking_id_idx on public.complaints (booking_id) where booking_id is not null;
create index if not exists complaints_branch_idx on public.complaints (branch);
create index if not exists data_center_events_actor_id_idx on public.data_center_events (actor_id) where actor_id is not null;
create index if not exists event_registrations_event_id_idx on public.event_registrations (event_id);
create index if not exists events_branch_idx on public.events (branch);
create index if not exists notification_broadcasts_branch_slug_idx on public.notification_broadcasts (branch_slug) where branch_slug is not null;
create index if not exists notification_broadcasts_sent_by_idx on public.notification_broadcasts (sent_by) where sent_by is not null;
create index if not exists notification_settings_created_by_idx on public.notification_settings (created_by) where created_by is not null;
create index if not exists ops_forms_created_by_idx on public.ops_forms (created_by) where created_by is not null;
create index if not exists plan_boards_created_by_idx on public.plan_boards (created_by) where created_by is not null;
create index if not exists product_stock_movements_product_id_idx on public.product_stock_movements (product_id);
create index if not exists products_branch_slug_idx on public.products (branch_slug) where branch_slug is not null;
create index if not exists sms_events_booking_id_idx on public.sms_events (booking_id) where booking_id is not null;
create index if not exists sms_events_customer_id_idx on public.sms_events (customer_id) where customer_id is not null;
create index if not exists sms_events_vehicle_id_idx on public.sms_events (vehicle_id) where vehicle_id is not null;
