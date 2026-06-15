-- Add missing tables to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE threads, explores, people, locations;
