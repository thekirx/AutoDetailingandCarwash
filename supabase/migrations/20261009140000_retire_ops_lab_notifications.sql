-- Ops Lab (/operations/roadmap) is retired from the app. Its inbox alerts would point at a page
-- that no longer exists, so drop them. ops_roadmap_* / ops_lab_* tables and rows are kept.
delete from public.user_notifications where kind like 'ops_lab.%';
