-- Phase 9: per-account sidebar customization.
-- Lets an Owner/Admin (or any account) hide top-level nav sections they personally don't use
-- (e.g. an Owner who never touches POS). This is a personal display preference only -- it does
-- NOT change what that account is actually allowed to access (see utils/permissions.js canAccess).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS hidden_nav_sections JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.users.hidden_nav_sections IS 'Top-level Navbar section labels this account has hidden from their own sidebar (display preference only).';
