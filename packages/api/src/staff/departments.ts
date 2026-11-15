import {
  departmentSchema,
  OPEN_REPORT_STATUSES,
  type DepartmentInput,
  type LocalizedText,
} from '@smart-city/shared';
import { z } from 'zod';

import type { SmartCityClient } from '../client';
import { ApiError } from '../errors/api-error';
import { runCountedListQuery, runListQuery, runMaybeSingleQuery } from '../utils/query';
import { requireUserId } from '../utils/session';
import { parseInput, toLocalizedText } from '../utils/validation';
import { STAFF_DEPARTMENT_COLUMNS, type StaffDirectoryEntry } from './directory';

/*
 * Department management. Writes go straight to the table as the signed-in user: the column
 * grants allow (name, email, phone, is_active) and RLS allows only municipality admins of that
 * municipality. Every change is recorded by the audit trigger. Every statement is also scoped
 * to the municipality explicitly, so an id from another municipality matches nothing.
 *
 * Postgres reports an update that RLS filtered out as "0 rows", not as an error; updates
 * therefore return the row and treat "no row" as forbidden.
 */

const scope = z.strictObject({ municipalityId: z.uuid() });

const departmentRefSchema = z.strictObject({ municipalityId: z.uuid(), departmentId: z.uuid() });

/** jsonb for `name`: only the languages that were given (Hebrew always). */
function nameJson(name: { he: string; ar?: string; en?: string }): LocalizedText {
  return {
    he: name.he,
    ...(name.ar ? { ar: name.ar } : {}),
    ...(name.en ? { en: name.en } : {}),
  };
}

export interface ManagedDepartment extends StaffDirectoryEntry {
  email: string | null;
  phone: string | null;
}

export const MANAGED_DEPARTMENT_COLUMNS = `${STAFF_DEPARTMENT_COLUMNS}, email, phone` as const;

interface DepartmentRow {
  id: string;
  municipality_id: string;
  name: unknown;
  is_active: boolean;
  email: string | null;
  phone: string | null;
}

function toDepartment(row: DepartmentRow): ManagedDepartment {
  return {
    id: row.id,
    name: toLocalizedText(row.name as never),
    isActive: row.is_active,
    email: row.email,
    phone: row.phone,
  };
}

/** Every department of the municipality (active and inactive), with contact details. */
export async function listManagedDepartments(
  client: SmartCityClient,
  input: z.input<typeof scope>,
): Promise<ManagedDepartment[]> {
  const { municipalityId } = parseInput(scope, input);
  await requireUserId(client);
  const rows = await runListQuery(
    client
      .from('departments')
      .select(MANAGED_DEPARTMENT_COLUMNS)
      .eq('municipality_id', municipalityId)
      .order('created_at'),
  );
  return (rows as unknown as DepartmentRow[]).map(toDepartment);
}

/** One department of the municipality, or null (missing, foreign or not visible). */
export async function getManagedDepartment(
  client: SmartCityClient,
  input: z.input<typeof departmentRefSchema>,
): Promise<ManagedDepartment | null> {
  const { municipalityId, departmentId } = parseInput(departmentRefSchema, input);
  await requireUserId(client);
  const row = await runMaybeSingleQuery(
    client
      .from('departments')
      .select(MANAGED_DEPARTMENT_COLUMNS)
      .eq('id', departmentId)
      .eq('municipality_id', municipalityId)
      .maybeSingle(),
  );
  return row ? toDepartment(row as unknown as DepartmentRow) : null;
}

const createSchema = z.strictObject({ municipalityId: z.uuid(), department: departmentSchema });

/** Creates an (active) department. Municipality admins only (RLS). */
export async function createDepartment(
  client: SmartCityClient,
  input: { municipalityId: string; department: DepartmentInput },
): Promise<ManagedDepartment> {
  const { municipalityId, department } = parseInput(createSchema, input);
  await requireUserId(client);
  const row = await runMaybeSingleQuery(
    client
      .from('departments')
      .insert({
        municipality_id: municipalityId,
        name: nameJson(department.name),
        email: department.email,
        phone: department.phone,
        is_active: true,
      })
      .select(MANAGED_DEPARTMENT_COLUMNS)
      .single(),
  );
  if (!row)
    throw new ApiError('server', { debug: { message: 'Department insert returned no row' } });
  return toDepartment(row as unknown as DepartmentRow);
}

const updateSchema = departmentRefSchema.extend({ department: departmentSchema });

/** Updates the names and contact details. */
export async function updateDepartment(
  client: SmartCityClient,
  input: { municipalityId: string; departmentId: string; department: DepartmentInput },
): Promise<ManagedDepartment> {
  const { municipalityId, departmentId, department } = parseInput(updateSchema, input);
  await requireUserId(client);
  const row = await runMaybeSingleQuery(
    client
      .from('departments')
      .update({ name: nameJson(department.name), email: department.email, phone: department.phone })
      .eq('id', departmentId)
      .eq('municipality_id', municipalityId)
      .select(MANAGED_DEPARTMENT_COLUMNS)
      .maybeSingle(),
  );
  if (!row) throw new ApiError('forbidden');
  return toDepartment(row as unknown as DepartmentRow);
}

const activeSchema = departmentRefSchema.extend({ isActive: z.boolean() });

/**
 * Activates or deactivates a department. Callers must first make sure no active staff belong to
 * it (the dashboard blocks that case); the database itself only refuses non-admins.
 */
export async function setDepartmentActive(
  client: SmartCityClient,
  input: z.input<typeof activeSchema>,
): Promise<void> {
  const { municipalityId, departmentId, isActive } = parseInput(activeSchema, input);
  await requireUserId(client);
  const row = await runMaybeSingleQuery(
    client
      .from('departments')
      .update({ is_active: isActive })
      .eq('id', departmentId)
      .eq('municipality_id', municipalityId)
      .select('id')
      .maybeSingle(),
  );
  if (!row) throw new ApiError('forbidden');
}

const countsSchema = z.strictObject({
  municipalityId: z.uuid(),
  departmentIds: z.array(z.uuid()).max(200),
});

/**
 * Open reports (submitted → in progress) per department, as the caller sees them: exact for
 * municipality admins; a department manager only sees their own department's reports, so the
 * count for any other department is 0 for them — show counts only where the caller has access.
 */
export async function getDepartmentReportCounts(
  client: SmartCityClient,
  input: z.input<typeof countsSchema>,
): Promise<Record<string, number>> {
  const { municipalityId, departmentIds } = parseInput(countsSchema, input);
  await requireUserId(client);
  const ids = [...new Set(departmentIds)];
  const totals = await Promise.all(
    ids.map(async (departmentId) => {
      const { total } = await runCountedListQuery(
        client
          .from('reports')
          .select('id', { count: 'exact', head: true })
          .eq('municipality_id', municipalityId)
          .eq('department_id', departmentId)
          .in('status', [...OPEN_REPORT_STATUSES]),
      );
      return [departmentId, total] as const;
    }),
  );
  return Object.fromEntries(totals);
}

const assigneeCountSchema = z.strictObject({ municipalityId: z.uuid(), employeeId: z.uuid() });

/** Open reports assigned to one employee (what deactivation or a transfer would hand back). */
export async function countOpenReportsAssignedTo(
  client: SmartCityClient,
  input: z.input<typeof assigneeCountSchema>,
): Promise<number> {
  const { municipalityId, employeeId } = parseInput(assigneeCountSchema, input);
  await requireUserId(client);
  const { total } = await runCountedListQuery(
    client
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('municipality_id', municipalityId)
      .eq('assignee_id', employeeId)
      .in('status', [...OPEN_REPORT_STATUSES]),
  );
  return total;
}
