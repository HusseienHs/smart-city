import 'server-only';

import {
  listManagedDepartments,
  type ManagedDepartment,
  type SmartCityClient,
  type StaffMembership,
} from '@smart-city/api';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { requireStaff, type StaffContext } from '@/lib/auth/staff-context';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * What the Notice Board pages need, for the verified staff member in their ACTIVE municipality:
 * a client and the departments (for names and the admin's department choice). Deliberately not
 * the staff directory (getStaffWorkspace), which the Notice Board doesn't use. Cached for one
 * request only.
 */
export interface NoticeWorkspace {
  staff: StaffContext & { active: StaffMembership };
  municipalityId: string;
  client: SmartCityClient;
  departments: ManagedDepartment[];
}

export const getNoticeWorkspace = cache(async (): Promise<NoticeWorkspace> => {
  const staff = await requireStaff();
  if (!staff.active) notFound();
  const municipalityId = staff.active.municipality_id;
  const client = await createSupabaseServerClient();
  const departments = await listManagedDepartments(client, { municipalityId });
  return { staff: staff as NoticeWorkspace['staff'], municipalityId, client, departments };
});
