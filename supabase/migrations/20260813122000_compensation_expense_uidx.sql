-- One draft salary pool per branch per calendar day (client key compensation:{branch}:{date}).
create unique index if not exists expenses_compensation_day_uidx
  on public.expenses (description)
  where expense_kind = 'salary_carwash'
    and description like 'compensation:%';
