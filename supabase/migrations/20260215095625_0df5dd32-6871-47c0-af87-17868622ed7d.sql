
-- Set admin role for srfernandesaraujo@gmail.com
UPDATE public.user_roles SET role = 'admin' WHERE user_id = '18a18a77-d2e9-4abc-9bab-f6cc9fc51e73';

-- Approve admin and mark existing teachers as approved
UPDATE public.profiles SET is_approved = true WHERE id = '18a18a77-d2e9-4abc-9bab-f6cc9fc51e73';
