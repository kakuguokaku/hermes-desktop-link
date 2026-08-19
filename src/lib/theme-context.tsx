// src/lib/theme-context.tsx —— 跟随系统的主题 Provider（支持手动覆盖：跟随/白天/黑夜 + 字体大小 标准/更大）
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { getPrefs, savePrefs, type DisplayMode, type FontSize } from './storage';
import { Colors, darkColors, lightColors, font } from './theme';

type ThemeContextValue = {
  colors: Colors;
  scheme: 'light' | 'dark';
  displayMode: DisplayMode;
  setDisplayMode: (m: DisplayMode) => void;
  fontSize: FontSize;
  setFontSize: (f: FontSize) => void;
  fontScale: 1 | 1.15;
};

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  scheme: 'light',
  displayMode: 'auto',
  setDisplayMode: () => {},
  fontSize: 'standard',
  setFontSize: () => {},
  fontScale: 1,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [displayMode, setDisplayModeState] = useState<DisplayMode>('auto');
  const [fontSize, setFontSizeState] = useState<FontSize>('standard');

  useEffect(() => {
    getPrefs()
      .then((p) => {
        setDisplayModeState(p.displayMode || 'auto');
        setFontSizeState(p.fontSize || 'standard');
      })
      .catch(() => {});
  }, []);

  const setDisplayMode = useMemo(
    () => (m: DisplayMode) => {
      setDisplayModeState(m);
      savePrefs({ displayMode: m }).catch(() => {});
    },
    []
  );

  const setFontSize = useMemo(
    () => (f: FontSize) => {
      setFontSizeState(f);
      savePrefs({ fontSize: f }).catch(() => {});
    },
    []
  );

  const scheme: 'light' | 'dark' =
    displayMode === 'auto' ? (systemScheme === 'dark' ? 'dark' : 'light') : displayMode;
  const colors = useMemo(() => (scheme === 'dark' ? darkColors : lightColors), [scheme]);
  const fontScale: 1 | 1.15 = fontSize === 'large' ? 1.15 : 1;

  const value = useMemo(
    () => ({ colors, scheme, displayMode, setDisplayMode, fontSize, setFontSize, fontScale }),
    [colors, scheme, displayMode, setDisplayMode, fontSize, setFontSize, fontScale]
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

export function useFontSize() {
  const { fontSize, setFontSize } = useContext(ThemeContext);
  return { fontSize, setFontSize };
}

/** 返回按「字体大小」缩放后的 font token（large = ×1.15 四舍五入） */
export function useFont() {
  const { fontScale } = useContext(ThemeContext);
  return useMemo(() => {
    if (fontScale === 1) return font;
    return {
      h1: Math.round(font.h1 * fontScale),
      h2: Math.round(font.h2 * fontScale),
      body: Math.round(font.body * fontScale),
      caption: Math.round(font.caption * fontScale),
      tiny: Math.round(font.tiny * fontScale),
    };
  }, [fontScale]);
}
