import { z } from 'zod';

export type Page<T = unknown> = {
  items: T[];
  nextPagePath: string | null;
};

/** Historical item fields remain raw until a demo response validates them. */
export const pageSchema = z.object({
  items: z.array(z.unknown()),
  nextPagePath: z.string().nullable(),
}).passthrough();

export const reportRequestSchema = z.object({
  dataIncluded: z.record(z.string(), z.unknown()),
}).passthrough();

export const reportResponseSchema = z.object({
  /** The provider documents this as int64; retain it as a string after safe parsing. */
  reportId: z.number().int().safe().transform((reportId) => String(reportId)),
}).passthrough();
