CREATE OR REPLACE FUNCTION remove_linked_person()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE items
    SET linked_people_ids = array_remove(linked_people_ids, OLD.id)
    WHERE OLD.id = ANY(linked_people_ids);
  UPDATE threads
    SET linked_people_ids = array_remove(linked_people_ids, OLD.id)
    WHERE OLD.id = ANY(linked_people_ids);
  RETURN OLD;
END;
$$;
