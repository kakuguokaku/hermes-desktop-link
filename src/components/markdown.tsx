// src/components/markdown.tsx —— 极简 VK 风格 markdown 渲染（明暗自适应）
import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { font, type Colors } from '../lib/theme';
import { useTheme } from '../lib/theme-context';

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    body: { color: colors.textBody, fontSize: font.body, lineHeight: 22 },
    heading1: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginTop: 10, marginBottom: 4 },
    heading2: { color: colors.textPrimary, fontSize: 17, fontWeight: '700', marginTop: 8, marginBottom: 3 },
    heading3: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', marginTop: 6, marginBottom: 2 },
    paragraph: { marginVertical: 3 },
    strong: { fontWeight: '700', color: colors.textPrimary },
    em: { fontStyle: 'italic' },
    link: { color: colors.accent, textDecorationLine: 'underline' },
    bullet_list: { marginVertical: 3 },
    bullet_list_icon: { color: colors.accent },
    ordered_list: { marginVertical: 3 },
    ordered_list_icon: { color: colors.textSecondary },
    code_inline: {
      backgroundColor: colors.borderSubtle,
      color: colors.accent,
      fontFamily: 'monospace',
      fontSize: 13,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
    },
    fence: { backgroundColor: colors.void, borderRadius: 10, padding: 12, marginVertical: 6, overflow: 'hidden' },
    code_block: {
      color: '#E4E4E7',
      fontFamily: 'monospace',
      fontSize: 13,
      lineHeight: 19,
    },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: colors.accentGlow,
      backgroundColor: colors.accentSoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      marginVertical: 4,
    },
    hr: { backgroundColor: colors.border, height: 1, marginVertical: 8 },
    table: { borderColor: colors.border, borderWidth: 1, borderRadius: 6, marginVertical: 4 },
    tableHeaderCell: { color: colors.textPrimary, fontWeight: '600' },
  });

export function MarkdownText({ children }: { children: string }) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Markdown style={styles}>{children}</Markdown>;
}
