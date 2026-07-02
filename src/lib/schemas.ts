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
