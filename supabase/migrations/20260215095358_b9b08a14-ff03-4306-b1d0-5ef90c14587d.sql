
-- Add admin to app_role enum (must be separate transaction)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
