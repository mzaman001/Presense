import { z } from 'zod';

export const captureSchema = z.object({
  text: z.string().min(1).max(10_000),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const reorderSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    sort_order: z.number().int().min(0).max(100_000),
  })).min(1).max(200),
});

export const accountDeleteSchema = z.object({
  confirmToken: z.string().min(1).max(320),
});

export const locationSchema = z.object({
  itemName: z.string().min(1, "Name is required").max(200, "Name must be less than 200 characters"),
  locationText: z.string().min(1, "Location is required").max(500, "Location must be less than 500 characters"),
});

export const personSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  relationship: z.string().optional(),
  nextMeeting: z.string().datetime().optional().or(z.literal("")),
  notes: z.string().max(5000, "Notes must be less than 5000 characters").optional(),
});

export const taskSchema = z.object({
  title: z.string().min(1, "Title is required").max(500, "Title must be less than 500 characters"),
  category: z.string().optional(),
  priority: z.number().min(1).max(4).nullable().optional(),
  deadline: z.string().datetime().optional().or(z.literal("")),
  notes: z.string().max(5000, "Notes must be less than 5000 characters").optional(),
  first_step: z.string().max(500, "First step must be less than 500 characters").optional(),
});

export const settingsSchema = z.object({
  display_name: z.string().optional(),
  avatar_color: z.string().optional(),
  timezone: z.string().optional(),
  theme: z.string().optional(),
  color_mode: z.string().optional(),
  ambient_bg: z.boolean().optional(),
  reduce_motion: z.boolean().optional(),
  notifications_enabled: z.boolean().optional(),
  notif_overdue: z.boolean().optional(),
  notif_stale_threads: z.boolean().optional(),
  notif_morning: z.boolean().optional(),
  quiet_start: z.string().optional(),
  quiet_end: z.string().optional(),
  daily_briefing: z.boolean().optional(),
  pomodoro_sound: z.boolean().optional(),
  pomodoro_duration: z.number().optional(),
  short_break_duration: z.number().optional(),
  long_break_duration: z.number().optional(),
  auto_start_breaks: z.boolean().optional(),
  default_view: z.string().optional(),
  auto_archive_days: z.number().optional(),
  do_categories: z.array(z.string()).optional(),
  do_category_colors: z.record(z.string(), z.string()).optional(),
  people_categories: z.array(z.string()).optional(),
  relationship_colors: z.record(z.string(), z.string()).optional(),
  auto_snooze: z.boolean().optional(),
  smart_routing_enabled: z.boolean().optional(),
  nlp_date_parsing: z.boolean().optional(),
  routing_confidence: z.string().optional(),
  ollama_enabled: z.boolean().optional(),
  ollama_url: z.string().optional(),
  location_detection: z.boolean().optional(),
  daily_briefing_time: z.string().optional(),
  nudge_time: z.string().optional(),
  shutdown_time: z.string().optional(),
  pomodoro_long_break_interval: z.number().optional(),
  daily_capacity_minutes: z.number().optional(),
  density: z.enum(["comfortable", "compact"]).optional(),
});
