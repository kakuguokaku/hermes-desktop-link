// src/components/group-toggle.tsx —— 首页同级菜单折叠行（最近会话 / 定时任务 共用，风格完全一致）
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type Colors, type FontTokens } from '../lib/theme';
import { useFont, useTheme } from '../lib/theme-context';

export function GroupToggle({
  title,
  count,
  expanded,
  onPress,
}: {
  title: string;
  count?: number;
  expanded: boolean;
  onPress: () => void;
}) {
  const colors = useTheme();
  const font = useFont();
  const styles = useMemo(() => createStyles(colors, font), [colors, font]);
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityLabel={title} accessibilityRole="button">
      <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={13} color={colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      {count !== undefined ? (
        <View style={styles.count}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const createStyles = (colors: Colors, font: FontTokens) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingTop: 12, paddingBottom: 8 },
    title: { fontSize: font.h2, fontWeight: '700', color: colors.textPrimary },
    count: { backgroundColor: colors.borderSubtle, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
    countText: { fontSize: font.tiny, color: colors.textMuted, fontWeight: '600' },
  });
