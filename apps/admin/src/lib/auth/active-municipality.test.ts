import { describe, expect, it } from 'vitest';

import { resolveActiveMembership } from './active-municipality';

const telAviv = { municipality_id: 'tel-aviv', role: 'employee' };
const haifa = { municipality_id: 'haifa', role: 'municipality_admin' };

describe('active municipality (the cookie is a preference, never trusted)', () => {
  it('uses the requested municipality when the user is a member there', () => {
    expect(resolveActiveMembership([telAviv, haifa], 'haifa')).toBe(haifa);
  });

  it('ignores a municipality the user is not a member of (forged or revoked cookie)', () => {
    expect(resolveActiveMembership([telAviv, haifa], 'jerusalem')).toBe(telAviv);
    expect(resolveActiveMembership([telAviv], 'haifa')).toBe(telAviv);
  });

  it('falls back to the first membership without a preference', () => {
    expect(resolveActiveMembership([haifa, telAviv], undefined)).toBe(haifa);
    expect(resolveActiveMembership([haifa], '')).toBe(haifa);
  });

  it('has no active municipality without memberships, whatever the cookie says', () => {
    expect(resolveActiveMembership([], 'haifa')).toBeNull();
  });
});
