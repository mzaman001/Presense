-- Fix: users who completed onboarding before onboarding_complete column
-- was added got defaulted to false. Set to true for anyone with a display_name.

UPDATE user_settings
SET onboarding_complete = true
WHERE onboarding_complete = false
  AND display_name IS NOT NULL
  AND display_name != '';
