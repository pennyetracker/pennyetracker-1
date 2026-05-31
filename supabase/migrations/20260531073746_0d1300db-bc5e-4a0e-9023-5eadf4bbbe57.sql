CREATE OR REPLACE FUNCTION public.get_public_delivery_partners()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(g ORDER BY g->>'panchayath_name'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'panchayath_id', p.id,
      'panchayath_name', p.name,
      'partners', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', s.id,
          'full_name', s.full_name,
          'phone', s.phone,
          'alt_phone', s.alt_phone,
          'latitude', s.latitude,
          'longitude', s.longitude,
          'location_updated_at', s.location_updated_at,
          'wards', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('name', w.name, 'ward_number', w.ward_number)
              ORDER BY w.ward_number NULLS LAST, w.name)
            FROM public.delivery_staff_wards dsw
            JOIN public.wards w ON w.id = dsw.ward_id
            WHERE dsw.staff_id = s.id AND w.panchayath_id = p.id
          ), '[]'::jsonb),
          'assignments', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'panchayath_id', pp.id,
              'panchayath_name', pp.name,
              'wards', COALESCE((
                SELECT jsonb_agg(jsonb_build_object('name', w2.name, 'ward_number', w2.ward_number)
                  ORDER BY w2.ward_number NULLS LAST, w2.name)
                FROM public.delivery_staff_wards dsw2
                JOIN public.wards w2 ON w2.id = dsw2.ward_id
                WHERE dsw2.staff_id = s.id AND w2.panchayath_id = pp.id
              ), '[]'::jsonb)
            ) ORDER BY pp.name)
            FROM public.delivery_staff_panchayaths dsp2
            JOIN public.panchayaths pp ON pp.id = dsp2.panchayath_id
            WHERE dsp2.staff_id = s.id
          ), '[]'::jsonb)
        ) ORDER BY s.full_name)
        FROM public.delivery_staff s
        JOIN public.delivery_staff_panchayaths dsp ON dsp.staff_id = s.id
        WHERE dsp.panchayath_id = p.id
          AND s.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = s.user_id
              AND ur.role IN ('admin'::app_role, 'super_admin'::app_role)
          )
      ), '[]'::jsonb)
    ) AS g
    FROM public.panchayaths p
    WHERE EXISTS (
      SELECT 1 FROM public.delivery_staff_panchayaths dsp
      JOIN public.delivery_staff s ON s.id = dsp.staff_id
      WHERE dsp.panchayath_id = p.id
        AND s.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = s.user_id
            AND ur.role IN ('admin'::app_role, 'super_admin'::app_role)
        )
    )
  ) t;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_delivery_partners() TO anon, authenticated;