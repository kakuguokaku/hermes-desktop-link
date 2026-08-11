// src/components/app-logo.tsx —— 品牌图标（明暗自适应）
import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

const ICON = require('../../assets/images/icon.png');

export function AppLogo({
  width = 180,
  style,
}: {
  width?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image source={ICON} style={[{ width, height: width, resizeMode: 'contain' }, style]} />
  );
}
