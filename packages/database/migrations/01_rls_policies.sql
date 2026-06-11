-- Enable Row-Level Security on Core Tenant-Scoped Tables
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "folios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ledger_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "room_types" ENABLE ROW LEVEL SECURITY;

-- Create Tenant Isolation Policies (ALL Operations)
CREATE POLICY bookings_tenant_isolation ON "bookings"
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY guests_tenant_isolation ON "guests"
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY folios_tenant_isolation ON "folios"
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY ledger_entries_tenant_isolation ON "ledger_entries"
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY rooms_tenant_isolation ON "rooms"
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY room_types_tenant_isolation ON "room_types"
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
