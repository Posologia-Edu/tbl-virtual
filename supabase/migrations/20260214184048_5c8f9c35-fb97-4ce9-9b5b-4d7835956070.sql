
-- Add quiz configuration columns to rooms
ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS max_grade NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS individual_pct INTEGER DEFAULT 70,
ADD COLUMN IF NOT EXISTS team_pct INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS show_answers_in_report BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_individual_in_team BOOLEAN DEFAULT false;

-- Make room code numeric (12 digits) instead of alphanumeric
CREATE OR REPLACE FUNCTION public.generate_room_code()
 RETURNS character
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  chars TEXT := '0123456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..11 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$function$;
