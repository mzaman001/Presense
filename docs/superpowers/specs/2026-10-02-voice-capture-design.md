# Voice capture that understands speech: design

Date: 2026-10-02 · Status: approved 2026-10-02; plan in `docs/superpowers/plans/2026-10-02-voice-capture.md`

## Goal

Speaking a brain dump into Quick Capture or Mind Sweep should come out as the right
separate items, each with the right date, repeat, priority, duration and category. It has to
be instant, free, private by default, and add no bundle weight.

## Decisions taken

- **Rules first, no AI now.** Harden the deterministic, on-device pipeline. An AI fallback
  (a server route that sends low-confidence transcripts to a small model) is considered
  only if the test set below shows rules miss more than ~10% of spoken captures. That
  would be a separate spec.
- **Surfaces:** Quick Capture (`CaptureModal`) and Mind Sweep (`MindSweep`) only. These are
  the two places that already have a mic, and both are where many items get spoken at once.
- **Speech engine:** the browser's own speech recognition (Web Speech API). No cloud
  transcription service and no in-browser model.

## Why the current voice capture misses

1. **Several items become one.** `splitCapture` (`src/lib/capture-router.ts`) splits only on
   ". " followed by a capital letter, or on "also". Speech recognition rarely punctuates, so
   "buy milk call mom email john tomorrow" saves as one task.
2. **Spoken wording isn't understood.** "priority one", "hashtag work", "an hour and a half"
   and "next task" mean nothing to `parseTaskText`, which expects `p1`, `#work`, `90 min`
   and full stops.
3. **Duplicated words on Android.** `useSpeechCapture` adds finished results to `finalText`
   starting from `e.resultIndex`. In continuous mode, Android Chrome re-sends earlier
   finished results, so words repeat.
4. **Broken on an iPhone home-screen install.** Safari's speech recognition fails or locks up
   in standalone PWAs.
5. **Cloud by default.** Chrome sends audio to Google, even where Chrome 139+ can recognise
   speech on the device.

## Design

### 1. Pauses become punctuation you can see

The recogniser marks a result as finished at each natural pause. The hook will expose an
ordered list of **segments** (finished results plus the one still in progress) instead of one
flat string.

A new pure function, `joinSpokenSegments(segments, categories)`, turns the segments into
ordinary punctuated text:

- It **normalises** each segment (section 2).
- It joins segment *n+1* to segment *n* with `". "` and a capital letter when *n+1* starts an
  item (`TASK_VERB_RE`, a lead-in like "remind me to", or an explicit "next task") and *n*
  doesn't end unfinished (`INCOMPLETE_END`). Otherwise the join is a space.

The result goes into the text box exactly as today. Splitting stays in the existing
`routeCapture`. There is no hidden state: the user sees where the split will happen, and
editing the text edits the split. `capture-router.ts` needs no change beyond exporting
`TASK_VERB_RE`, `INCOMPLETE_END` and `LEAD_IN` for reuse.

### 2. Speech normaliser: `src/lib/nlp/spoken.ts`

This is a pure module, applied only to voice input and never to typed text.

| Spoken | Becomes | Rule |
|---|---|---|
| "priority one", "p one", "priority 1" … four | `p1` … `p4` | explicit marker only; "urgent" / "important" are **not** mapped |
| "hashtag X", "tag X" | `#X` | only when X matches one of the user's categories (case-insensitive) |
| "an hour and a half", "half an hour", "thirty minutes", "two hours" | `90 min`, `30 min`, `30 min`, `2h` | the estimate parser takes it from there |
| "next task", "next item", "new task", "full stop" | a segment boundary | removed from the title. Not "period": "the trial period ends friday" would split |
| "new line" | a segment boundary | removed |
| "and then" | a boundary only when the next words start an item | "wait and then decide" stays whole |
| "three thirty", "five o'clock" after at/by/until… | `3:30`, `5` | hours 1–12 only |
| "on the first of" | "on the 1st of" | only before "of", "every"/"each", or at the end |
| "p.m." / "a.m." | `pm` / `am` | otherwise the router won't split after "p.m." |

Dates and times stay with chrono and the existing `normaliseSpokenTimes`. Any gap the test
set exposes ("three thirty", "a.m." variants) gets fixed in `normaliseSpokenTimes`, not
duplicated here.

### 3. `useSpeechCapture` hardening

- **Rebuild from the full results list.** On every `result` event, walk `e.results` from 0,
  collecting finished segments and the one in progress. This fixes the Android duplicates and
  yields the segments for section 1.
  - The API changes from `onTranscript(text)` to `onSegments(segments: string[])`.
  - Callers keep their "append to what was typed" base text.
- **On-device when already installed.** Feature-detect `SpeechRecognition.available`. If
  `available({ langs: [lang], processLocally: true })` resolves `"available"`, set
  `processLocally = true`. Never call `install()` automatically, and never block start on
  this check (cache the answer per session).
- **Vocabulary hints.** If `phrases` exists, pass the user's category names as hint phrases.
  On a `phrases-not-supported` error, retry once without them.
- **Silence timeout.** Stop after 8 s with no new result. The user can always stop with the
  button or Escape.
- **iPhone home-screen app.** When running standalone on iOS, report `supported = false` so
  the mic button hides. The keyboard's dictation key (on-device, reliable) remains.
- **Unchanged:** errors map to `denied` / `no-speech` / `failed`; the mic is aborted on
  unmount; nothing is recorded or stored.

### 4. UX (Quick Capture, Mind Sweep)

- Quick Capture's live preview already shows routed items. The split items appear as the user
  speaks, and the user confirms, edits or drops them before saving. Nothing saves on its own.
- The listening state is shown by the existing button label and `aria-pressed`. No spoken
  `aria-live` announcement is added: a screen reader saying "Listening" would be heard by the
  mic and transcribed. A light haptic marks start, nothing marks stop.
- Mind Sweep keeps saving on Enter. Speaking several items then pressing Enter saves them as
  separate items (via `captureText` → `routeCapture`).

### 5. Not doing

In-browser speech models (Whisper/Moonshine: 40–250 MB, and Total Blocking Time is already
over budget), cloud speech-to-text, Firefox voice support, wake words, always-on listening,
reading tasks back aloud, editing by voice ("delete the last one"), storing audio, voice in
`TaskAddPanel` or the rituals, guessing priority from tone or words like "urgent".

## Units and interfaces

| Unit | Responsibility | Depends on |
|---|---|---|
| `src/lib/nlp/spoken.ts` | `normaliseSpoken(text, categories)`, `joinSpokenSegments(segments, categories)` | the exported regexes from `capture-router.ts` / `parse-task-text.ts` |
| `src/hooks/useSpeechCapture.ts` | mic lifecycle, segments, on-device choice, hints, timeout, iOS standalone gate | browser API only |
| `CaptureModal.tsx`, `MindSweep.tsx` | `base + joinSpokenSegments(segments, categories)` into the input | the two above |

## Test plan

- **Spoken regression set**: `src/lib/__tests__/fixtures/spoken-captures.ts`. Recogniser-style
  captures (lowercase, no punctuation, one string per pause), each with the expected items,
  run end to end through `joinSpokenSegments` → `routeCapture` with the clock pinned. Every
  case must pass. This guards known phrasings. It does not estimate accuracy, because a
  deterministic parser always passes cases written for it.
- **Real-speech accuracy**: 30 real brain dumps spoken on desktop Chrome, Android Chrome and
  iPhone Safari, at least 10 with several items. The target is at least 27 / 30 fully correct.
  Every miss becomes a regression case. A rate below 90% after one round of fixes is the
  evidence for the AI-fallback spec.
- **Unit tests**: `spoken.test.ts` covers every row of the section 2 table plus negatives
  ("urgent" stays text, "#unknown" stays text, "half" in "half the budget" untouched).
- **Hook tests** use a fake `SpeechRecognition`:
  - Android-style repeated finished results produce no duplicates.
  - `available()` → `processLocally` is set.
  - `phrases` failure → one retry without hints.
  - 8 s of silence stops.
  - iOS standalone → `supported` is false.
- **Existing suites stay green**: `CaptureModal.test.tsx`, `RitualSweep.test.tsx`,
  `capture-router.test.ts`, `parse-task-text.test.ts`.
- **Manual check** on desktop Chrome, Android Chrome and iOS Safari (tab, not installed):
  speak three items in one breath and confirm three chips with the right dates.
- **Gates**: lint, `tsc`, `npm test`, `npm run build`, plus a bundle check confirming no growth
  beyond a few KB on the capture chunk.
