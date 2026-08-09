// src/lib/theme-context.tsx —— 跟随系统的主题 Provider（支持手动覆盖：跟随/白天/黑夜）
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { getPrefs, savePrefs, type DisplayMode } from './storage';
import { Colors, darkColors, lightColors } from './theme';

type ThemeContextValue = {
  colors: Colors;
  scheme: 'light' | 'dark';
  displayMode: DisplayMode;
  setDisplayMode: (m: DisplayMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  scheme: 'light',
  displayMode: 'auto',
  setDisplayMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [displayMode, setDisplayModeState] = useState<DisplayMode>('auto');

  useEffect(() => {
    getPrefs()
      .then((p) => setDisplayModeState(p.displayMode || 'auto'))
      .catch(() => {});
  }, []);

  const setDisplayMode = useMemo(
    () => (m: DisplayMode) => {
      setDisplayModeState(m);
      savePrefs({ displayMode: m }).catch(() => {});
    },
    []
  );

  const scheme: 'light' | 'dark' =
    displayMode === 'auto' ? (systemScheme === 'dark' ? 'dark' : 'light') : displayMode;
  const colors = useMemo(() => (scheme === 'dark' ? darkColors : lightColors), [scheme]);

  const value = useMemo(
    () => ({ colors, scheme, displayMode, setDisplayMode }),
    [colors, scheme, displayMode, setDisplayMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Colors {
  return useContext(ThemeContext).colors;
}

export function useScheme(): 'light' | 'dark' {
  return useContext(ThemeContext).scheme;
}

export function useDisplayMode() {
  const { displayMode, setDisplayMode } = useContext(ThemeContext);
  return { displayMode, setDisplayMode };
}
