SET search_path TO catalog, public;

ALTER TABLE "revenue_pricing_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "revenue_pricing_rules" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS revenue_pricing_rules_tenant_isolation ON "revenue_pricing_rules";
CREATE POLICY revenue_pricing_rules_tenant_isolation ON "revenue_pricing_rules" 
  FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
