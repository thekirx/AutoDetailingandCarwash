-- Replace queue-test mock copy on public-facing wash/detailing SKUs.
-- Names/descriptions now match homepage marketing where slugs align.

update public.services
set
  name = 'Carwash',
  description = 'A careful exterior clean that brings back a crisp, spotless finish.'
where slug = 'premium-car-wash';

update public.services
set description = 'Deep cabin care for cleaner surfaces, fresher air, and renewed comfort.'
where slug = 'interior-detailing';

update public.services
set
  name = 'Full Exterior Detailing',
  description = 'Deep exterior care designed to restore your vehicle''s finish, cleanliness, and overall appearance.'
where slug = 'full-exterior-detailing';
