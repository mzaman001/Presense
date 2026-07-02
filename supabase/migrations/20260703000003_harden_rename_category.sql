CREATE OR REPLACE FUNCTION public.rename_category(
  p_categories_key text,
  p_colors_key text,
  p_old_category text,
  p_new_category text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF length(trim(p_old_category)) < 1 OR length(p_old_category) > 50 THEN
    RAISE EXCEPTION 'Invalid old category name';
  END IF;

  IF length(trim(p_new_category)) < 1 OR length(p_new_category) > 50 THEN
    RAISE EXCEPTION 'Invalid new category name';
  END IF;

  IF p_categories_key = 'do_categories' THEN
    UPDATE public.user_settings
    SET
      do_categories = array_replace(do_categories, p_old_category, p_new_category),
      do_category_colors = CASE
        WHEN do_category_colors ? p_old_category THEN
          (do_category_colors - p_old_category) || jsonb_build_object(p_new_category, do_category_colors->p_old_category)
        ELSE
          do_category_colors
      END
    WHERE user_id = v_user_id;

    UPDATE public.items
    SET category = p_new_category
    WHERE user_id = v_user_id
      AND category = p_old_category;

  ELSIF p_categories_key = 'people_categories' THEN
    UPDATE public.user_settings
    SET
      people_categories = array_replace(people_categories, p_old_category, p_new_category),
      relationship_colors = CASE
        WHEN relationship_colors ? p_old_category THEN
          (relationship_colors - p_old_category) || jsonb_build_object(p_new_category, relationship_colors->p_old_category)
        ELSE
          relationship_colors
      END
    WHERE user_id = v_user_id;

    UPDATE public.people
    SET relationship = p_new_category
    WHERE user_id = v_user_id
      AND relationship = p_old_category;

  ELSE
    RAISE EXCEPTION 'Invalid categories key: %', p_categories_key;
  END IF;
END;
$$;
