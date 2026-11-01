-- Code 9: Cash advance and cash advance payment in Chart of Accounts (expense_categories).
-- Enables tracking and categorizing cash advances and advance repayments within Finance.

insert into public.expense_categories (name, code, kind, sort_order, is_chemical)
values ('Cash advance and cash advance payment', '9', 'general', 9, false)
on conflict (name) do update
set code = '9',
    kind = 'general',
    sort_order = 9;

