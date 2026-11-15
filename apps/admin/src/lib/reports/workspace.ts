import 'server-only';

import {
  getStaffDirectory,
  listColleagues,
  type SmartCityClient,
  type StaffColleague,
  type StaffDirectory,
  type StaffMembership,
} from '@smart-city/api';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { requireStaff, type StaffContext } from '@/lib/auth/staff-context';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * What every reports page needs: the verified staff member in their ACTIVE municipality, a
 * client acting as them, and the names (departments, neighborhoods, categories, colleagues)
 * used to label reports. Cached for one request only — never across requests or users.
 */
export interface ReportsWorkspace {
  staff: StaffContext & { active: StaffMembership };
  municipalityId: string;
  client: SmartCityClient;
  directory: StaffDirectory;
  colleagues: StaffColleague[];
}

export const getReportsWorkspace = cache(async (): Promise<ReportsWorkspace> => {
  const staff = await requireStaff();
  // Platform admins without a membership never reach this (ModuleGuard); they have no report
  // access in the database either.
  if (!staff.active) notFound();
  const municipalityId = staff.active.municipality_id;
  const client = await createSupabaseServerClient();
  const [directory, colleagues] = await Promise.all([
    getStaffDirectory(client, { municipalityId }),
    listColleagues(client, { municipalityId }),
  ]);
  return {
    staff: staff as ReportsWorkspace['staff'],
    municipalityId,
    client,
    directory,
    colleagues,
  };
});
