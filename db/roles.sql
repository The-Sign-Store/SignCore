-- Least-privilege login for the running app. Run once, connected as the database owner (neondb_owner).
-- The app can read and change rows but cannot create, alter or drop tables; schema changes come only from migrations in CI.
--
--   psql "$OWNER_URL" -v app_password="'<long random password>'" -f db/roles.sql
--
-- Neon refuses weak passwords for roles created in SQL, so use 30+ random characters.
CREATE ROLE signcore_app LOGIN PASSWORD :app_password;
GRANT CONNECT ON DATABASE :"DBNAME" TO signcore_app;
GRANT USAGE ON SCHEMA public TO signcore_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO signcore_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO signcore_app;
-- Tables and sequences added by later migrations (run by the owner) get the same rights automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO signcore_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO signcore_app;
-- The change history is append-only for the app.
REVOKE UPDATE, DELETE ON change_log FROM signcore_app;
