-- Hakum Planner specialty boards: Complaints, Equipment Repairs, Employee Cash Advance.
-- Each board: New → In Progress → Done. Indexes already cover board_id/position.

do $$
declare
  bid uuid;
  names text[] := array['Complaints', 'Equipment Repairs', 'Employee Cash Advance'];
  n text;
begin
  foreach n in array names loop
    if not exists (select 1 from public.plan_boards where name = n) then
      insert into public.plan_boards (name) values (n) returning id into bid;
      insert into public.plan_lists (board_id, title, position) values
        (bid, 'New', 0),
        (bid, 'In Progress', 1),
        (bid, 'Done', 2);
    end if;
  end loop;

  -- Ensure legacy general board keeps a clear name
  update public.plan_boards
  set name = 'Hakum Planner'
  where name = 'Hakum Planning';
end $$;
