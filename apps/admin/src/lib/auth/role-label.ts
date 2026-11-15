import type { Translator } from '@smart-city/shared/i18n';

import type { AccessRole } from './permissions';

/** The display name of a role in the current language. */
export function roleLabel(t: Translator, role: AccessRole): string {
  return role === 'platform_admin' ? t('adminAuth.platformAdmin') : t(`staffRole.${role}`);
}
