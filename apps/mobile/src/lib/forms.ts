import type { z } from 'zod';

/** The first validation issue of each top-level field, e.g. `{ email: issue }`. */
export function firstIssueByField(error: z.ZodError): Partial<Record<string, z.core.$ZodIssue>> {
  const result: Partial<Record<string, z.core.$ZodIssue>> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? '');
    result[field] ??= issue;
  }
  return result;
}
