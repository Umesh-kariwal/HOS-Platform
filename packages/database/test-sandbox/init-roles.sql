-- Create a non-superuser role for testing RLS enforcement
DROP ROLE IF EXISTS hos_app_user;
CREATE ROLE hos_app_user WITH LOGIN PASSWORD 'SecurePassword123';

-- Grant privileges on the schema and tables
GRANT CONNECT ON DATABASE hos_catalog TO hos_app_user;
GRANT USAGE ON SCHEMA catalog TO hos_app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA catalog TO hos_app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA catalog TO hos_app_user;

-- Ensure privileges apply to future tables as well
ALTER DEFAULT PRIVILEGES IN SCHEMA catalog GRANT ALL ON TABLES TO hos_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA catalog GRANT ALL ON SEQUENCES TO hos_app_user;
