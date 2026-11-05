import { spacing } from '@smart-city/shared';
import type { MessageKey } from '@smart-city/shared/i18n';
import * as Linking from 'expo-linking';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useThemeColors } from '@/hooks/use-theme';
import { completeAuthCallback, useAuth } from '@/lib/auth';
import { parseAuthCallbackUrl, type AuthCallbackParams } from '@/lib/auth-utils';
import { isSupabaseConfigured } from '@/lib/env';
import { useI18n } from '@/lib/i18n';

type State = { status: 'working' } | { status: 'done' } | { status: 'failed'; error: MessageKey };

/** Failures a fresh email fixes (expired, already used, or opened on another device). */
const LINK_ERRORS: readonly MessageKey[] = ['auth.errors.linkExpired', 'auth.errors.linkInvalid'];

/**
 * Target of every email link (sign-up confirmation and password recovery), reachable whether
 * or not the user is signed in. Exchanges the PKCE code, then hands over to the app or to the
 * new-password screen.
 */
export default function AuthCallbackScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { session, isRecoveringPassword } = useAuth();
  // The router only sees the query string; errors can also arrive in the #fragment.
  const query = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_code?: string;
    error_description?: string;
  }>();
  const linkingUrl = Linking.useLinkingURL();
  const [state, setState] = useState<State>(
    isSupabaseConfigured
      ? { status: 'working' }
      : { status: 'failed', error: 'auth.notConfigured' },
  );
  const handledKey = useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const params: AuthCallbackParams = {
      ...parseAuthCallbackUrl(linkingUrl ?? ''),
      ...(query.code ? { code: query.code } : {}),
      ...(query.error ? { error: query.error } : {}),
      ...(query.error_code ? { errorCode: query.error_code } : {}),
    };
    // A code can be exchanged only once; don't repeat the attempt on re-render.
    const key = params.code ?? params.errorCode ?? params.error ?? '';
    if (handledKey.current === key) return;
    handledKey.current = key;

    void completeAuthCallback(params).then((result) =>
      setState(result.ok ? { status: 'done' } : { status: 'failed', error: result.error }),
    );
  }, [linkingUrl, query.code, query.error, query.error_code]);

  // Rendered after the auth state has updated, so the root layout already allows the target.
  if (state.status === 'done' && isRecoveringPassword) return <Redirect href="/reset-password" />;
  if (state.status === 'done' && session) return <Redirect href="/" />;

  if (state.status === 'failed') {
    return (
      <Screen title={t('auth.callbackFailedTitle')}>
        <EmptyState
          icon="alert-circle-outline"
          title={t('auth.callbackFailedTitle')}
          description={t(state.error)}
        />
        {session ? (
          <Button title={t('mobileTabs.home')} onPress={() => router.replace('/')} />
        ) : (
          <>
            {LINK_ERRORS.includes(state.error) ? (
              // Back to the verification flow: the new email is requested from this device,
              // so its link (and PKCE verifier) match where it will be opened.
              <Button
                title={t('auth.sendNewLink')}
                onPress={() => router.replace('/verify-email')}
              />
            ) : null}
            <Button
              title={t('auth.backToSignIn')}
              variant={LINK_ERRORS.includes(state.error) ? 'secondary' : 'primary'}
              onPress={() => router.replace('/sign-in')}
            />
          </>
        )}
      </Screen>
    );
  }

  return (
    <View style={[styles.loading, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text muted accessibilityLiveRegion="polite">
        {t('auth.callbackLoading')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
});
