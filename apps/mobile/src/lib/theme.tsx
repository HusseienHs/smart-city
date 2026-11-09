import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ColorSchemeName } from '@smart-city/shared';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { Appearance, Platform } from 'react-native';

import { DEFAULT_COLOR_SCHEME, loadThemePreference, saveThemePreference } from './theme-preference';

interface ThemeContextValue {
  scheme: ColorSchemeName;
  /** Switches the whole app immediately and remembers the choice on this device. */
  setScheme: (scheme: ColorSchemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Provides the app's color scheme: light by default, dark only when the user turns it on.
 * Children render only once the saved choice is loaded (the splash screen stays up), so the
 * app never flashes in the wrong theme.
 */
export function AppThemeProvider({ children }: PropsWithChildren) {
  const [scheme, setSchemeState] = useState<ColorSchemeName>(DEFAULT_COLOR_SCHEME);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    void loadThemePreference(AsyncStorage).then((saved) => {
      setSchemeState(saved);
      setIsReady(true);
    });
  }, []);

  // Native controls (keyboard, switches, alerts) follow the app's choice, not the system's.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Appearance.setColorScheme(scheme);
  }, [scheme]);

  const setScheme = useCallback((next: ColorSchemeName) => {
    setSchemeState(next);
    void saveThemePreference(AsyncStorage, next);
  }, []);

  const value = useMemo(() => ({ scheme, setScheme }), [scheme, setScheme]);

  if (!isReady) return null;
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useAppTheme(): ThemeContextValue {
  const context = use(ThemeContext);
  if (!context) throw new Error('useAppTheme must be used inside <AppThemeProvider>');
  return context;
}
