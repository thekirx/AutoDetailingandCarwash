-- Child jobs use the 25 Oct point table.
-- Premium and Platinum under Ceramic Coating. High Impact Partial under PPF.

update public.services s
set points_award = 20
from public.services p
where s.parent_service_id = p.id
  and lower(trim(p.name)) = 'ceramic coating'
  and lower(trim(s.name)) = 'premium';

update public.services s
set points_award = 25
from public.services p
where s.parent_service_id = p.id
  and lower(trim(p.name)) = 'ceramic coating'
  and lower(trim(s.name)) = 'platinum';

update public.services s
set points_award = 30
from public.services p
where s.parent_service_id = p.id
  and lower(trim(p.name)) like '%ppf%'
  and lower(trim(s.name)) = 'high impact partial';
