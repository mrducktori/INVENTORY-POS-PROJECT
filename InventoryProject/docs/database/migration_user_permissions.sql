-- User page permissions & custom roles
-- Run in Supabase SQL Editor before deploying the Account Manager update.

ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions text[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_role_name text;

-- permissions: NULL = built-in access for the role (Staff default pages,
--              Admin/Owner full access, Supplier portal only).
-- custom_role_name: display name for role = 'Custom' (e.g. 'Finance').

-- If your users table has a CHECK constraint on role, allow 'Custom':
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
-- ALTER TABLE users ADD CONSTRAINT users_role_check
--   CHECK (role IN ('Owner', 'Admin', 'Staff', 'Supplier', 'Custom'));

