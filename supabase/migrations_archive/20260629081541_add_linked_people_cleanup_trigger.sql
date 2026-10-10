CREATE OR REPLACE FUNCTION remove_linked_person()
RETURNS TRIGGER AS $$
BEGIN
  -- Remove the person ID from items
  UPDATE items
  SET linked_people = array_remove(linked_people, OLD.id),
      linked_people_ids = array_remove(linked_people_ids, OLD.id)
  WHERE OLD.id = ANY(linked_people) OR OLD.id = ANY(linked_people_ids);

  -- Remove the person ID from threads
  UPDATE threads
  SET linked_people = array_remove(linked_people, OLD.id)
  WHERE OLD.id = ANY(linked_people);

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_remove_linked_person ON people;
CREATE TRIGGER trigger_remove_linked_person
AFTER DELETE ON people
FOR EACH ROW
EXECUTE FUNCTION remove_linked_person();
