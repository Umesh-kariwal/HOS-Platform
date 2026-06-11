--
-- PostgreSQL database dump
--

-- Dumped from database version 15.0
-- Dumped by pg_dump version 15.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'WIN1252';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: catalog; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA catalog;


ALTER SCHEMA catalog OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.audit_logs (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    entity_name text NOT NULL,
    entity_id text NOT NULL,
    old_values jsonb,
    new_values jsonb,
    ip_address text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.audit_logs OWNER TO postgres;

--
-- Name: billing_routing_rules; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.billing_routing_rules (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    charge_category text NOT NULL,
    split_type text NOT NULL,
    value numeric(12,2) NOT NULL,
    target_folio_id uuid NOT NULL
);


ALTER TABLE catalog.billing_routing_rules OWNER TO postgres;

--
-- Name: bookings; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.bookings (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    guest_id uuid NOT NULL,
    room_id uuid,
    check_in_date date NOT NULL,
    check_out_date date NOT NULL,
    status text DEFAULT 'reserved'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.bookings OWNER TO postgres;

--
-- Name: branch_routes; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.branch_routes (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.branch_routes OWNER TO postgres;

--
-- Name: branches; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.branches (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.branches OWNER TO postgres;

--
-- Name: employees; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.employees (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    email text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    branch_id uuid NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    password_hash text NOT NULL,
    role_id uuid NOT NULL
);

ALTER TABLE ONLY catalog.employees FORCE ROW LEVEL SECURITY;


ALTER TABLE catalog.employees OWNER TO postgres;

--
-- Name: floors; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.floors (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    name text NOT NULL,
    floor_number integer NOT NULL
);


ALTER TABLE catalog.floors OWNER TO postgres;

--
-- Name: folios; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.folios (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    parent_folio_id uuid,
    payer_type text DEFAULT 'guest'::text NOT NULL,
    payer_guest_id uuid,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.folios OWNER TO postgres;

--
-- Name: guests; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.guests (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text,
    profile_metadata jsonb
);


ALTER TABLE catalog.guests OWNER TO postgres;

--
-- Name: incident_logs; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.incident_logs (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    escalation_level integer DEFAULT 1 NOT NULL,
    details text NOT NULL,
    logged_by_id uuid NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.incident_logs OWNER TO postgres;

--
-- Name: inventory_locations; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.inventory_locations (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE catalog.inventory_locations OWNER TO postgres;

--
-- Name: inventory_snapshots; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.inventory_snapshots (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    room_type_id uuid NOT NULL,
    snapshot_date date NOT NULL,
    total_physical integer NOT NULL,
    sold_qty integer DEFAULT 0 NOT NULL,
    available_qty integer NOT NULL
);


ALTER TABLE catalog.inventory_snapshots OWNER TO postgres;

--
-- Name: items; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.items (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    sku text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    safety_stock_threshold integer DEFAULT 10 NOT NULL
);


ALTER TABLE catalog.items OWNER TO postgres;

--
-- Name: ledger_entries; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.ledger_entries (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    folio_id uuid NOT NULL,
    source_folio_id uuid,
    type text NOT NULL,
    amount numeric(12,2) NOT NULL,
    description text NOT NULL,
    idempotency_key text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.ledger_entries OWNER TO postgres;

--
-- Name: lost_and_found_items; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.lost_and_found_items (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    room_id uuid,
    description text NOT NULL,
    storage_bin text NOT NULL,
    status text DEFAULT 'reported'::text NOT NULL,
    finder_employee_id uuid NOT NULL,
    claimant_name text,
    claimed_at timestamp(3) without time zone
);


ALTER TABLE catalog.lost_and_found_items OWNER TO postgres;

--
-- Name: night_audit_checkpoints; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.night_audit_checkpoints (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    checkpoint_name text NOT NULL,
    completed_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.night_audit_checkpoints OWNER TO postgres;

--
-- Name: offline_sync_records; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.offline_sync_records (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    device_id text NOT NULL,
    action text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    error_log text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.offline_sync_records OWNER TO postgres;

--
-- Name: outbox; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.outbox (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    aggregate_type text NOT NULL,
    aggregate_id text NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    processed boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.outbox OWNER TO postgres;

--
-- Name: parking_slots; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.parking_slots (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    slot_identifier text NOT NULL,
    status text DEFAULT 'vacant'::text NOT NULL
);


ALTER TABLE catalog.parking_slots OWNER TO postgres;

--
-- Name: property_dates; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.property_dates (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    business_date date NOT NULL,
    status text DEFAULT 'open'::text NOT NULL
);


ALTER TABLE catalog.property_dates OWNER TO postgres;

--
-- Name: role_permissions; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.role_permissions (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    role_id uuid NOT NULL,
    resource text NOT NULL,
    action text NOT NULL
);

ALTER TABLE ONLY catalog.role_permissions FORCE ROW LEVEL SECURITY;


ALTER TABLE catalog.role_permissions OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.roles (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text
);


ALTER TABLE catalog.roles OWNER TO postgres;

--
-- Name: room_types; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.room_types (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    rack_rate numeric(12,2) NOT NULL,
    max_occupancy integer DEFAULT 2 NOT NULL,
    cleaning_duration_minutes integer DEFAULT 30 NOT NULL
);


ALTER TABLE catalog.room_types OWNER TO postgres;

--
-- Name: rooms; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.rooms (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    floor_id uuid NOT NULL,
    room_type_id uuid NOT NULL,
    room_number text NOT NULL,
    physical_status text DEFAULT 'clean'::text NOT NULL,
    occupancy_status text DEFAULT 'vacant'::text NOT NULL
);


ALTER TABLE catalog.rooms OWNER TO postgres;

--
-- Name: stock_levels; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.stock_levels (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    inventory_location_id uuid NOT NULL,
    item_id uuid NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.stock_levels OWNER TO postgres;

--
-- Name: tenants; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.tenants (
    id uuid NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.tenants OWNER TO postgres;

--
-- Name: valet_tickets; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.valet_tickets (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    vehicle_license text NOT NULL,
    key_tag text NOT NULL,
    parking_slot_id uuid,
    status text DEFAULT 'parked'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE catalog.valet_tickets OWNER TO postgres;

--
-- Name: visitor_records; Type: TABLE; Schema: catalog; Owner: postgres
--

CREATE TABLE catalog.visitor_records (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    id_hash text NOT NULL,
    check_in_time timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    check_out_time timestamp(3) without time zone
);


ALTER TABLE catalog.visitor_records OWNER TO postgres;

--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: billing_routing_rules billing_routing_rules_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.billing_routing_rules
    ADD CONSTRAINT billing_routing_rules_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: branch_routes branch_routes_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.branch_routes
    ADD CONSTRAINT branch_routes_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: floors floors_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.floors
    ADD CONSTRAINT floors_pkey PRIMARY KEY (id);


--
-- Name: folios folios_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.folios
    ADD CONSTRAINT folios_pkey PRIMARY KEY (id);


--
-- Name: guests guests_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.guests
    ADD CONSTRAINT guests_pkey PRIMARY KEY (id);


--
-- Name: incident_logs incident_logs_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.incident_logs
    ADD CONSTRAINT incident_logs_pkey PRIMARY KEY (id);


--
-- Name: inventory_locations inventory_locations_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.inventory_locations
    ADD CONSTRAINT inventory_locations_pkey PRIMARY KEY (id);


--
-- Name: inventory_snapshots inventory_snapshots_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.inventory_snapshots
    ADD CONSTRAINT inventory_snapshots_pkey PRIMARY KEY (id);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: ledger_entries ledger_entries_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.ledger_entries
    ADD CONSTRAINT ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: lost_and_found_items lost_and_found_items_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.lost_and_found_items
    ADD CONSTRAINT lost_and_found_items_pkey PRIMARY KEY (id);


--
-- Name: night_audit_checkpoints night_audit_checkpoints_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.night_audit_checkpoints
    ADD CONSTRAINT night_audit_checkpoints_pkey PRIMARY KEY (id);


--
-- Name: offline_sync_records offline_sync_records_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.offline_sync_records
    ADD CONSTRAINT offline_sync_records_pkey PRIMARY KEY (id);


--
-- Name: outbox outbox_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.outbox
    ADD CONSTRAINT outbox_pkey PRIMARY KEY (id);


--
-- Name: parking_slots parking_slots_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.parking_slots
    ADD CONSTRAINT parking_slots_pkey PRIMARY KEY (id);


--
-- Name: property_dates property_dates_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.property_dates
    ADD CONSTRAINT property_dates_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: room_types room_types_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.room_types
    ADD CONSTRAINT room_types_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: stock_levels stock_levels_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.stock_levels
    ADD CONSTRAINT stock_levels_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: valet_tickets valet_tickets_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.valet_tickets
    ADD CONSTRAINT valet_tickets_pkey PRIMARY KEY (id);


--
-- Name: visitor_records visitor_records_pkey; Type: CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.visitor_records
    ADD CONSTRAINT visitor_records_pkey PRIMARY KEY (id);


--
-- Name: billing_routing_rules_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX billing_routing_rules_tenant_id_idx ON catalog.billing_routing_rules USING btree (tenant_id);


--
-- Name: bookings_tenant_id_check_in_date_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX bookings_tenant_id_check_in_date_idx ON catalog.bookings USING btree (tenant_id, check_in_date);


--
-- Name: bookings_tenant_id_status_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX bookings_tenant_id_status_idx ON catalog.bookings USING btree (tenant_id, status);


--
-- Name: branch_routes_domain_key; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE UNIQUE INDEX branch_routes_domain_key ON catalog.branch_routes USING btree (domain);


--
-- Name: branches_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX branches_tenant_id_idx ON catalog.branches USING btree (tenant_id);


--
-- Name: employees_email_key; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE UNIQUE INDEX employees_email_key ON catalog.employees USING btree (email);


--
-- Name: employees_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX employees_tenant_id_idx ON catalog.employees USING btree (tenant_id);


--
-- Name: floors_tenant_id_branch_id_floor_number_key; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE UNIQUE INDEX floors_tenant_id_branch_id_floor_number_key ON catalog.floors USING btree (tenant_id, branch_id, floor_number);


--
-- Name: floors_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX floors_tenant_id_idx ON catalog.floors USING btree (tenant_id);


--
-- Name: folios_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX folios_tenant_id_idx ON catalog.folios USING btree (tenant_id);


--
-- Name: guests_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX guests_tenant_id_idx ON catalog.guests USING btree (tenant_id);


--
-- Name: idx_audit_logs_lookup; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX idx_audit_logs_lookup ON catalog.audit_logs USING btree (tenant_id, entity_name, entity_id);


--
-- Name: idx_bookings_lookup; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX idx_bookings_lookup ON catalog.bookings USING btree (tenant_id, branch_id, check_in_date, status);


--
-- Name: idx_ledger_entries_lookup; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX idx_ledger_entries_lookup ON catalog.ledger_entries USING btree (tenant_id, folio_id, created_at);


--
-- Name: incident_logs_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX incident_logs_tenant_id_idx ON catalog.incident_logs USING btree (tenant_id);


--
-- Name: inventory_locations_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX inventory_locations_tenant_id_idx ON catalog.inventory_locations USING btree (tenant_id);


--
-- Name: inventory_snapshots_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX inventory_snapshots_tenant_id_idx ON catalog.inventory_snapshots USING btree (tenant_id);


--
-- Name: inventory_snapshots_tenant_id_room_type_id_snapshot_date_key; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE UNIQUE INDEX inventory_snapshots_tenant_id_room_type_id_snapshot_date_key ON catalog.inventory_snapshots USING btree (tenant_id, room_type_id, snapshot_date);


--
-- Name: inventory_snapshots_tenant_id_snapshot_date_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX inventory_snapshots_tenant_id_snapshot_date_idx ON catalog.inventory_snapshots USING btree (tenant_id, snapshot_date);


--
-- Name: items_sku_key; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE UNIQUE INDEX items_sku_key ON catalog.items USING btree (sku);


--
-- Name: items_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX items_tenant_id_idx ON catalog.items USING btree (tenant_id);


--
-- Name: ledger_entries_idempotency_key_key; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE UNIQUE INDEX ledger_entries_idempotency_key_key ON catalog.ledger_entries USING btree (idempotency_key);


--
-- Name: ledger_entries_tenant_id_created_at_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX ledger_entries_tenant_id_created_at_idx ON catalog.ledger_entries USING btree (tenant_id, created_at);


--
-- Name: lost_and_found_items_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX lost_and_found_items_tenant_id_idx ON catalog.lost_and_found_items USING btree (tenant_id);


--
-- Name: night_audit_checkpoints_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX night_audit_checkpoints_tenant_id_idx ON catalog.night_audit_checkpoints USING btree (tenant_id);


--
-- Name: offline_sync_records_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX offline_sync_records_tenant_id_idx ON catalog.offline_sync_records USING btree (tenant_id);


--
-- Name: outbox_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX outbox_tenant_id_idx ON catalog.outbox USING btree (tenant_id);


--
-- Name: parking_slots_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX parking_slots_tenant_id_idx ON catalog.parking_slots USING btree (tenant_id);


--
-- Name: property_dates_branch_id_key; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE UNIQUE INDEX property_dates_branch_id_key ON catalog.property_dates USING btree (branch_id);


--
-- Name: property_dates_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX property_dates_tenant_id_idx ON catalog.property_dates USING btree (tenant_id);


--
-- Name: role_permissions_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX role_permissions_tenant_id_idx ON catalog.role_permissions USING btree (tenant_id);


--
-- Name: role_permissions_tenant_id_role_id_resource_action_key; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE UNIQUE INDEX role_permissions_tenant_id_role_id_resource_action_key ON catalog.role_permissions USING btree (tenant_id, role_id, resource, action);


--
-- Name: roles_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX roles_tenant_id_idx ON catalog.roles USING btree (tenant_id);


--
-- Name: roles_tenant_id_name_key; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE UNIQUE INDEX roles_tenant_id_name_key ON catalog.roles USING btree (tenant_id, name);


--
-- Name: room_types_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX room_types_tenant_id_idx ON catalog.room_types USING btree (tenant_id);


--
-- Name: rooms_tenant_id_branch_id_room_number_key; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE UNIQUE INDEX rooms_tenant_id_branch_id_room_number_key ON catalog.rooms USING btree (tenant_id, branch_id, room_number);


--
-- Name: rooms_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX rooms_tenant_id_idx ON catalog.rooms USING btree (tenant_id);


--
-- Name: rooms_tenant_id_physical_status_occupancy_status_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX rooms_tenant_id_physical_status_occupancy_status_idx ON catalog.rooms USING btree (tenant_id, physical_status, occupancy_status);


--
-- Name: rooms_tenant_id_room_type_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX rooms_tenant_id_room_type_id_idx ON catalog.rooms USING btree (tenant_id, room_type_id);


--
-- Name: stock_levels_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX stock_levels_tenant_id_idx ON catalog.stock_levels USING btree (tenant_id);


--
-- Name: stock_levels_tenant_id_inventory_location_id_item_id_key; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE UNIQUE INDEX stock_levels_tenant_id_inventory_location_id_item_id_key ON catalog.stock_levels USING btree (tenant_id, inventory_location_id, item_id);


--
-- Name: valet_tickets_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX valet_tickets_tenant_id_idx ON catalog.valet_tickets USING btree (tenant_id);


--
-- Name: visitor_records_tenant_id_idx; Type: INDEX; Schema: catalog; Owner: postgres
--

CREATE INDEX visitor_records_tenant_id_idx ON catalog.visitor_records USING btree (tenant_id);


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES catalog.employees(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: billing_routing_rules billing_routing_rules_booking_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.billing_routing_rules
    ADD CONSTRAINT billing_routing_rules_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES catalog.bookings(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: billing_routing_rules billing_routing_rules_target_folio_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.billing_routing_rules
    ADD CONSTRAINT billing_routing_rules_target_folio_id_fkey FOREIGN KEY (target_folio_id) REFERENCES catalog.folios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: bookings bookings_branch_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.bookings
    ADD CONSTRAINT bookings_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES catalog.branches(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bookings bookings_guest_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.bookings
    ADD CONSTRAINT bookings_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES catalog.guests(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bookings bookings_room_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.bookings
    ADD CONSTRAINT bookings_room_id_fkey FOREIGN KEY (room_id) REFERENCES catalog.rooms(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: branch_routes branch_routes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.branch_routes
    ADD CONSTRAINT branch_routes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES catalog.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: employees employees_branch_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.employees
    ADD CONSTRAINT employees_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES catalog.branches(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: employees employees_role_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.employees
    ADD CONSTRAINT employees_role_id_fkey FOREIGN KEY (role_id) REFERENCES catalog.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: floors floors_branch_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.floors
    ADD CONSTRAINT floors_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES catalog.branches(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: folios folios_booking_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.folios
    ADD CONSTRAINT folios_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES catalog.bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: folios folios_parent_folio_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.folios
    ADD CONSTRAINT folios_parent_folio_id_fkey FOREIGN KEY (parent_folio_id) REFERENCES catalog.folios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: folios folios_payer_guest_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.folios
    ADD CONSTRAINT folios_payer_guest_id_fkey FOREIGN KEY (payer_guest_id) REFERENCES catalog.guests(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: incident_logs incident_logs_branch_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.incident_logs
    ADD CONSTRAINT incident_logs_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES catalog.branches(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: incident_logs incident_logs_logged_by_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.incident_logs
    ADD CONSTRAINT incident_logs_logged_by_id_fkey FOREIGN KEY (logged_by_id) REFERENCES catalog.employees(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_locations inventory_locations_branch_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.inventory_locations
    ADD CONSTRAINT inventory_locations_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES catalog.branches(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_snapshots inventory_snapshots_room_type_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.inventory_snapshots
    ADD CONSTRAINT inventory_snapshots_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES catalog.room_types(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ledger_entries ledger_entries_folio_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.ledger_entries
    ADD CONSTRAINT ledger_entries_folio_id_fkey FOREIGN KEY (folio_id) REFERENCES catalog.folios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ledger_entries ledger_entries_source_folio_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.ledger_entries
    ADD CONSTRAINT ledger_entries_source_folio_id_fkey FOREIGN KEY (source_folio_id) REFERENCES catalog.folios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: lost_and_found_items lost_and_found_items_branch_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.lost_and_found_items
    ADD CONSTRAINT lost_and_found_items_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES catalog.branches(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: lost_and_found_items lost_and_found_items_finder_employee_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.lost_and_found_items
    ADD CONSTRAINT lost_and_found_items_finder_employee_id_fkey FOREIGN KEY (finder_employee_id) REFERENCES catalog.employees(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: lost_and_found_items lost_and_found_items_room_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.lost_and_found_items
    ADD CONSTRAINT lost_and_found_items_room_id_fkey FOREIGN KEY (room_id) REFERENCES catalog.rooms(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: night_audit_checkpoints night_audit_checkpoints_branch_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.night_audit_checkpoints
    ADD CONSTRAINT night_audit_checkpoints_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES catalog.branches(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: offline_sync_records offline_sync_records_branch_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.offline_sync_records
    ADD CONSTRAINT offline_sync_records_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES catalog.branches(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: parking_slots parking_slots_branch_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.parking_slots
    ADD CONSTRAINT parking_slots_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES catalog.branches(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: property_dates property_dates_branch_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.property_dates
    ADD CONSTRAINT property_dates_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES catalog.branches(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES catalog.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: room_types room_types_branch_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.room_types
    ADD CONSTRAINT room_types_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES catalog.branches(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: rooms rooms_branch_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.rooms
    ADD CONSTRAINT rooms_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES catalog.branches(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: rooms rooms_floor_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.rooms
    ADD CONSTRAINT rooms_floor_id_fkey FOREIGN KEY (floor_id) REFERENCES catalog.floors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: rooms rooms_room_type_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.rooms
    ADD CONSTRAINT rooms_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES catalog.room_types(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_levels stock_levels_inventory_location_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.stock_levels
    ADD CONSTRAINT stock_levels_inventory_location_id_fkey FOREIGN KEY (inventory_location_id) REFERENCES catalog.inventory_locations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_levels stock_levels_item_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.stock_levels
    ADD CONSTRAINT stock_levels_item_id_fkey FOREIGN KEY (item_id) REFERENCES catalog.items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: valet_tickets valet_tickets_booking_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.valet_tickets
    ADD CONSTRAINT valet_tickets_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES catalog.bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: valet_tickets valet_tickets_parking_slot_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.valet_tickets
    ADD CONSTRAINT valet_tickets_parking_slot_id_fkey FOREIGN KEY (parking_slot_id) REFERENCES catalog.parking_slots(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: visitor_records visitor_records_booking_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: postgres
--

ALTER TABLE ONLY catalog.visitor_records
    ADD CONSTRAINT visitor_records_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES catalog.bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: employees test_emp_rls; Type: POLICY; Schema: catalog; Owner: postgres
--

CREATE POLICY test_emp_rls ON catalog.employees USING ((tenant_id = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid));


--
-- Name: role_permissions test_perm_rls; Type: POLICY; Schema: catalog; Owner: postgres
--

CREATE POLICY test_perm_rls ON catalog.role_permissions USING ((tenant_id = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid));


--
-- Name: employees test_rls; Type: POLICY; Schema: catalog; Owner: postgres
--

CREATE POLICY test_rls ON catalog.employees USING ((tenant_id = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid));


--
-- Name: SCHEMA catalog; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA catalog TO hos_app_user;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.audit_logs TO hos_app_user;


--
-- Name: TABLE billing_routing_rules; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.billing_routing_rules TO hos_app_user;


--
-- Name: TABLE bookings; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.bookings TO hos_app_user;


--
-- Name: TABLE branch_routes; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.branch_routes TO hos_app_user;


--
-- Name: TABLE branches; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.branches TO hos_app_user;


--
-- Name: TABLE employees; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.employees TO hos_app_user;


--
-- Name: TABLE floors; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.floors TO hos_app_user;


--
-- Name: TABLE folios; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.folios TO hos_app_user;


--
-- Name: TABLE guests; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.guests TO hos_app_user;


--
-- Name: TABLE incident_logs; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.incident_logs TO hos_app_user;


--
-- Name: TABLE inventory_locations; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.inventory_locations TO hos_app_user;


--
-- Name: TABLE inventory_snapshots; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.inventory_snapshots TO hos_app_user;


--
-- Name: TABLE items; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.items TO hos_app_user;


--
-- Name: TABLE ledger_entries; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.ledger_entries TO hos_app_user;


--
-- Name: TABLE lost_and_found_items; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.lost_and_found_items TO hos_app_user;


--
-- Name: TABLE night_audit_checkpoints; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.night_audit_checkpoints TO hos_app_user;


--
-- Name: TABLE offline_sync_records; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.offline_sync_records TO hos_app_user;


--
-- Name: TABLE outbox; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.outbox TO hos_app_user;


--
-- Name: TABLE parking_slots; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.parking_slots TO hos_app_user;


--
-- Name: TABLE property_dates; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.property_dates TO hos_app_user;


--
-- Name: TABLE role_permissions; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.role_permissions TO hos_app_user;


--
-- Name: TABLE roles; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.roles TO hos_app_user;


--
-- Name: TABLE room_types; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.room_types TO hos_app_user;


--
-- Name: TABLE rooms; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.rooms TO hos_app_user;


--
-- Name: TABLE stock_levels; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.stock_levels TO hos_app_user;


--
-- Name: TABLE tenants; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.tenants TO hos_app_user;


--
-- Name: TABLE valet_tickets; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.valet_tickets TO hos_app_user;


--
-- Name: TABLE visitor_records; Type: ACL; Schema: catalog; Owner: postgres
--

GRANT ALL ON TABLE catalog.visitor_records TO hos_app_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: catalog; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA catalog GRANT ALL ON SEQUENCES  TO hos_app_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: catalog; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA catalog GRANT ALL ON TABLES  TO hos_app_user;


--
-- PostgreSQL database dump complete
--

