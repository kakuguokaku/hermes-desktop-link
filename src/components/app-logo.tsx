// src/components/app-logo.tsx —— VK.House 字标（明暗自适应）
import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { useScheme } from '../lib/theme-context';

const LOGIN = require('../../assets/logo/login.png'); // 酒红+黑（浅色底）
const WHITE = require('../../assets/logo/white.png'); // 单色字标（深色底，tintColor 染白）

export function AppLogo({
  width = 180,
  style,
}: {
  width?: number;
  style?: StyleProp<ImageStyle>;
}) {
  const scheme = useScheme();
  const isDark = scheme === 'dark';
  return (
    <Image
      source={isDark ? WHITE : LOGIN}
      style={[
        { width, height: width * 0.44, resizeMode: 'contain', opacity: 1 },
        isDark ? { tintColor: '#FFFFFF' } : null,
        style,
      ]}
    />
  );
}
