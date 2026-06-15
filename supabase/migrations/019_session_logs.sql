CREATE TABLE IF NOT EXISTS session_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  task_id uuid REFERENCES items(id),
  duration_minutes int NOT NULL,
  type text NOT NULL CHECK (type IN ('work', 'short_break', 'long_break')),
  completed_at timestamptz DEFAULT now()
);
