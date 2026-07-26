-- Part 7: indexes for CRM insights + bookings date/branch filters
create index if not exists sale_line_items_sale_id_idx on public.sale_line_items (sale_id);
create index if not exists sale_line_items_service_id_idx on public.sale_line_items (service_id) where service_id is not null;
create index if not exists bookings_scheduled_branch_idx on public.bookings (scheduled_start, branch) where is_archived = false;
