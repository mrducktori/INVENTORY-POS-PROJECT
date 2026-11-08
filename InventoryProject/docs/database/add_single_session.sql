-- Single active session per account
-- Run this once in the Supabase SQL Editor BEFORE deploying the updated server.
-- Non-destructive: only adds a nullable column.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS current_session_id text;

COMMENT ON COLUMN public.users.current_session_id IS
  'ID of the only valid login session. A new login replaces it, which signs out the previous device.';
