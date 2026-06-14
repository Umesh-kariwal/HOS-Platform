SET search_path TO catalog, public;

ALTER TABLE "service_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_requests" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_requests_tenant_isolation ON "service_requests";
CREATE POLICY service_requests_tenant_isolation ON "service_requests" 
  FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
