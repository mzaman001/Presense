PRESENSE BUILD PLAN
ACTIVE TASK: See Phase 1, first unchecked item.
HOW TO USE THIS FILE: Each task has a Done When section. You are not done until all criteria pass. When a task is complete, change [ ] to [x]. Do not start the next task without checking all criteria of the current one.

PHASE 1 — FOUNDATION (complete all of these before touching any new features)
[x] TASK 1.1 — Replace all native browser dialogs with ConfirmModal component
The problem: window.confirm() is being used for delete confirmations across the app (seen in Think thread deletion). This breaks the visual language and is platform-inconsistent.
What to build: A reusable React component at components/ui/ConfirmModal.tsx. It accepts these props: isOpen (boolean), title (string), description (string), confirmLabel (string, default "Confirm"), confirmVariant (string, either "danger" or "default"), onConfirm (function), onCancel (function). The modal is a centred glass card overlay with backdrop blur. The confirm button is red-tinted when confirmVariant is danger. The cancel button is a ghost button.
After building the component: Search the entire codebase for window.confirm, window.alert, and window.prompt. Replace every instance with the new ConfirmModal component. There should be zero instances remaining.
Done when:

File components/ui/ConfirmModal.tsx exists and renders correctly
grep -r "window.confirm" returns zero results
grep -r "window.alert" returns zero results
grep -r "window.prompt" returns zero results
Deleting a thread in Think opens the custom modal, not the browser dialog
The modal visually matches the app's glass card styling

[x] TASK 1.2 — Fix Settings save and persistence
The problem: Display name and Pomodoro duration reset to blank/default when the settings modal is closed and reopened. The Save button either does not call Supabase or the call fails silently.
What to do: Open the Settings component file. Read it in full before touching anything. Find where the Save button's onClick handler is. Verify it calls supabase.from('user_settings').upsert({user_id: currentUser.id, ...values}). If it does not, add this call. Add a toast.success('Settings saved') on success and toast.error('Failed to save') on failure. On component mount, fetch the current user_settings row and populate all fields from it.
Done when:

User types a display name, clicks Save, closes settings, reopens settings — the name is still there
User changes Pomodoro duration to 20, clicks Save, closes settings, reopens settings — it shows 20
A success toast appears after clicking Save
If Supabase returns an error, an error toast appears instead
Refreshing the page and reopening settings shows the last saved values

[x] TASK 1.3 — Fix Home dashboard showing 0 active tasks when tasks exist in Do
The problem: The Home page shows 0 Active Tasks in the bento grid and "All caught up!" in Up Next, even though the Do tab has active tasks including overdue ones.
What to do: Open the Home page component. Read the Supabase query that fetches task counts and the Up Next list. Run the equivalent query manually in the Supabase SQL editor to confirm it returns data. The query must be: SELECT * FROM items WHERE user_id = [current user id] AND status IN ('active', 'overdue') ORDER BY priority ASC, deadline ASC. Fix any mismatch between the query and what the UI expects. Add a realtime subscription on the items table that updates the count and list when any item changes.
Done when:

With 3 tasks in Do, the Home bento card shows Active Tasks: 3
With 1 overdue task, the Overdue count is visible and non-zero
The Up Next section shows the tasks ordered by urgency
Adding a new task in Do updates the Home count within 2 seconds without page refresh
Completing a task in Do reduces the Home count within 2 seconds without page refresh

[x] TASK 1.4 — Fix task completion blink/flash visual bug
The problem: When marking a task as done or pressing undo completion, the entire task list blinks or flashes in and out. This happens because local state and realtime subscription are conflicting.
What to do: Open the Do page task list component. Read how task completion is currently handled. Implement optimistic UI: when the user clicks complete, immediately update the task's status in local React state (do not wait for Supabase). Then call Supabase in the background. If Supabase returns an error, revert the local state to what it was before and show toast.error('Could not complete task, please try again'). Remove any code that causes the component to fully re-fetch the list on completion — use the realtime subscription for updates instead.
Done when:

Clicking the completion checkbox on a task — the task moves to completed state with no visible flash or blink
Clicking undo on the toast — the task returns to active state with no visible flash or blink
Network tab shows one Supabase PATCH call per completion, not a full list refetch
If the PATCH fails, the task reverts to its original position and an error toast appears

[x] TASK 1.5 — Fix realtime subscriptions in Think, Explore, and Remember spaces
The problem: Adding a thread in Think, saving an item in Explore, or adding a location requires a manual page refresh before it appears. The realtime subscriptions are either not set up or not wired to update state.
What to do: For each space separately (Think, then Explore, then Remember/People, then Remember/Locations): open the page component, check if a Supabase realtime channel subscription exists, if not create one using supabase.channel('channel-name').on('postgres_changes', {event: '*', schema: 'public', table: 'tablename', filter: 'user_id=eq.USERID'}, payload => { // update local state here }).subscribe(). The subscription callback must update the React state that drives the list render. Clean up the subscription in the component's useEffect cleanup function.
Done when:

In Think: add a new thread using the New Thread button — it appears in the list within 1 second without page refresh
In Think: add a new entry to an existing thread — it appears in the timeline within 1 second without page refresh
In Explore: save a new item — it appears in the feed within 1 second without page refresh
In Remember/People: add a person — they appear in the list within 1 second without page refresh
In Remember/Locations: add a location — it appears in the list within 1 second without page refresh

[x] TASK 1.6 — Fix snooze behaviour — implement snoozed_until logic
The problem: Pressing "Snooze until tomorrow" on the Home Focus Hero does something but it is unclear what. Tasks should disappear from the Focus Hero and Up Next for the rest of the day but remain visible in Do.
What to do: First, check if the items table has a snoozed_until column of type timestamptz. If not, add it via Supabase migration: ALTER TABLE items ADD COLUMN snoozed_until timestamptz. The Home page queries for the Focus Hero must add a filter: .or('snoozed_until.is.null,snoozed_until.lt.now()'). The Snooze button sets snoozed_until to tomorrow at the user's nudge_time from user_settings. The Do page does NOT filter by snoozed_until — snoozed tasks always appear in Do. On the snoozed task card in Do, show a small clock icon with the snooze time in text-3 colour (e.g. "Snoozed until tomorrow 10am") and a cancel snooze × button that sets snoozed_until back to null.
Done when:

The items table has a snoozed_until column of type timestamptz
Pressing Snooze on the Focus Hero makes that task disappear from the Focus Hero and Up Next immediately
The snoozed task still appears in the Do tab with a clock icon and snooze label
Pressing the × next to the snooze label on the Do task card cancels the snooze and the task reappears on Home

[x] TASK 1.7 — Fix "Add person" button showing in Locations sub-tab
The problem: In Remember, when the Locations tab is active, the "+ Add person" button still shows in the top-right corner.
What to do: In the Remember page component, find where the Add Person button is rendered. Wrap it in a conditional: only render it when the active sub-tab state is 'people', not 'locations'. When the Locations tab is active, render an "+ Add location" button instead that opens the Add Location form/drawer.
Done when:

In Remember with the People tab active: the top-right button says "+ Add person"
In Remember with the Locations tab active: the top-right button says "+ Add location"
Clicking "+ Add location" opens the location add form


PHASE 2 — CAPTURE REWORK
[x] TASK 2.1 — Replace the Space dropdown in capture with a custom click-to-open component
The problem: The native HTML select dropdown in the capture modal closes when hovering over options, making it impossible to select a space. The dropdown only shows Do and People, missing Think, Locations, Explore, and Inbox.
What to do: Build a custom Dropdown component at components/ui/Dropdown.tsx if it does not already exist. It must: open when the trigger button is clicked, show a list of options as styled items in a glass card panel, close when an option is clicked, close when the user clicks anywhere outside the component (use a useEffect with a document click listener), never open on hover. In the capture modal, replace the native select with this Dropdown component. The options list must be exactly: Do, Think, People (routes to Remember → People), Locations (routes to Remember → Locations), Explore, Inbox. Inbox is the default when nothing is selected or the router cannot classify.
Done when:

grep -r "<select" in the capture modal file returns zero results
The dropdown opens on click and stays open when hovering over options
All six options are listed: Do, Think, People, Locations, Explore, Inbox
Clicking an option selects it, updates the Space chip, and closes the dropdown
Clicking anywhere outside the dropdown closes it without selecting anything
The dropdown is styled with the app's glass card surface and border tokens

[x] TASK 2.2 — Fix NLP: strip date text from title and transfer to deadline field
The problem: Typing "tomorrow at 9pm Make bed" leaves the full text as the title and does not populate the deadline field. Users see the raw date text in the task title after saving.
What to do: In lib/capture-router.ts, after the router runs on input text: if a date is detected by compromise.js (doc.dates().json() returns a non-empty array), extract the date value, store it as the deadline, then remove the matched date phrase from the input string to produce the clean title. The cleaned title should be "Make bed" not "tomorrow at 9pm Make bed". The deadline chip in the capture modal must show the extracted date in plain English: "Tomorrow at 9:00 PM". When the capture is confirmed and saved as a task, the items row must have the clean title in the title column and the extracted timestamp in the deadline column.
Done when:

Typing "tomorrow at 9pm Make bed" produces a title chip showing "Make bed" and a deadline chip showing "Tomorrow 9:00 PM"
Typing "exam next Monday at 9pm" produces title chip "exam" and deadline chip "Next Monday 9:00 PM"
Saving the capture creates an item in Supabase with title = clean text and deadline = correct timestamp
The task card in Do shows the clean title, not the raw input with date text

[x] TASK 2.3 — Fix NLP: strip possessive pronouns from location item names
The problem: "My purse is in the jacket behind the door" extracts item name as "My" instead of "purse".
What to do: In lib/capture-router.ts in the location routing branch: after extracting the noun phrase that appears before the location keyword (is in, is at, put it, left it, placed, stored, kept), strip any leading possessive words from the extracted noun. The list of words to strip from the start: My, The, Our, His, Her, Their, A, An. The extraction logic should then check whether the remaining text starts with a capitalised common item word or a common noun. If after stripping the result is empty, fall back to asking the user to edit the item name chip before confirming. Show the result in an editable chip so the user can correct it before saving.
Done when:

"My purse is in the jacket behind the door" produces item chip "purse" and location chip "jacket behind the door"
"The charger is on the shelf" produces item chip "charger" and location chip "shelf"
"Keys are in my bag" produces item chip "Keys" and location chip "bag"
Both chips are editable before confirming save

[x] TASK 2.4 — Add recurring task NLP to capture router
The problem: Capture does not detect recurring patterns like "every day brush teeth" or "every Monday and Wednesday see Max".
What to do: In lib/capture-router.ts, add a recurrence detection step that runs before the main routing. Patterns to detect and their RRULE output:

"every day" or "daily" → FREQ=DAILY
"every week" or "weekly" → FREQ=WEEKLY
"every Monday" → FREQ=WEEKLY;BYDAY=MO
"every Monday and Wednesday" → FREQ=WEEKLY;BYDAY=MO,WE
"every Tuesday Wednesday Thursday" → FREQ=WEEKLY;BYDAY=TU,WE,TH
"every month" or "monthly" → FREQ=MONTHLY

If a recurrence pattern is detected: set the task's recurrence field to the RRULE string, show a recurrence chip in the capture modal with plain English text ("Every Monday & Wednesday"), and route to Do. The recurrence text is stripped from the title just like date text. If no recurrence pattern is found, the recurrence field remains null.
Done when:

"every day brush teeth" produces title chip "brush teeth", recurrence chip "Every day", space = Do
"every Monday and Wednesday see Max" produces title chip "see Max", recurrence chip "Every Mon & Wed", space = Do
Saving creates a task in Supabase with the correct RRULE in the recurrence column
The task card in Do shows a small ↻ icon with plain text label "Every Mon & Wed"


PHASE 3 — SETTINGS REBUILD
[ ] TASK 3.1 — Rebuild Settings with all required sections and auto-save
The problem: Settings currently shows only Display Name, Pomodoro Duration (raw number), Push Notifications toggle, Local AI Routing toggle, and Export Data. It is missing Appearance (themes), full Notifications section, Focus/Pomodoro section, Tasks section, and complete Account section including Delete Account.
What to do: Rebuild the Settings component as a full-page slide-over panel (not a small modal) with these sections in this order. Use section headers and dividers between each group. Implement auto-save per field using a debounced upsert: whenever a field value changes, wait 800ms, then call supabase.from('user_settings').upsert(). Show a subtle "Saved" text indicator next to the changed field for 2 seconds after save. Remove the global Save button entirely.
The sections and their fields:
ACCOUNT SECTION:

Display Name: text input, auto-saves after 800ms debounce
Email: read-only text, shown greyed out, no editing
Timezone: dropdown of IANA timezones, auto-detects from Intl.DateTimeFormat().resolvedOptions().timeZone on first load, saves on change
Sign Out: button that calls supabase.auth.signOut() and redirects to /login
Delete Account: red button labelled "Delete my account". Opens a ConfirmModal with title "Delete account?", description "All your data will be permanently deleted after 30 days. You will be signed out immediately. This cannot be undone.", and a text input where the user must type DELETE before the confirm button enables.

APPEARANCE SECTION:

Theme: three clickable colour swatch cards side by side. Swatch 1: Wahala (amber/orange circle swatch, label "Wahala", currently active indicator). Swatch 2: Deep Navy (blue circle swatch, label "Deep Navy"). Swatch 3: Forest (green circle swatch, label "Forest"). Clicking a swatch adds the corresponding class to the html element (theme-wahala / theme-navy / theme-forest) and saves to user_settings.theme.
Colour mode: three pill buttons: Dark, Light, System. Saves to user_settings.color_mode.
Ambient background: toggle. When off, removes the orb elements from the DOM via CSS class on html element.
Reduce motion: toggle. When on, adds class reduce-motion to html element.

NOTIFICATIONS SECTION:

Master toggle: Push notifications on/off. When turned off, greys out all sub-toggles.
Daily nudge: toggle + time picker. Default 10:00 AM.
Quiet hours: two time pickers (From and To). Default From 10:00 PM, To 8:00 AM.
Deadline reminders: toggle. Covers all escalation levels (72h, 24h, 6h, overdue).
People briefings: toggle. Fires 30 min before next_meeting.
Stale location alerts: toggle.

FOCUS / POMODORO SECTION:

Work duration: row of preset buttons, not a number input. Button options: 15 min, 20 min, 25 min (default, shows as selected), 30 min, 45 min, 60 min. Clicking a button selects it visually (amber background) and saves to user_settings.pomodoro_work_minutes.
Short break: preset buttons: 5 min (default), 10 min, 15 min.
Long break: preset buttons: 15 min (default), 20 min, 30 min.
Long break interval: dropdown: every 2 sessions, every 3 sessions, every 4 sessions (default), every 5 sessions.
Auto-start next session: toggle.
Sound on session end: toggle.

TASKS SECTION:

Default view: pill buttons: Board (default), Today, List.
Auto-archive completed tasks: dropdown: After 1 day, After 3 days, After 7 days (default), Never.
Show completed in main view: toggle, default off.
Custom categories: list of user-created categories with coloured dot, name, and a delete × button. At the bottom: an "+ Add category" button that expands an inline form with a text input for name and a row of 8 colour swatches to pick from. Saves to a categories table: id, user_id, name, color.

SMART ROUTING SECTION:

NLP date parsing: toggle, default on.
Routing confidence: pill buttons: High (auto-routes if very confident), Medium (default, shows chip for review), Low (always asks).
Enhanced routing via Ollama: toggle, default off. When on: shows a URL field (default http://localhost:11434) and a "Test connection" button. Clicking Test connection calls fetch(url + '/api/tags') and shows "Connected — model: [model name]" or "Not reachable".

DATA SECTION:

Export all data: button. Downloads a JSON file containing all the user's data from all tables.
Clear completed tasks: button with ConfirmModal. Sets status = 'archived' on all items where status = 'done'.
Clear stale locations: button with ConfirmModal. Deletes locations where updated_at < now() - interval '90 days'.

Done when:

All 6 sections exist in Settings with correct fields
Changing display name auto-saves within 2 seconds — confirmed by "Saved" indicator and by reopening settings
Changing Pomodoro work duration to 45 min auto-saves — reopening settings shows 45 min selected
Theme swatches are clickable and change the visible theme immediately
Delete account button opens a ConfirmModal with a type-DELETE input that must be filled before confirming
Timezone auto-detects correctly on first load
No global Save button exists anywhere in Settings


PHASE 4 — ONBOARDING REBUILD
[ ] TASK 4.1 — Rebuild onboarding with 5 screens that actually save data
The problem: Current onboarding screens are cosmetic — they do not save any data to user_settings. The progress bar is wrong. The questions do not personalise the app.
What to do: Create a new onboarding flow at app/(onboarding)/page.tsx that shows only when the user has no user_settings row (or when user_settings.onboarding_complete is false). The flow is a 5-screen sequence. Do not allow navigating to the main app until Screen 5 is completed or the tour is skipped. Each screen has a Back button (except Screen 1) and a Next/Continue button.
SCREEN 1 — Name:

Display: Large text "What should we call you?" with a single text input below. Placeholder: "Your first name". Next button. On Next: save input value to user_settings.display_name. If empty, show inline error "Please enter your name" and do not advance.
SCREEN 2 — Struggles:

Display: Text "What keeps slipping through the cracks?" Below: four tappable option cards in a 2×2 grid. Each card has an icon and label: (1) brain icon, "Things I need to do keep slipping" (2) users icon, "I forget what people told me" (3) lightbulb icon, "Ideas disappear before I capture them" (4) bookmark icon, "I save things but never come back to them". Cards highlight in amber when selected. Multiple selection allowed. At least one must be selected. On Next: save selected values as an array to user_settings.primary_struggles.
SCREEN 3 — Day shape:

Display: Text "When does your day usually start and end?" Two time picker inputs: "I'm usually up by" (default 07:00) and "I wind down around" (default 22:00). On Next: save wake time to user_settings.nudge_time (set to wake time + 30 minutes). Save wind down time to user_settings.quiet_hours_start. Set user_settings.quiet_hours_end to wake time. Auto-detect and save timezone from Intl.DateTimeFormat().resolvedOptions().timeZone.
SCREEN 4 — First capture:

Display: Text "Let's try it. What's one thing on your mind right now?" Large text area, auto-focused. Below the text area: as the user types, run the capture router and show the routing result as a chip (e.g. "→ This will go to Do"). A "Capture & continue" button. On click: save the item to the correct Supabase table using the routing result. Show a toast: "Saved to [Space name]". Then advance to Screen 5.
SCREEN 5 — Space tour:

A horizontally swipeable set of 5 cards. Each card fills the screen width. Progress dots at the bottom show position (1 of 5, 2 of 5, etc. — NOT dots for earlier screens, this is its own indicator). Cards in order:

Card 1 — Do: icon, "Your tasks, shown one step at a time. No overwhelm."

Card 2 — Think: icon, "Ongoing thoughts, plans, and a daily note. Your mind on paper."

Card 3 — Remember: icon, "What people told you. Where you left things. Never forget again."

Card 4 — Explore: icon, "Links, books, quotes, ideas. Saved and resurfaced every Sunday."

Card 5 — You're ready: large tick icon, "Presense is set up for you, [display_name]. Let's go." A "Start using Presense" button. On click: set user_settings.onboarding_complete = true. Redirect to the Home dashboard.
Also add a "Skip tour →" link on Screens 5 that goes directly to Home with onboarding_complete = true.
Done when:

A new user account has no user_settings row — they are redirected to onboarding before seeing any other page
Completing Screen 1 and checking user_settings in Supabase shows display_name saved
Completing Screen 3 and checking user_settings shows nudge_time set to 30 min after wake time
Screen 4 capture routes correctly and creates a row in the correct table
After completing Screen 5, the Home greeting shows "Good evening, [name]"
The tour progress dots on Screen 5 show 1–5, not mixing with the earlier screen progress
A user who has completed onboarding (onboarding_complete = true) is never shown onboarding again
Skipping the tour on Screen 5 still sets onboarding_complete = true


PHASE 5 — DO SPACE FIXES
[ ] TASK 5.1 — Fix Edit Task drawer layout — remove overlapping elements
The problem: The Edit Task drawer shows overlapping elements. The date pickers are colliding. The Save button overlaps with content. The EXACT date row creates visual confusion. The recurrence field shows raw RRULE text.
What to do: Rebuild the Edit Task drawer layout from scratch as a vertical form stack. The form must scroll internally. Use this exact field order and layout:
At the top: task title as a large editable heading input, underlined on focus, no box, just the text.
Below title: a two-column grid with Deadline on the left and Start Date on the right. Each cell has a label above and a date-time input below. The date-time input must use type="datetime-local" styled as a glass input, no raw format strings visible to the user. Remove the EXACT row entirely.
Below dates: Recurrence section. Label: "Repeats". A row of pill buttons: Does not repeat (default), Daily, Weekly, Monthly, Custom. When Weekly is selected: show a row of day toggle buttons: Mo Tu We Th Fr Sa Su. Each day highlights in amber when selected. When Custom is selected: show a text input pre-filled with the current RRULE if one exists. The UI generates and stores the RRULE string programmatically.
Below recurrence: Priority section. Label: "Priority". Four pill buttons: P1 (red, label "Urgent"), P2 (amber, label "High"), P3 (teal, label "Medium"), P4 (grey, label "Low"). Default is no priority selected.
Below priority: Category dropdown. Uses the custom Dropdown component. Lists all default categories plus user-created ones plus a "+ Add new category" option at the bottom.
Below category: First Step (optional) — text area with placeholder "What is the absolute smallest action to start this? (optional)"
Below first step: When will you start this? — text input with placeholder "e.g. At my desk after dinner / On the bus tomorrow morning (optional)"
Below that: Notes — text area, optional.
At the bottom: a sticky bar (position: sticky; bottom: 0) containing the Save Changes button (full width, amber gradient) and a Delete Task button (small, red text, no background) below it. The sticky bar has the same surface background as the modal so it looks clean as the user scrolls.
Done when:

No visual overlapping between any elements in the drawer at any viewport width
The date pickers show a clean date-time input, no raw format strings
The RRULE field is gone — replaced by the Repeats pill buttons and day toggles
The Save button is always visible without scrolling (sticky)
The form scrolls internally without the drawer growing taller than the viewport

[ ] TASK 5.2 — Make priority affect sort order and Focus Hero selection
The problem: Priority can be set on tasks but it has no visible effect on the task order in Do or on which task appears in the Focus Hero on Home.
What to do: In the Do page: the Supabase query that fetches tasks for each column must ORDER BY priority ASC NULLS LAST, deadline ASC. P1 = 1, P2 = 2, P3 = 3, P4 = 4. This means P1 tasks appear at the top of their column. On the Home page: the Focus Hero query must also consider priority — if there is a P1 task, it should appear in the hero even if a P2 task has an earlier deadline. The query should ORDER BY priority ASC NULLS LAST, deadline ASC LIMIT 1.
Done when:

In Do with tasks of mixed priorities, P1 tasks appear above P2 which appear above P3 within the same column
On Home, if there is a P1 task, it appears in the Focus Hero regardless of deadline
Changing a task's priority from P3 to P1 in the Edit drawer causes it to move up in the list without page refresh

[ ] TASK 5.3 — Replace RRULE text input with human-readable recurrence UI in Edit Task drawer
Covered by TASK 5.1 — the recurrence section rebuild is part of that task. Mark this as dependent on 5.1.
[ ] TASK 5.4 — Add Today view tab in Do space
The problem: With many tasks, the three-column board becomes overwhelming. A Today Only view is needed.
What to do: Add a view toggle at the top of the Do page with two options: "Board" and "Today". When Today is active, hide the three-column board and show a single vertical list of only tasks where deadline::date = CURRENT_DATE OR status = 'overdue', ordered by priority ASC, deadline ASC. Each task shows as a simpler row: priority flag colour, title, first step (if set), deadline time, and a completion checkbox. No columns. No urgency card colours. Clean and focused.
Done when:

A "Today" toggle button exists at the top of the Do page
Clicking Today shows only today's and overdue tasks in a single list
Clicking Board returns to the three-column board
The active view state persists in localStorage so it survives page refresh


PHASE 6 — REMEMBER (PEOPLE + LOCATIONS)
[ ] TASK 6.1 — Fix Add Person modal — make the button open a real panel
The problem: The "+ Add person" button is decorative and opens nothing.
What to do: Create a slide-in panel from the right (position: fixed, right 0, top 0, height 100vh, width 420px on desktop, full width on mobile) that opens when the "+ Add person" button is clicked. The panel contains: a close button (×) in the top right, a title "Add person", and these fields in order: Name (required, text input), Relationship (required, custom Dropdown with options: Friend, Family, Professor, Colleague, Teammate, Other), Avatar colour (a row of 6 colour swatches — amber, blue, teal, pink, green, purple), Next time seeing them (optional, datetime-local input), First note (optional, text area with placeholder "What do you want to remember about them?"). A "Save person" button at the bottom. On save: INSERT INTO people with all values, close the panel, show toast.success('Person added'), and the person appears in the list via realtime subscription.
Done when:

Clicking "+ Add person" opens the slide-in panel
All fields are present and correctly labelled
Saving with only Name and Relationship filled creates a people row in Supabase
The new person appears in the People list within 1 second without page refresh
toast.success appears after saving

[ ] TASK 6.2 — Add default colour coding by relationship type
The problem: People profiles do not have visual colour differentiation by relationship type.
What to do: Define a constant mapping in a shared file: RELATIONSHIP_COLORS = { Friend: '#E5B41E', Family: '#7692FF', Professor: '#2DD4BF', Colleague: '#8B7CF8', Teammate: '#4ADE80', Other: '#6B7280' }. In the People list component and Person detail component: use this mapping to determine the avatar background colour for each person. If the person has a custom colour set (stored in the color column), use that instead. The relationship type pill on each person's card should also use this colour.
Done when:

A person with relationship Friend shows an amber-coloured avatar
A person with relationship Family shows a blue-coloured avatar
A person with a custom colour set during Add Person shows that custom colour instead
The relationship type pill on each card matches the avatar colour

[ ] TASK 6.3 — Fix delete note from People
The problem: There is no way to delete a note from a person's note timeline.
What to do: In the person detail view, each note entry must have a ×/trash icon that appears on hover (or is always visible on mobile). Clicking it opens the ConfirmModal with title "Remove note?" and description "This cannot be undone." On confirm: remove that note object from the notes[] jsonb array. The update operation is: UPDATE people SET notes = notes - [index of the note] WHERE id = person_id. If Supabase does not support jsonb array element removal by index cleanly, read the notes array, filter out the target note by its created_at timestamp, and UPDATE with the filtered array. Show toast.success('Note removed') after.
Done when:

Hovering over a note entry shows a delete icon
Clicking the delete icon opens a ConfirmModal (not window.confirm)
Confirming removes the note from the timeline without page refresh
A success toast appears after deletion

[ ] TASK 6.4 — Fix delete person with type-name-to-confirm
The problem: No way to delete a person and all their notes.
What to do: In the person detail view, add a "Delete person" button at the bottom of the page styled in red. Clicking it opens a ConfirmModal with these additions: after the description, add a text input with placeholder "Type [person's name] to confirm". The confirm button is disabled until the text input value exactly matches the person's name (case-insensitive). On confirm: DELETE FROM people WHERE id = person_id. Navigate back to the People list. Show toast.success('[Name] deleted').
Done when:

A "Delete person" button exists at the bottom of the person detail page
Clicking it opens the ConfirmModal with the type-name input
The confirm button is disabled until the name is typed correctly
Confirming deletes the person row and navigates back to /remember/people
A success toast appears


PHASE 7 — EXPLORE FIXES
[ ] TASK 7.1 — Fix Save Item flow — replace capture-modal redirect with dedicated drawer
The problem: Clicking "Save item" in Explore redirects to the capture modal. The user cannot specify type (Book, Movie, etc.) or add proper tags there.
What to do: Create a slide-in panel at the right for adding Explore items directly. The panel has: a close button, a title "Save to Explore", and these fields in order: Title (required, text input), Type (required, custom Dropdown — options: Link, Quote, Concept, Book, Movie, Article, Course, Podcast, Other + a separator line and "+ Add custom type" at the bottom — clicking this opens a mini inline input to type a custom type name and press Enter to add it, storing in explore_types table), URL (optional, text input, shown when type is Link), Notes/Why I saved this (required text area with label "Why are you saving this?", placeholder "e.g. Fascinating idea from lecture / Riyaz recommended this book"), Tags (pill input: user types text and presses Enter or comma to add as a styled removable pill), Link to Think Thread (optional Dropdown listing all the user's current thread titles from the threads table). A "Save" button. After save: close the panel, show toast.success('Saved to Explore'), the item appears in feed via realtime.
Done when:

The "+ Save item" button in Explore opens the dedicated slide-in panel, NOT the capture modal
All fields are present and correctly labelled
The Type dropdown lists all default types plus any user-created custom types
"+ Add custom type" creates a new row in explore_types table and adds it to the dropdown
Tags work as pills — type text, press Enter or comma to add, × to remove
Saving creates an explores row in Supabase and the item appears in the feed within 1 second without page refresh

[ ] TASK 7.2 — Fix Explore edit page — auto-navigate after Save, fix layout
The problem: After pressing Save Changes in the Explore edit page, the user must manually press Back to Explore. Also the layout uses ugly native HTML selects and raw comma tags.
What to do: After a successful save in the Explore edit page, call router.push('/explore') (or router.back() if that navigates to the Explore list) automatically. No user action needed. Also apply the same field upgrades from Task 7.1: replace the native Type select with the custom Dropdown component, replace the Tags comma input with the pill tag input component.
Done when:

Editing an Explore item and pressing Save Changes automatically navigates back to the Explore feed
The Type field uses the custom Dropdown, not a native select
Tags use the pill input component

[ ] TASK 7.3 — Add Explore archive with trash view
The problem: Deleted items show a "30 day trash" message but there is no UI to view or manage the trash.
What to do: The explores table must have a status column (text, values: 'active', 'archived', 'deleted', default 'active') and a deleted_at column (timestamptz). The main Explore feed query must filter WHERE status = 'active'. Add a small text link at the top of Explore: "View archive" and another "View trash". Clicking "View archive" shows a list of items where status = 'archived' with a "Restore" button each (sets status back to 'active'). Clicking "View trash" shows items where status = 'deleted' with a "Restore" (sets to 'active') and "Delete permanently" button (hard deletes). Write a Supabase Edge Function named 'cleanup_trash' that runs on a cron schedule every 24 hours: DELETE FROM explores WHERE status = 'deleted' AND deleted_at < NOW() - INTERVAL '30 days'. Deploy and schedule the function.
Done when:

explores table has status and deleted_at columns
"View archive" link shows archived items with Restore button
"View trash" link shows deleted items with Restore and Delete permanently buttons
The Edge Function cleanup_trash exists in supabase/functions/ directory
Running the function manually from Supabase dashboard deletes items older than 30 days in trash


PHASE 8 — POMODORO FULL BUILD
[ ] TASK 8.1 — Build the full Pomodoro timer overlay
The problem: The current timer is just a number input in Settings. The actual timer functionality is not built.
What to do: Create a timer overlay component at components/features/PomodoroTimer.tsx. It renders as a full-screen overlay (z-index 50, dark semi-transparent backdrop, centred card). It accepts: taskId (string), taskTitle (string), onClose (function). Inside the overlay:
Header: the task title in 18px weight 500. Small "×" close button.
Session label: text showing current session type and count: "Work Session · 1 of 4" or "Short Break" or "Long Break". This updates as sessions progress.
Timer ring: an SVG circle (viewBox 200×200, circle with r 80). Two overlapping circles: a background circle (dark border) and a foreground circle with stroke matching --accent colour and stroke-dashoffset animation. The foreground circle's stroke-dashoffset starts at circumference (2 * π * 80 = 502.65) and decreases to 0 as time passes. In the centre: the remaining time in MM:SS format using JetBrains Mono font.
Below ring: three buttons: "Pause / Resume", "Skip", "End Session". Pause stops the interval. Resume restarts it. Skip immediately ends the current session and starts the next one. End Session closes the overlay after confirming with a ConfirmModal: "End this session? Progress will be saved."
Session logic: On work session end → auto-advance to short break (if auto-start setting is on) or show "Start your break?" prompt. After every N work sessions (from user_settings.pomodoro_long_break_interval, default 4) → go to long break instead of short break. After break ends → prompt to start next work session.
Session logging: When a session completes (reaches 0:00), INSERT a row into session_logs table: user_id, task_id, session_type ('work'/'short_break'/'long_break'), planned_minutes, completed_at = now(). This table must be created if it does not exist: CREATE TABLE session_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users NOT NULL, task_id uuid REFERENCES items(id), session_type text, planned_minutes int, completed_at timestamptz DEFAULT now()).
How to launch the timer: In the Do space task cards, add a small play button icon (▷) on each task card. Clicking it opens the PomodoroTimer overlay with that task's id and title. From the Focus Hero on Home, the "Start 10 min →" button should also open the PomodoroTimer (renaming the button to "Start session →").
Done when:

The session_logs table exists in Supabase
Clicking the play button on any task card in Do opens the PomodoroTimer overlay
The timer counts down from the work duration set in Settings
At 0:00 the session transitions to break (short break after sessions 1-3, long break after session 4)
A session_logs row is inserted for each completed session
Pause, Resume, and Skip buttons all work correctly
End Session shows a ConfirmModal and closes the overlay on confirm

[ ] TASK 8.2 — Show weekly stats on Home
The problem: No summary of Pomodoro sessions or completed tasks exists on the Home dashboard.
What to do: Add a "This week" row below the bento grid on Home. It shows two stats side by side: "Pomodoros this week: [count]" and "Tasks completed this week: [count]". The Pomodoro count is a count of session_logs rows where session_type = 'work' and completed_at >= start of current week (Monday 00:00). The tasks count is a count of items rows where status = 'done' and completed_at >= start of current week. Both queries must filter by user_id.
Done when:

The "This week" row exists on the Home dashboard below the bento grid
With 0 Pomodoro sessions logged, it shows "Pomodoros this week: 0"
After completing a Pomodoro session, the count updates within 2 seconds without page refresh
The completed tasks count matches the actual count of tasks marked done this week


PHASE 9 — HOME FIXES
[ ] TASK 9.1 — Make Up Next task cards clickable to open Edit Task drawer
The problem: Clicking a task card in the Up Next section of Home does nothing.
What to do: The task cards in the Up Next section must be clickable. Clicking a card opens the same Edit Task drawer component used in the Do space, pre-populated with that task's data. The drawer must work the same as in Do — all fields editable, Save changes updates the task, delete removes it. If the drawer does not already exist as a standalone component that can be imported, refactor the Do page's edit drawer into a standalone component at components/features/EditTaskDrawer.tsx and import it in both the Do page and the Home page.
Done when:

Clicking a task card in Up Next opens the EditTaskDrawer with that task's data filled in
Editing the task title and pressing Save changes the title on both the Home Up Next card and in the Do space
Marking the task as complete from Home removes it from Up Next without page refresh

[ ] TASK 9.2 — Add Focus Hero explanation label and Inbox section
The problem: The Focus Hero does not explain why a particular task was chosen. Unclassified captures have nowhere to surface.
What to do: Below the task title in the Focus Hero card, add a small label in text-3 colour that explains why this task was chosen. Logic: if the task is overdue → "Overdue since [date]". If the task is due within 3 hours → "Due in [X] hours". If the task has priority P1 → "Highest priority". If the task is simply the earliest deadline → "Due [date/time]". Show whichever reason is most urgent.
For the Inbox: add a section below Up Next on Home labelled "Inbox" with a small count badge. It shows only when the user has items in the items table where status = 'inbox' (or a separate inbox_items table — whichever the capture system uses for unclassified items). Each inbox item shows its text and two buttons: "Route it" (opens a space selector dropdown to send it to the right place) and "×" to dismiss.
Done when:

The Focus Hero shows a small label below the task title explaining the selection reason
An Inbox section appears on Home when there are unclassified captures
The Inbox section is hidden when the inbox is empty
Clicking "Route it" on an inbox item opens a space selector and moving it to a space removes it from the inbox


PHASE 10 — NAVIGATION AND SIDEBAR
[ ] TASK 10.1 — Fix collapsed sidebar icon layout
The problem: The collapsed sidebar (seen in screenshot 2) shows icons that are not visually polished — poor spacing, no active state, no tooltips, no visual separation from the expand arrow.
What to do: When the sidebar is collapsed (64px wide): each nav item renders as a centred 40px square with rounded corners. The icon is 20px and centred within it. The active item has an amber background at 15% opacity with the icon in --accent colour. Non-active items have the icon in text-3 colour and show text-2 on hover. Each icon item has a tooltip that appears on hover: a small pill to the right of the sidebar showing the space name in 12px text. The tooltip uses CSS positioning relative to the icon item — no JS required. The logo area in collapsed mode shows only the icon mark (the app's SVG icon), not the text. The collapse toggle button is a small chevron (‹) positioned at the right edge of the sidebar, vertically centred.
Done when:

In collapsed mode, all icons are vertically centred with equal spacing
The active icon has a visible amber highlight
Hovering over any icon shows a tooltip with the space name to the right
The logo area shows only the icon mark when collapsed
The expand button is a clear chevron at the right edge

[ ] TASK 10.2 — Move FAB capture to sidebar on desktop, keep as FAB on mobile
The problem: The floating capture button obscures content on desktop. On mobile it is appropriate, on desktop it should be elsewhere.
What to do: On screens wider than 768px: remove the floating FAB. Add a prominent Quick Capture button at the top of the sidebar, above the navigation items. It should be a full-width button with an amber gradient background, a + icon, and the label "Quick Capture". Also add a small keyboard shortcut hint below it: Cmd+K. On screens 768px and below: keep the floating circular FAB at the bottom centre of the screen (above the mobile bottom tab bar if one exists).
Done when:

On a desktop screen (>768px): no floating FAB is visible anywhere
A "Quick Capture" button is visible at the top of the sidebar
Clicking the sidebar button opens the capture modal
On a mobile screen (<768px): the floating FAB is visible and clicking it opens the capture modal
The sidebar capture button is hidden on mobile


PHASE 11 — THINK IMPROVEMENTS
[ ] TASK 11.1 — Add search and pin in Think space
The problem: With many threads the list becomes unsearchable. There is no way to pin important active threads to the top.
What to do: Add a search input at the top of the Think thread list panel. As the user types, filter the thread list to show only threads where the title contains the search text OR any entry text contains the search text. For pinning: add a pin icon button on each thread card (it appears on hover). Clicking pin toggles pinned: true on that thread's database row. Add a pinned boolean column to the threads table: ALTER TABLE threads ADD COLUMN pinned boolean DEFAULT false. Pinned threads always appear at the top of the list, above unpinned threads, sorted by last_updated. Non-pinned threads appear below in last_updated order. A maximum of 3 threads can be pinned — if the user tries to pin a 4th, show toast.error('You can pin up to 3 threads').
Done when:

Typing in the Think search input filters the thread list in real time
Clearing the search input shows all threads again
The pin button on each thread card toggles the pinned state
Pinned threads always appear at the top of the list
Attempting to pin a 4th thread shows an error toast


PHASE 12 — ICON AND THEMES
[ ] TASK 12.1 — Design and implement new app icon
The problem: The current app icon is the old design and does not match the orange/amber visual identity.
What to do: Create a new SVG icon at public/icon.svg. The icon concept: a dark rounded square background (#0F0A00). Inside: an abstract symbol made of two overlapping teardrop or loop shapes that together suggest both a brain and a flame. The shapes are filled with a linear gradient from #E5B41E (amber) to #EB4233 (coral-red), going top-left to bottom-right. The shapes should be simple enough to read at 16×16 pixels but interesting enough to stand out at 512×512. Use the SVG as the favicon. Also generate PNG exports at 192×192 and 512×512 for the web manifest. Update public/manifest.json: set name to "Presense", short_name to "Presense", theme_color to "#E5B41E", background_color to "#0F0A00", icons array to include all sizes. Update app/layout.tsx or the head metadata to reference the new icon files.
Done when:

public/icon.svg exists with the described design
The browser tab shows the new icon (check in Chrome)
public/manifest.json references the correct icon files
The favicon shows correctly at 16×16 and 32×32 in the browser tab

[ ] TASK 12.2 — Implement three-theme CSS variable system with light mode
The problem: Only the orange/amber theme is partially implemented. Deep Navy and Forest themes are missing. Light mode does not work.
What to do: In app/globals.css, define three theme classes and a light mode class. The html element gets one theme class and optionally the light class:
html.theme-wahala: the current amber/orange tokens (already set as defaults)

html.theme-navy: { --accent: #7692FF; --accent-hot: #1B2CC1; --accent-deep: #3D518C; --bg-base: #050B20; --surface: rgba(255,255,255,0.06); }

html.theme-forest: { --accent: #EFDD8D; --accent-hot: #65743A; --accent-deep: #394F49; --bg-base: #0D0F08; --surface: rgba(255,255,255,0.06); }
html.light: { --bg-base: #FFF8EE; --surface: rgba(0,0,0,0.04); --border: rgba(0,0,0,0.10); --text-1: #1A0A00; --text-2: rgba(26,10,0,0.65); --text-3: rgba(26,10,0,0.40); } (For navy light: --bg-base: #EEF3FF; for forest light: --bg-base: #F7FAF0)
Write a ThemeProvider component that reads theme and color_mode from user_settings on load and applies the correct classes to the html element before the first paint to prevent flash. The component also listens for changes to user_settings.theme and user_settings.color_mode and applies changes immediately. Each orb in the AmbientBackground component must use the current theme's accent colours (read from CSS variables or a theme config object).
Done when:

Selecting Deep Navy in Settings changes the app's colours to the blue palette immediately
Selecting Forest changes to the green/earth palette immediately
Selecting Light mode makes the background cream/light and text dark
Selecting System uses the OS dark/light preference
Refreshing the page maintains the selected theme (read from user_settings on load)
The ambient orbs change colour to match the active theme
