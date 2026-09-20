CREATE TABLE public.inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  unit_id uuid REFERENCES public.units(id),
  kind text NOT NULL DEFAULT 'periodic',
  status text NOT NULL DEFAULT 'planned',
  scheduled_at timestamptz,
  completed_at timestamptz,
  inspector_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspections TO authenticated;
GRANT ALL ON public.inspections TO service_role;

ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage inspections" ON public.inspections
  FOR ALL TO authenticated
  USING (public.is_org_staff(auth.uid(), organization_id))
  WITH CHECK (public.is_org_staff(auth.uid(), organization_id));

CREATE POLICY "Residents see own inspections" ON public.inspections
  FOR SELECT TO authenticated
  USING (unit_id IN (SELECT public.my_unit_ids(auth.uid())));

CREATE INDEX inspections_org_idx ON public.inspections (organization_id, scheduled_at);