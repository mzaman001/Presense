-- Rename pomodoros_count to time_spent_minutes
ALTER TABLE items RENAME COLUMN pomodoros_count TO time_spent_minutes;

-- Drop the old trigger and function
DROP TRIGGER IF EXISTS on_session_log_inserted ON session_logs;
DROP FUNCTION IF EXISTS increment_pomodoro_count;

-- Create the new function to accumulate time
CREATE OR REPLACE FUNCTION increment_time_spent()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.task_id IS NOT NULL AND NEW.type = 'work' THEN
    UPDATE items 
    SET time_spent_minutes = COALESCE(time_spent_minutes, 0) + NEW.duration_minutes
    WHERE id = NEW.task_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER on_session_log_inserted_time
AFTER INSERT ON session_logs
FOR EACH ROW
EXECUTE FUNCTION increment_time_spent();
