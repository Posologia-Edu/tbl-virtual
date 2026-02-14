
-- Add FK from room_participants.user_id to profiles.id for PostgREST joins
ALTER TABLE public.room_participants
  ADD CONSTRAINT room_participants_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
