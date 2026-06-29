-- Add last_evening_ritual_date and ritual_streak to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS last_evening_ritual_date TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS ritual_streak INTEGER DEFAULT 0;

-- Create ritual_logs table for tracking history (Option B from plan)
CREATE TABLE IF NOT EXISTS ritual_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ritual_type TEXT NOT NULL CHECK (ritual_type IN ('morning', 'evening')),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for ritual_logs
ALTER TABLE ritual_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for ritual_logs
CREATE POLICY "Users can manage their own ritual logs"
    ON ritual_logs
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
