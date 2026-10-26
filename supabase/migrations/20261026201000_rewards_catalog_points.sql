-- Set points_award / points_price only where the catalog name already exists.
-- Rows that use a different name are left alone. The app catalog is the reference list.

update public.services s
set points_award = v.points
from (values
  ('premium car wash', 1),
  ('express', 2),
  ('basic', 3),
  ('deluxe', 4),
  ('paint maintenance', 5),
  ('paint refresh', 5),
  ('glass cleaning', 3),
  ('headlight restore', 3),
  ('black trims restore', 3),
  ('glass detailing', 5),
  ('glass coating', 5),
  ('classic ceramic', 15),
  ('premium ceramic', 20),
  ('platinum ceramic', 25),
  ('nano ceramic tint', 10),
  ('nano ceramic pro tint', 15),
  ('nano ceramic pro black series tint', 20),
  ('interior detailing', 10),
  ('interior deep cleaning', 5),
  ('high impact partial ppf', 30),
  ('basic ppf', 40),
  ('ultimate ppf', 50),
  ('platinum ppf', 60)
) as v(name, points)
where lower(trim(s.name)) = v.name;

update public.products p
set points_price = v.points
from (values
  ('hakum shirt', 50),
  ('clear pro mug', 30),
  ('clear pro yellow bag', 30),
  ('clear pro coffee kit', 60),
  ('hakum key chain', 20),
  ('hakum car care kit', 50),
  ('fusso coat spray', 50),
  ('luxury gloss spray', 50),
  ('hakum car scent', 30),
  ('air spencer', 30)
) as v(name, points)
where lower(trim(p.name)) = v.name;

-- Live catalog uses these longer names for the same three films.
update public.services set points_award = 40 where lower(trim(name)) = 'basic ppf protection';
update public.services set points_award = 50 where lower(trim(name)) = 'ultimate ppf protection';
update public.services set points_award = 60 where lower(trim(name)) = 'platinum ppf protection';
