// src/lib/theme.ts —— VK.House 品牌设计规范（浅色 + 夜间 双套 token）

export type Colors = {
  bg: string;
  card: string;
  border: string;
  borderSubtle: string;
  accent: string;      // 文字/图标/链接用酒红
  accentFill: string;  // 填充背景用酒红（按钮/气泡/头像）
  accentHover: string;
  accentSoft: string;
  accentGlow: string;
  textPrimary: string;
  textBody: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  void: string;
  successBg: string;
  successText: string;
  errorBg: string;
  errorText: string;
  warningBg: string;
  warningText: string;
};

// 浅色（默认，VK.House 浅色极简）
export const lightColors: Colors = {
  bg: '#F5F5F7',
  card: '#FFFFFF',
  border: '#E4E4E7',
  borderSubtle: '#F4F4F5',
  accent: '#69043D',
  accentFill: '#69043D',
  accentHover: '#7D144A',
  accentSoft: '#FDF8F9',
  accentGlow: 'rgba(105,4,61,0.15)',
  textPrimary: '#18181B',
  textBody: '#3F3F46',
  textSecondary: '#71717A',
  textMuted: '#A1A1AA',
  textFaint: '#D4D4D8',
  void: '#0A0A0A',
  successBg: '#ECFDF5',
  successText: '#047857',
  errorBg: '#FDF2F4',
  errorText: '#69043D',
  warningBg: '#FFFBEB',
  warningText: '#92400E',
};

// 夜间（跟随系统，深色近黑 + 提亮酒红，对比对齐浅色层级）
export const darkColors: Colors = {
  bg: '#0A0A0A',
  card: '#17171A',
  border: '#2A2A31',
  borderSubtle: '#1E1E23',
  accent: '#C4648F',
  accentFill: '#8A2D5C',
  accentHover: '#A03A6E',
  accentSoft: 'rgba(196,100,143,0.13)',
  accentGlow: 'rgba(196,100,143,0.28)',
  textPrimary: '#F5F5F7',
  textBody: '#D4D4D8',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  textFaint: '#3F3F46',
  void: '#0A0A0A',
  successBg: 'rgba(4,120,87,0.16)',
  successText: '#4ADE9A',
  errorBg: 'rgba(196,100,143,0.14)',
  errorText: '#F0A8C0',
  warningBg: 'rgba(146,64,14,0.20)',
  warningText: '#FBBF77',
};

export const radius = {
  card: 16,
  bubble: 18,
  small: 10,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
};

export const font = {
  display: 28,
  h1: 24,
  h2: 18,
  body: 14,
  caption: 12,
  tiny: 11,
};
