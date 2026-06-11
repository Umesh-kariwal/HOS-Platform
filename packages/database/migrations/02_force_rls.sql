-- Force Row-Level Security on Core Tenant-Scoped Tables
-- This ensures that even the table owners/superusers are bound by the RLS policies
ALTER TABLE "bookings" FORCE ROW LEVEL SECURITY;
ALTER TABLE "guests" FORCE ROW LEVEL SECURITY;
ALTER TABLE "folios" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ledger_entries" FORCE ROW LEVEL SECURITY;
ALTER TABLE "rooms" FORCE ROW LEVEL SECURITY;
ALTER TABLE "room_types" FORCE ROW LEVEL SECURITY;

-- ==========================================================
-- VERIFICATION & AUDIT QUERIES
-- ==========================================================

-- 1. Verify RLS is enabled and forced on these tables:
-- SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('bookings', 'guests', 'folios', 'ledger_entries', 'rooms', 'room_types');
-- Expected output: relrowsecurity = true, relforcerowsecurity = true for all.

-- 2. Test Policy Evaluation as Admin User:
--
-- -- A. Run query without setting the tenant context session variable (should return 0 rows):
-- SELECT * FROM bookings;
--
-- -- B. Set tenant context to Tenant A and query (should return only Tenant A's bookings):
-- SET LOCAL app.current_tenant_id = '00000000-0000-0000-0000-000000000002';
-- SELECT * FROM bookings;
--
-- -- C. Switch to Tenant B and query (should return only Tenant B's bookings):
-- SET LOCAL app.current_tenant_id = '11111111-1111-1111-1111-111111111111';
-- SELECT * FROM bookings;
