import 'server-only';

import {
  listColleagues,
  listManagedDepartments,
  listMunicipalityStaff,
  type ManagedDepartment,
  type SmartCityClient,
  type StaffMembership,
} from '@smart-city/api';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { requireStaff, type StaffContext } from '@/lib/auth/staff-context';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import {
  canViewFormerStaff,
  fromColleagues,
  fromStaffMembers,
  type DirectoryEntry,
} from './capabilities';

/**
 * What the departments and staff pages need, for the verified staff member in their ACTIVE
 * municipality: departments (active and inactive) and the directory — every member with names
 * for admins (get_municipality_staff), active colleagues for everyone else (get_colleagues).
 * Cached for one request only.
 */
export interface StaffWorkspace {
  staff: StaffContext & { active: StaffMembership };
  municipalityId: string;
  client: SmartCityClient;
  departments: ManagedDepartment[];
  directory: DirectoryEntry[];
}

export const getStaffWorkspace = cache(async (): Promise<StaffWorkspace> => {
  const staff = await requireStaff();
  if (!staff.active) notFound();
  const municipalityId = staff.active.municipality_id;
  const client = await createSupabaseServerClient();
  const [departments, directory] = await Promise.all([
    listManagedDepartments(client, { municipalityId }),
    canViewFormerStaff(staff.active.role)
      ? listMunicipalityStaff(client, { municipalityId }).then(fromStaffMembers)
      : listColleagues(client, { municipalityId }).then(fromColleagues),
  ]);
  return {
    staff: staff as StaffWorkspace['staff'],
    municipalityId,
    client,
    departments,
    directory,
  };
});
