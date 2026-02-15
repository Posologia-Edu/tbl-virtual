
-- Add trat_started_at to teams so we can sync timer across all members
ALTER TABLE public.teams ADD COLUMN trat_started_at timestamptz DEFAULT NULL;

-- Allow team members to update their team (for setting trat_started_at)
CREATE POLICY "Team members can update own team"
ON public.teams FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM team_members 
  WHERE team_members.team_id = teams.id 
  AND team_members.user_id = auth.uid()
));
