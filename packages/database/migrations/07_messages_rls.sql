SET search_path TO catalog, public;

ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_tenant_isolation ON "messages";
CREATE POLICY messages_tenant_isolation ON "messages" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
