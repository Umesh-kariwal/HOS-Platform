-- RLS Policy for Maintenance Tickets Table
SET search_path TO catalog, public;

ALTER TABLE "maintenance_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "maintenance_tickets" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS maintenance_tickets_tenant_isolation ON "maintenance_tickets";
CREATE POLICY maintenance_tickets_tenant_isolation ON "maintenance_tickets" 
  FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
