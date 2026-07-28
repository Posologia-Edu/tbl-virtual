-- Follow-up hardening for the medium/low findings from the security review:
-- 1. question-media storage bucket: upload was open to ANY authenticated user
--    (student or teacher) despite the policy name "Teachers upload question-media" —
--    only the per-user folder path was checked, not the role. Restrict to
--    teachers/admins and cap file size / mime types.
-- 2. hub-metrics: shared secret was accepted via ?key= query string (logged by
--    proxies/browsers); require it in a header instead, compared in constant time.

-- === question-media bucket ===
UPDATE storage.buckets
SET file_size_limit = 10485760, -- 10 MB
    allowed_mime_types = ARRAY['image/png','image/jpeg','image/gif','image/webp']
WHERE id = 'question-media';

DROP POLICY IF EXISTS "Teachers upload question-media" ON storage.objects;
CREATE POLICY "Teachers upload question-media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'question-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (public.has_role(auth.uid(), 'teacher'::app_role) OR public.is_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "Teachers update own question-media" ON storage.objects;
CREATE POLICY "Teachers update own question-media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'question-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (public.has_role(auth.uid(), 'teacher'::app_role) OR public.is_admin(auth.uid()))
  );
