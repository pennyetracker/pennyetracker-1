CREATE TABLE public.delivery_staff_panchayaths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.delivery_staff(id) ON DELETE CASCADE,
  panchayath_id uuid NOT NULL REFERENCES public.panchayaths(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, panchayath_id)
);

CREATE TABLE public.delivery_staff_wards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.delivery_staff(id) ON DELETE CASCADE,
  ward_id uuid NOT NULL REFERENCES public.wards(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, ward_id)
);

ALTER TABLE public.delivery_staff_panchayaths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_staff_wards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage staff panchayaths select" ON public.delivery_staff_panchayaths FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage staff panchayaths insert" ON public.delivery_staff_panchayaths FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage staff panchayaths delete" ON public.delivery_staff_panchayaths FOR DELETE USING (public.is_admin(auth.uid()));

CREATE POLICY "Staff view own panchayaths" ON public.delivery_staff_panchayaths FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.delivery_staff s WHERE s.id = staff_id AND s.user_id = auth.uid())
);

CREATE POLICY "Admins manage staff wards select" ON public.delivery_staff_wards FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage staff wards insert" ON public.delivery_staff_wards FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage staff wards delete" ON public.delivery_staff_wards FOR DELETE USING (public.is_admin(auth.uid()));

CREATE POLICY "Staff view own wards" ON public.delivery_staff_wards FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.delivery_staff s WHERE s.id = staff_id AND s.user_id = auth.uid())
);

CREATE INDEX idx_dsp_staff ON public.delivery_staff_panchayaths(staff_id);
CREATE INDEX idx_dsw_staff ON public.delivery_staff_wards(staff_id);