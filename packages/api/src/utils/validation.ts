import { localizedTextSchema, type LocalizedText } from '@smart-city/shared';
import type { z } from 'zod';

import { ApiError } from '../errors/api-error';
import type { Json } from '../database.types';

/** Validates caller input before any request is sent. Throws ApiError('validation'). */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new ApiError('validation', {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  });
}

/**
 * Narrows a jsonb column to LocalizedText. The database's check constraint guarantees the shape,
 * so a failure here means the schema and this code have drifted: report it as a server error.
 */
export function toLocalizedText(value: Json): LocalizedText {
  const result = localizedTextSchema.safeParse(value);
  if (result.success) return result.data;
  throw new ApiError('server', { debug: { message: 'Malformed localized text in response' } });
}
