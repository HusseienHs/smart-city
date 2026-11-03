import { type TestDb, user } from './db';

/**
 * Fictional test world: two municipalities (A, B) with staff of every role, citizens and
 * reports in different states. Exists only inside the in-memory test database.
 */
const id = (group: number, n: number) =>
  `00000000-0000-4000-8000-${String(group * 1000 + n).padStart(12, '0')}`;

export const ids = {
  // municipalities & structure
  muniA: id(1, 1),
  muniB: id(1, 2),
  neighborhoodANorth: id(2, 1),
  deptAX: id(3, 1), // A: roads
  deptAY: id(3, 2), // A: sanitation
  deptBZ: id(3, 3), // B: everything
  // people
  citizenA1: id(4, 1), // has a phone number
  citizenA2: id(4, 2),
  citizenB1: id(4, 3),
  employeeAX: id(4, 10),
  managerAX: id(4, 11),
  employeeAY: id(4, 12),
  managerAY: id(4, 13),
  dispatcherA: id(4, 14),
  adminA: id(4, 15),
  admin2A: id(4, 16),
  formerEmployeeAX: id(4, 17), // deactivated
  employeeAX2: id(4, 18), // second ordinary employee in X
  adminB: id(4, 20),
  employeeBZ: id(4, 21),
  platformAdmin: id(4, 30),
} as const;

/** Employee row ids (assignees reference employees.id, not the user id). */
export const employeeIds = {
  employeeAX: id(5, 1),
  managerAX: id(5, 2),
  employeeAY: id(5, 3),
  managerAY: id(5, 4),
  dispatcherA: id(5, 5),
  adminA: id(5, 6),
  admin2A: id(5, 7),
  formerEmployeeAX: id(5, 8),
  adminB: id(5, 9),
  employeeBZ: id(5, 10),
  employeeAX2: id(5, 11),
} as const;

/** Exact fixture location of the public report in A (inside the north neighborhood). */
export const exactLocationA = { latitude: 32.0712345, longitude: 34.7512345 };

export interface FixtureReports {
  /** A, citizen A1, pothole, public, unassigned (intake queue), suggested dept X. */
  publicUnassignedA: string;
  /** A, citizen A1, noise → private by default, unassigned. */
  privateNoiseA: string;
  /** A, citizen A2, streetlight, assigned to dept X / employee AX. */
  assignedXA: string;
  /** A, citizen A2, garbage, assigned to dept Y. */
  assignedYA: string;
  /** B, citizen B1, pothole, assigned to dept Z. */
  assignedZB: string;
}

const square = (west: number, south: number, east: number, north: number) =>
  `SRID=4326;MULTIPOLYGON(((${west} ${south},${east} ${south},${east} ${north},${west} ${north},${west} ${south})))`;

export async function setupFixtures(db: TestDb): Promise<FixtureReports> {
  await db.begin();

  const users: [string, string, string][] = [
    [ids.citizenA1, 'citizen.a1@example.test', 'Citizen A One'],
    [ids.citizenA2, 'citizen.a2@example.test', 'Citizen A Two'],
    [ids.citizenB1, 'citizen.b1@example.test', 'Citizen B One'],
    [ids.employeeAX, 'employee.ax@example.test', 'Employee AX'],
    [ids.managerAX, 'manager.ax@example.test', 'Manager AX'],
    [ids.employeeAY, 'employee.ay@example.test', 'Employee AY'],
    [ids.managerAY, 'manager.ay@example.test', 'Manager AY'],
    [ids.dispatcherA, 'dispatcher.a@example.test', 'Dispatcher A'],
    [ids.adminA, 'admin.a@example.test', 'Admin A'],
    [ids.admin2A, 'admin2.a@example.test', 'Admin Two A'],
    [ids.formerEmployeeAX, 'former.ax@example.test', 'Former Employee AX'],
    [ids.employeeAX2, 'employee.ax2@example.test', 'Employee AX Two'],
    [ids.adminB, 'admin.b@example.test', 'Admin B'],
    [ids.employeeBZ, 'employee.bz@example.test', 'Employee BZ'],
    [ids.platformAdmin, 'platform@example.test', 'Platform Admin'],
  ];
  for (const [userId, email, name] of users) {
    // Profiles are created by the on_auth_user_created trigger.
    await db.query(
      `insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
       values ($1, $2, now(), jsonb_build_object('full_name', $3::text))`,
      [userId, email, name],
    );
  }

  await db.query(
    `insert into public.municipalities (id, code, name, status, boundary) values
       ($1, 'TSA', '{"he": "עיר בדיקה א", "en": "Test City A"}', 'active', $3::extensions.geography),
       ($2, 'TSB', '{"he": "עיר בדיקה ב", "en": "Test City B"}', 'active', $4::extensions.geography)`,
    [ids.muniA, ids.muniB, square(34.7, 32.0, 34.8, 32.1), square(35.0, 31.7, 35.1, 31.8)],
  );
  await db.query(
    `insert into public.neighborhoods (id, municipality_id, name, boundary)
     values ($1, $2, '{"he": "צפון"}', $3::extensions.geography)`,
    [ids.neighborhoodANorth, ids.muniA, square(34.7, 32.05, 34.8, 32.1)],
  );
  await db.query(
    `insert into public.departments (id, municipality_id, name) values
       ($1, $4, '{"he": "כבישים"}'), ($2, $4, '{"he": "תברואה"}'), ($3, $5, '{"he": "אגף כללי"}')`,
    [ids.deptAX, ids.deptAY, ids.deptBZ, ids.muniA, ids.muniB],
  );
  // Category routing: A → roads (X) / sanitation (Y); B → Z.
  await db.query(
    `insert into public.municipality_report_categories (municipality_id, category_id, default_department_id)
     select $1::uuid, c.id, case
         when c.code in ('pothole', 'road', 'sidewalk', 'streetlight') then $2::uuid
         when c.code in ('garbage', 'noise') then $3::uuid
       end
     from public.report_categories c
     union all
     select $4::uuid, c.id, $5::uuid from public.report_categories c`,
    [ids.muniA, ids.deptAX, ids.deptAY, ids.muniB, ids.deptBZ],
  );

  const staff: [string, string, string, string, string | null, boolean][] = [
    [employeeIds.employeeAX, ids.employeeAX, ids.muniA, 'employee', ids.deptAX, true],
    [employeeIds.managerAX, ids.managerAX, ids.muniA, 'department_manager', ids.deptAX, true],
    [employeeIds.employeeAY, ids.employeeAY, ids.muniA, 'employee', ids.deptAY, true],
    [employeeIds.managerAY, ids.managerAY, ids.muniA, 'department_manager', ids.deptAY, true],
    [employeeIds.dispatcherA, ids.dispatcherA, ids.muniA, 'intake_dispatcher', null, true],
    [employeeIds.adminA, ids.adminA, ids.muniA, 'municipality_admin', null, true],
    [employeeIds.admin2A, ids.admin2A, ids.muniA, 'municipality_admin', null, true],
    [employeeIds.formerEmployeeAX, ids.formerEmployeeAX, ids.muniA, 'employee', ids.deptAX, false],
    [employeeIds.employeeAX2, ids.employeeAX2, ids.muniA, 'employee', ids.deptAX, true],
    [employeeIds.adminB, ids.adminB, ids.muniB, 'municipality_admin', null, true],
    [employeeIds.employeeBZ, ids.employeeBZ, ids.muniB, 'employee', ids.deptBZ, true],
  ];
  for (const [employeeId, userId, municipalityId, role, departmentId, active] of staff) {
    await db.query(
      `insert into public.employees (id, user_id, municipality_id, role, department_id, is_active)
       values ($1, $2, $3, $4::public.staff_role, $5, $6)`,
      [employeeId, userId, municipalityId, role, departmentId, active],
    );
  }

  await db.query(`insert into public.platform_admins (user_id) values ($1)`, [ids.platformAdmin]);
  await db.query(
    `insert into public.profile_contacts (user_id, phone) values ($1, '+972000000001')`,
    [ids.citizenA1],
  );

  const submit = async (
    citizen: string,
    municipalityId: string,
    category: string,
    latitude: number,
    longitude: number,
  ) => {
    const [row] = await db.as<{ report_id: string }>(
      user(citizen),
      `select report_id from public.submit_report($1, $2, $3, $4, $5)`,
      [municipalityId, category, `Synthetic test report: ${category}`, latitude, longitude],
    );
    return row!.report_id;
  };

  const reports: FixtureReports = {
    publicUnassignedA: await submit(
      ids.citizenA1,
      ids.muniA,
      'pothole',
      exactLocationA.latitude,
      exactLocationA.longitude,
    ),
    privateNoiseA: await submit(ids.citizenA1, ids.muniA, 'noise', 32.0301, 34.7402),
    assignedXA: await submit(ids.citizenA2, ids.muniA, 'streetlight', 32.0402, 34.7603),
    assignedYA: await submit(ids.citizenA2, ids.muniA, 'garbage', 32.0503, 34.7704),
    assignedZB: await submit(ids.citizenB1, ids.muniB, 'pothole', 31.7505, 35.0506),
  };

  await db.as(user(ids.adminA), `select public.assign_report($1, $2, $3)`, [
    reports.assignedXA,
    ids.deptAX,
    employeeIds.employeeAX,
  ]);
  await db.as(user(ids.adminA), `select public.assign_report($1, $2)`, [
    reports.assignedYA,
    ids.deptAY,
  ]);
  await db.as(user(ids.adminB), `select public.assign_report($1, $2)`, [
    reports.assignedZB,
    ids.deptBZ,
  ]);

  await db.commit();
  return reports;
}
