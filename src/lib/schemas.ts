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
