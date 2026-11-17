-- Harden backend data model, pricing integrity, package/detailing classification,
-- constraints, indexes, and PostgreSQL RPCs for services, packages, and detailing.

BEGIN;

-- 1. Fix Paint Refresh Package Extra Large price typo (₱650 -> ₱6,500)
UPDATE public.service_size_prices ssp
SET price_minor = 650000,
    updated_at = now()
FROM public.services s
WHERE ssp.service_id = s.id
  AND s.slug = 'paint-refresh-package'
  AND ssp.size_slug = 'extra_large'
  AND ssp.price_minor IS DISTINCT FROM 650000;

-- 2. Normalize archived flag vs active flag on services before enforcing CHECK
UPDATE public.services
SET is_active = false,
    updated_at = now()
WHERE is_archived = true
  AND is_active = true;

-- 3. Deduplicate redundant CHECK constraints and add structural integrity guards
ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_duration_minutes_check,
  DROP CONSTRAINT IF EXISTS services_price_minor_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'services'
      AND con.conname = 'services_no_self_parent'
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_no_self_parent
      CHECK (parent_service_id IS NULL OR parent_service_id <> id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'services'
      AND con.conname = 'services_archived_inactive_check'
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_archived_inactive_check
      CHECK (NOT (is_archived AND is_active));
  END IF;
END $$;

-- 4. Cover unindexed self-referential FK (services.parent_service_id -> services.id)
CREATE INDEX IF NOT EXISTS services_parent_service_id_idx
  ON public.services (parent_service_id)
  WHERE parent_service_id IS NOT NULL;

-- 5. Validate package/child hierarchy and included_service_ids on insert/update
CREATE OR REPLACE FUNCTION public.validate_service_package_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_parent_parent_id uuid;
  v_clean_ids uuid[] := '{}'::uuid[];
  v_item uuid;
BEGIN
  IF COALESCE(NEW.is_archived, false) THEN
    NEW.is_active := false;
  END IF;

  IF NEW.parent_service_id IS NOT NULL THEN
    IF NEW.parent_service_id = NEW.id THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'A service cannot be its own parent.';
    END IF;

    SELECT s.parent_service_id
    INTO v_parent_parent_id
    FROM public.services s
    WHERE s.id = NEW.parent_service_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Parent service was not found.';
    END IF;

    IF v_parent_parent_id IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Nested sub-packages (depth > 1) are not allowed.';
    END IF;

    IF TG_OP = 'UPDATE' AND EXISTS (
      SELECT 1
      FROM public.services child
      WHERE child.parent_service_id = NEW.id
        AND NOT COALESCE(child.is_archived, false)
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'A parent service with active packages cannot become a child package.';
    END IF;
  END IF;

  IF NEW.included_service_ids IS NULL THEN
    NEW.included_service_ids := '{}'::uuid[];
  ELSIF array_length(NEW.included_service_ids, 1) IS NOT NULL THEN
    FOREACH v_item IN ARRAY NEW.included_service_ids
    LOOP
      IF v_item IS NULL OR v_item = NEW.id OR v_item = ANY(v_clean_ids) THEN
        CONTINUE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.services s WHERE s.id = v_item) THEN
        RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = format('Included service %s does not exist.', v_item);
      END IF;
      v_clean_ids := array_append(v_clean_ids, v_item);
    END LOOP;
    NEW.included_service_ids := v_clean_ids;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS services_validate_package_links ON public.services;
CREATE TRIGGER services_validate_package_links
  BEFORE INSERT OR UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_service_package_links();

-- 6. Align public.catalog_line_kind() with src/lib/serviceKinds.js:
--    Check PPF BEFORE detailing so PPF packages with pay_category='detailing'
--    are stamped as line_kind='ppf' rather than misattributed as ceramic detailing.
CREATE OR REPLACE FUNCTION public.catalog_line_kind(
  p_item_type text,
  p_pay_category text,
  p_slug text DEFAULT NULL::text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $function$
  SELECT CASE
    WHEN lower(coalesce(p_item_type, '')) = 'product' THEN 'merch'
    WHEN lower(coalesce(p_pay_category, '')) = 'ppf'
      OR lower(coalesce(p_slug, '')) = 'paint-protection-film'
      OR lower(coalesce(p_slug, '')) LIKE '%ppf%' THEN 'ppf'
    WHEN lower(coalesce(p_slug, '')) IN (
      'ceramic-coating',
      'ultimate-ceramic-coating',
      'platinum-ceramic-coating',
      'paint-maintenance',
      'ceramic-paint-maintenance',
      'nano-ceramic-tint',
      'nano-ceramic-pro-tint',
      'nano-ceramic-pro-black-series-tint'
    )
      OR lower(coalesce(p_pay_category, '')) = 'detailing' THEN 'detailing'
    WHEN lower(coalesce(p_pay_category, '')) = 'package' THEN 'package'
    ELSE 'service'
  END;
$function$;

-- Re-stamp existing service sale_line_items whose line_kind drifted (e.g. paint-protection-film -> 'ppf')
UPDATE public.sale_line_items li
SET line_kind = public.catalog_line_kind('service', s.pay_category, s.slug)
FROM public.services s
WHERE li.item_type = 'service'
  AND li.service_id = s.id
  AND li.line_kind IS DISTINCT FROM public.catalog_line_kind('service', s.pay_category, s.slug);

-- 7. Update assert_pos_sale_integrity so sized service lookups also enforce active & non-archived status
CREATE OR REPLACE FUNCTION public.assert_pos_sale_integrity(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  line jsonb;
  v_customer uuid := nullif(payload->>'customer_id', '')::uuid;
  v_handoff uuid := nullif(payload->>'pos_handoff_id', '')::uuid;
  v_method text := lower(trim(coalesce(payload->>'payment_method', 'cash')));
  v_ref text := trim(coalesce(payload->>'payment_ref', ''));
  v_reason text := trim(coalesce(payload->>'discount_reason', ''));
  v_stamps int;
  v_need int;
  award_count int := 0;
  bday_count int := 0;
  catalog_price int;
  unit int;
  qty int;
  item_type text;
  v_size text;
  v_methods jsonb;
  v_allowed boolean := false;
  v_opts jsonb;
  v_sized int;
BEGIN
  SELECT CASE
    WHEN jsonb_typeof(payment_methods) = 'array' AND jsonb_array_length(payment_methods) > 0
      THEN payment_methods
    ELSE '[{"value":"cash"},{"value":"gcash"},{"value":"card"}]'::jsonb
  END
  INTO v_methods
  FROM public.ops_pos_settings
  WHERE id = 1;

  IF v_methods IS NULL THEN
    v_methods := '[{"value":"cash"},{"value":"gcash"},{"value":"card"}]'::jsonb;
  END IF;

  IF v_method = 'split' THEN
    IF coalesce((payload->>'cash_minor')::int, 0) <= 0
       OR coalesce((payload->>'gcash_minor')::int, 0) <= 0 THEN
      RAISE EXCEPTION 'Split the ticket between cash and GCash';
    END IF;
    v_allowed := true;
  ELSE
    SELECT exists (
      SELECT 1
      FROM jsonb_array_elements(v_methods) AS m
      WHERE lower(trim(coalesce(
        CASE WHEN jsonb_typeof(m) = 'object' THEN m->>'value' ELSE m #>> '{}' END,
        ''
      ))) = v_method
    ) INTO v_allowed;
  END IF;

  IF NOT coalesce(v_allowed, false) THEN
    RAISE EXCEPTION 'Payment method is not enabled in POS settings';
  END IF;

  IF v_method <> 'cash' AND length(v_ref) < 4 THEN
    RAISE EXCEPTION 'Payment reference required for %', v_method;
  END IF;

  FOR line IN SELECT * FROM jsonb_array_elements(coalesce(payload->'lines', '[]'::jsonb))
  LOOP
    qty := coalesce((line->>'quantity')::int, 1);
    IF qty < 1 OR qty > 99 THEN
      RAISE EXCEPTION 'Quantity must be between 1 and 99';
    END IF;
    unit := coalesce((line->>'unit_price_minor')::int, 0);
    IF unit < 0 THEN
      RAISE EXCEPTION 'Negative line price is not allowed';
    END IF;

    IF coalesce((line->>'is_loyalty_award')::boolean, false)
       AND NOT coalesce((line->>'is_birthday_award')::boolean, false) THEN
      award_count := award_count + 1;
      IF v_customer IS NULL THEN
        RAISE EXCEPTION 'Link a customer before redeeming loyalty';
      END IF;
      IF unit <> 0 THEN
        RAISE EXCEPTION 'Loyalty award lines must be free';
      END IF;
    END IF;

    IF coalesce((line->>'is_birthday_award')::boolean, false) THEN
      bday_count := bday_count + 1;
      IF v_customer IS NULL THEN
        RAISE EXCEPTION 'Link a customer before redeeming a birthday perk';
      END IF;
    END IF;

    IF coalesce((line->>'is_loyalty_award')::boolean, false)
       OR coalesce((line->>'is_birthday_award')::boolean, false)
       OR coalesce((line->>'is_membership_included')::boolean, false) THEN
      CONTINUE;
    END IF;

    item_type := line->>'item_type';
    IF v_handoff IS NOT NULL AND item_type = 'service' THEN
      CONTINUE;
    END IF;

    IF item_type = 'product' THEN
      v_size := nullif(trim(coalesce(line->>'size_label', '')), '');
      SELECT p.price_minor, coalesce(p.size_options, '[]'::jsonb)
        INTO catalog_price, v_opts
      FROM public.products p
      WHERE p.id = (line->>'product_id')::uuid AND p.is_active AND NOT p.is_archived;
      IF catalog_price IS NULL THEN
        RAISE EXCEPTION 'Product not found or inactive';
      END IF;
      IF v_size IS NOT NULL THEN
        SELECT (elem->>'price_minor')::int INTO v_sized
        FROM jsonb_array_elements(v_opts) elem
        WHERE lower(trim(coalesce(elem->>'label', ''))) = lower(v_size)
        LIMIT 1;
        IF v_sized IS NULL THEN
          RAISE EXCEPTION 'That size is not on this product';
        END IF;
        catalog_price := v_sized;
      ELSIF jsonb_typeof(v_opts) = 'array' AND jsonb_array_length(v_opts) > 0 THEN
        RAISE EXCEPTION 'Pick a size for this product';
      END IF;
    ELSIF item_type = 'service' THEN
      v_size := nullif(trim(coalesce(line->>'vehicle_size', '')), '');
      catalog_price := NULL;
      IF v_size IS NOT NULL THEN
        SELECT ssp.price_minor INTO catalog_price
        FROM public.service_size_prices ssp
        JOIN public.services s ON s.id = ssp.service_id
        WHERE ssp.service_id = (line->>'service_id')::uuid
          AND ssp.size_slug = v_size
          AND s.is_active
          AND NOT s.is_archived;
      END IF;
      IF catalog_price IS NULL THEN
        SELECT s.price_minor INTO catalog_price
        FROM public.services s
        WHERE s.id = (line->>'service_id')::uuid AND s.is_active AND NOT s.is_archived;
      END IF;
      IF catalog_price IS NULL THEN
        RAISE EXCEPTION 'Service not found or inactive';
      END IF;
    ELSE
      CONTINUE;
    END IF;

    IF unit > catalog_price THEN
      RAISE EXCEPTION 'Line priced above catalog';
    END IF;
    IF unit < catalog_price AND length(v_reason) < 3 THEN
      RAISE EXCEPTION 'Discount needs a reason (3+ characters)';
    END IF;
  END LOOP;

  IF award_count > 1 THEN
    RAISE EXCEPTION 'One loyalty award per sale';
  END IF;
  IF bday_count > 1 THEN
    RAISE EXCEPTION 'One birthday award per sale';
  END IF;

  IF award_count > 0 THEN
    SELECT c.loyalty_stamps INTO v_stamps FROM public.customers c WHERE c.id = v_customer;
    SELECT min(m.threshold_points) INTO v_need
    FROM public.loyalty_milestones m
    WHERE coalesce(m.is_active, true)
      AND m.threshold_points <= coalesce(v_stamps, 0);
    IF v_need IS NULL THEN
      RAISE EXCEPTION 'Customer has no redeemable loyalty reward';
    END IF;
  END IF;

  IF bday_count > 0
     AND to_regclass('public.customer_birthday_perks') IS NOT NULL
     AND NOT exists (
       SELECT 1
       FROM public.customer_birthday_perks p
       WHERE p.customer_id = v_customer
         AND p.status = 'available'
         AND p.expires_at > clock_timestamp()
     ) THEN
    RAISE EXCEPTION 'No birthday perk available';
  END IF;
END;
$function$;

-- 8. Keep apply_booking_promo_voucher aligned with all active detailing/tint/PPF slugs
CREATE OR REPLACE FUNCTION public.apply_booking_promo_voucher(p_booking_id uuid, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  staff public.staff_profiles%rowtype;
  booking public.bookings%rowtype;
  voucher public.promo_vouchers%rowtype;
  normalized text;
  today_key date := (timezone('Asia/Manila', now()))::date;
  service_cat text;
  service_slug text;
  service_row_id uuid;
  service_parent_id uuid;
  holds int;
  prior int;
  list_price int;
  new_price int;
  discount int;
  is_detailing boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO staff FROM public.staff_profiles WHERE id = auth.uid() AND is_active = true;
  IF NOT found
     OR staff.role::text NOT IN ('team_lead', 'admin', 'BossMich', 'assistant_super_admin', 'operations_lead') THEN
    RAISE EXCEPTION 'Only the Team Lead, Branch Admin, or office can apply a voucher.';
  END IF;

  normalized := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  IF char_length(normalized) < 4 OR char_length(normalized) > 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Type a voucher code of 4 to 16 letters or numbers.');
  END IF;

  SELECT * INTO booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT found THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ticket not found.');
  END IF;
  IF booking.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That ticket is already closed.');
  END IF;
  IF booking.promo_voucher_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This ticket already has a voucher.');
  END IF;

  SELECT * INTO voucher
  FROM public.promo_vouchers
  WHERE code = normalized
  FOR UPDATE;
  IF NOT found OR voucher.is_active IS NOT true THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That voucher code was not found.');
  END IF;
  IF voucher.starts_on IS NOT NULL AND today_key < voucher.starts_on THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That voucher is not open yet.');
  END IF;
  IF voucher.ends_on IS NOT NULL AND today_key > voucher.ends_on THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That voucher has expired.');
  END IF;

  SELECT count(*)::int INTO holds
  FROM public.bookings b
  WHERE b.promo_voucher_id = voucher.id
    AND b.status NOT IN ('completed', 'cancelled');
  IF voucher.uses_count + holds >= voucher.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That voucher has no uses left.');
  END IF;

  IF booking.customer_id IS NOT NULL THEN
    SELECT count(*)::int INTO prior
    FROM public.promo_voucher_redemptions r
    WHERE r.voucher_id = voucher.id
      AND r.customer_id = booking.customer_id
      AND r.consumed_at IS NOT NULL;
    IF prior >= voucher.max_per_customer THEN
      RETURN jsonb_build_object('ok', false, 'error', 'This customer already used that voucher.');
    END IF;
  END IF;

  SELECT s.id, lower(coalesce(s.pay_category::text, '')), lower(coalesce(s.slug, '')), s.parent_service_id
  INTO service_row_id, service_cat, service_slug, service_parent_id
  FROM public.services s
  WHERE s.id = booking.service_id;

  is_detailing :=
    coalesce(service_cat, '') = 'detailing'
    OR coalesce(service_slug, '') IN (
      'ceramic-coating',
      'ultimate-ceramic-coating',
      'platinum-ceramic-coating',
      'paint-maintenance',
      'ceramic-paint-maintenance',
      'nano-ceramic-tint',
      'nano-ceramic-pro-tint',
      'nano-ceramic-pro-black-series-tint',
      'ppf',
      'paint-protection-film'
    )
    OR coalesce(service_slug, '') LIKE '%ppf%';

  IF voucher.applies_to = 'detailing' AND NOT is_detailing THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That voucher is for detailing only.');
  END IF;
  IF voucher.applies_to = 'wash' AND is_detailing THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That voucher is for wash and packages only.');
  END IF;
  IF (voucher.applies_to = 'service' OR voucher.service_id IS NOT NULL) THEN
    IF voucher.service_id IS NOT NULL
       AND booking.service_id IS DISTINCT FROM voucher.service_id
       AND service_parent_id IS DISTINCT FROM voucher.service_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That voucher is for a specific service only.');
    END IF;
  END IF;

  list_price := coalesce(booking.final_price_minor, booking.price_minor, 0);
  IF voucher.discount_kind = 'free' THEN
    new_price := 0;
  ELSIF voucher.discount_kind IN ('fixed', 'amount') THEN
    new_price := greatest(0, list_price - coalesce(voucher.discount_amount_minor, 0));
  ELSE
    new_price := greatest(0, round(list_price * (1 - (voucher.discount_percent / 100.0)))::int);
  END IF;
  discount := greatest(0, list_price - new_price);

  UPDATE public.bookings
  SET
    promo_voucher_id = voucher.id,
    promo_discount_minor = discount,
    promo_applied_by = staff.id,
    promo_applied_at = clock_timestamp(),
    final_price_minor = new_price,
    updated_at = clock_timestamp()
  WHERE id = booking.id;

  INSERT INTO public.promo_voucher_redemptions (
    voucher_id, booking_id, customer_id, applied_by, discount_minor
  ) VALUES (
    voucher.id, booking.id, booking.customer_id, staff.id, discount
  );

  RETURN jsonb_build_object(
    'ok', true,
    'voucher_id', voucher.id,
    'code', voucher.code,
    'title', voucher.title,
    'discount_minor', discount,
    'final_price_minor', new_price
  );
END;
$function$;

-- 9. Least-privilege table grants on services / service_size_prices / service_reviews
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.services, public.service_size_prices, public.service_reviews FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON public.services, public.service_size_prices, public.service_reviews FROM authenticated;

COMMIT;
