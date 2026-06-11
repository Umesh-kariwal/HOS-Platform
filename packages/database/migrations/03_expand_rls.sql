-- Expand Row-Level Security to all 26 Tenant-Scoped Tables
-- This prevents application-layer nested write bypasses on all operational entities
SET search_path TO catalog, public;

-- 1. branches
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "branches" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS branches_tenant_isolation ON "branches";
CREATE POLICY branches_tenant_isolation ON "branches" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 2. roles
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS roles_tenant_isolation ON "roles";
CREATE POLICY roles_tenant_isolation ON "roles" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 3. role_permissions
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_permissions_tenant_isolation ON "role_permissions";
CREATE POLICY role_permissions_tenant_isolation ON "role_permissions" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 4. employees
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employees" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employees_tenant_isolation ON "employees";
CREATE POLICY employees_tenant_isolation ON "employees" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 5. floors
ALTER TABLE "floors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "floors" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS floors_tenant_isolation ON "floors";
CREATE POLICY floors_tenant_isolation ON "floors" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 6. room_types
ALTER TABLE "room_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "room_types" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS room_types_tenant_isolation ON "room_types";
CREATE POLICY room_types_tenant_isolation ON "room_types" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 7. rooms
ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rooms" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rooms_tenant_isolation ON "rooms";
CREATE POLICY rooms_tenant_isolation ON "rooms" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 8. inventory_snapshots
ALTER TABLE "inventory_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_snapshots" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventory_snapshots_tenant_isolation ON "inventory_snapshots";
CREATE POLICY inventory_snapshots_tenant_isolation ON "inventory_snapshots" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 9. guests
ALTER TABLE "guests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guests" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guests_tenant_isolation ON "guests";
CREATE POLICY guests_tenant_isolation ON "guests" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 10. bookings
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookings" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bookings_tenant_isolation ON "bookings";
CREATE POLICY bookings_tenant_isolation ON "bookings" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 11. folios
ALTER TABLE "folios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "folios" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS folios_tenant_isolation ON "folios";
CREATE POLICY folios_tenant_isolation ON "folios" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 12. billing_routing_rules
ALTER TABLE "billing_routing_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_routing_rules" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS billing_routing_rules_tenant_isolation ON "billing_routing_rules";
CREATE POLICY billing_routing_rules_tenant_isolation ON "billing_routing_rules" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 13. ledger_entries
ALTER TABLE "ledger_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ledger_entries" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ledger_entries_tenant_isolation ON "ledger_entries";
CREATE POLICY ledger_entries_tenant_isolation ON "ledger_entries" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 14. property_dates
ALTER TABLE "property_dates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "property_dates" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS property_dates_tenant_isolation ON "property_dates";
CREATE POLICY property_dates_tenant_isolation ON "property_dates" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 15. night_audit_checkpoints
ALTER TABLE "night_audit_checkpoints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "night_audit_checkpoints" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS night_audit_checkpoints_tenant_isolation ON "night_audit_checkpoints";
CREATE POLICY night_audit_checkpoints_tenant_isolation ON "night_audit_checkpoints" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 16. inventory_locations
ALTER TABLE "inventory_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_locations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventory_locations_tenant_isolation ON "inventory_locations";
CREATE POLICY inventory_locations_tenant_isolation ON "inventory_locations" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 17. items
ALTER TABLE "items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "items" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS items_tenant_isolation ON "items";
CREATE POLICY items_tenant_isolation ON "items" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 18. stock_levels
ALTER TABLE "stock_levels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_levels" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_levels_tenant_isolation ON "stock_levels";
CREATE POLICY stock_levels_tenant_isolation ON "stock_levels" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 19. parking_slots
ALTER TABLE "parking_slots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parking_slots" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS parking_slots_tenant_isolation ON "parking_slots";
CREATE POLICY parking_slots_tenant_isolation ON "parking_slots" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 20. valet_tickets
ALTER TABLE "valet_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "valet_tickets" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS valet_tickets_tenant_isolation ON "valet_tickets";
CREATE POLICY valet_tickets_tenant_isolation ON "valet_tickets" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 21. visitor_records
ALTER TABLE "visitor_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "visitor_records" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS visitor_records_tenant_isolation ON "visitor_records";
CREATE POLICY visitor_records_tenant_isolation ON "visitor_records" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 22. lost_and_found_items
ALTER TABLE "lost_and_found_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lost_and_found_items" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lost_and_found_items_tenant_isolation ON "lost_and_found_items";
CREATE POLICY lost_and_found_items_tenant_isolation ON "lost_and_found_items" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 23. incident_logs
ALTER TABLE "incident_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incident_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS incident_logs_tenant_isolation ON "incident_logs";
CREATE POLICY incident_logs_tenant_isolation ON "incident_logs" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 24. offline_sync_records
ALTER TABLE "offline_sync_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "offline_sync_records" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS offline_sync_records_tenant_isolation ON "offline_sync_records";
CREATE POLICY offline_sync_records_tenant_isolation ON "offline_sync_records" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 25. audit_logs
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_tenant_isolation ON "audit_logs";
CREATE POLICY audit_logs_tenant_isolation ON "audit_logs" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 26. outbox
ALTER TABLE "outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outbox_tenant_isolation ON "outbox";
CREATE POLICY outbox_tenant_isolation ON "outbox" FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
