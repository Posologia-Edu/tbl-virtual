ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.application_questions ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO storage.buckets (id, name, public)
VALUES ('question-media', 'question-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read question-media" ON storage.objects;
CREATE POLICY "Public read question-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'question-media');

DROP POLICY IF EXISTS "Teachers upload question-media" ON storage.objects;
CREATE POLICY "Teachers upload question-media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'question-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Teachers update own question-media" ON storage.objects;
CREATE POLICY "Teachers update own question-media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'question-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Teachers delete own question-media" ON storage.objects;
CREATE POLICY "Teachers delete own question-media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'question-media' AND (storage.foldername(name))[1] = auth.uid()::text);