-- Add pomodoros_count to items
ALTER TABLE items ADD COLUMN IF NOT EXISTS pomodoros_count INT DEFAULT 0;

-- Function to increment pomodoros_count
CREATE OR REPLACE FUNCTION increment_pomodoro_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.task_id IS NOT NULL AND NEW.type = 'work' THEN
    UPDATE items 
    SET pomodoros_count = pomodoros_count + 1
    WHERE id = NEW.task_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run the function after a session log is inserted
DROP TRIGGER IF EXISTS on_session_log_inserted ON session_logs;
CREATE TRIGGER on_session_log_inserted
AFTER INSERT ON session_logs
FOR EACH ROW
EXECUTE FUNCTION increment_pomodoro_count();
