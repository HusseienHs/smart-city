import { getMyStaffInvitations } from '@smart-city/api';
import { SUPPORTED_LOCALES } from '@smart-city/shared';
import { createTranslator } from '@smart-city/shared/i18n';
import type { ReactNode } from 'react';

import { canAccessModule } from '@/lib/auth/permissions';
import { roleLabel } from '@/lib/auth/role-label';
import { ACCESS_PATH } from '@/lib/auth/routes';
import { requireStaff } from '@/lib/auth/staff-context';
import { isSupabaseConfigured } from '@/lib/env';
import { localizedText } from '@/lib/i18n/localized-text';
import { localizedHref } from '@/lib/i18n/routing';
import { getLocale } from '@/lib/i18n/server';
import { getModule, NAV_GROUPS } from '@/lib/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import packageJson from '../../../package.json';
import { Breadcrumbs } from './breadcrumbs';
import { LanguageSwitcher } from './language-switcher';
import { MunicipalityContext, type MunicipalityOption } from './municipality-context';
import { ShellFrame } from './shell-frame';
import { Sidebar, type SidebarProps } from './sidebar';
import type { ShellNavGroup } from './types';
import { UserMenu } from './user-menu';

/**
 * The dashboard chrome for a verified staff member. Reads the session (so it renders inside
 * the dashboard layout's Suspense boundary) and shows only the modules the active role can use.
 * Everything is translated here on the server; client components only receive strings.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const staff = await requireStaff();
  const locale = await getLocale();
  const t = createTranslator(locale);

  const groups: ShellNavGroup[] = NAV_GROUPS.map((group) => ({
    id: group.id,
    label: t(group.label),
    items: group.modules
      .filter((entry) => canAccessModule(staff.role, entry.id))
      .map((entry) => ({
        id: entry.id,
        path: entry.path,
        href: localizedHref(locale, entry.path),
        label: t(entry.label),
        icon: entry.icon,
      })),
  })).filter((group) => group.items.length > 0);

  const toOption = (membership: (typeof staff.memberships)[number]): MunicipalityOption => ({
    id: membership.municipality_id,
    name: localizedText(membership.municipality_name, locale),
    role: roleLabel(t, membership.role),
    suspended: membership.municipality_status === 'suspended',
  });
  const current = staff.active ? toOption(staff.active) : null;

  // A failure here only hides the invitation badge; it never blocks the dashboard.
  const pendingInvitations = await getMyStaffInvitations(await createSupabaseServerClient())
    .then((invitations) => invitations.length)
    .catch(() => 0);

  const sidebar: SidebarProps = {
    groups,
    productName: t('app.name'),
    tagline: t('adminShell.productTagline'),
    navLabel: t('adminNav.mainLabel'),
    backendConnected: isSupabaseConfigured,
    backendLabel: isSupabaseConfigured ? t('backend.connected') : t('backend.notConfigured'),
    versionLabel: t('adminShell.version', { version: packageJson.version }),
    context: (
      <MunicipalityContext
        locale={locale}
        current={current}
        options={staff.memberships.map(toOption)}
        labels={{
          municipality: t('adminAuth.municipality'),
          switchMunicipality: t('adminAuth.switchMunicipality'),
          suspended: t('adminAuth.suspended'),
          platformAdmin: t('adminAuth.platformAdmin'),
        }}
      />
    ),
  };

  return (
    <ShellFrame
      sidebar={<Sidebar variant="static" {...sidebar} />}
      drawer={<Sidebar variant="drawer" {...sidebar} />}
      breadcrumbs={
        <Breadcrumbs
          label={t('adminShell.breadcrumbs')}
          entries={groups.flatMap((group) =>
            group.items.map((item) => ({ path: item.path, label: item.label, group: group.label })),
          )}
        />
      }
      headerEnd={
        <>
          <LanguageSwitcher
            current={locale}
            label={t('adminShell.changeLanguage')}
            options={SUPPORTED_LOCALES.map((option) => ({
              locale: option,
              label: t(`language.${option}`),
            }))}
          />
          <UserMenu
            locale={locale}
            name={staff.user.fullName ?? staff.user.email ?? ''}
            email={staff.user.email}
            role={roleLabel(t, staff.role)}
            municipality={current?.name ?? null}
            accountHref={localizedHref(locale, getModule('account').path)}
            accessHref={localizedHref(locale, ACCESS_PATH)}
            pendingInvitations={pendingInvitations}
            labels={{
              menu: t('adminAuth.accountMenu'),
              account: t('adminNav.account'),
              invitations: t('adminAuth.invitationsTitle'),
              signOut: t('auth.signOut'),
            }}
          />
        </>
      }
      labels={{
        skipToContent: t('adminShell.skipToContent'),
        navigation: t('adminNav.mainLabel'),
        openNavigation: t('adminShell.openNavigation'),
        closeNavigation: t('adminShell.closeNavigation'),
      }}
    >
      {children}
    </ShellFrame>
  );
}
