// src/app/settings.tsx —— 设置页（连接 / 模型 / 显示 / 关于，明暗自适应 + 字体大小）
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../lib/api';
import { connection, type Status } from '../lib/connection';
import { clearConfig, getConfig, type ConnConfig, type FontSize } from '../lib/storage';
import { radius, shadow, type Colors, type FontTokens } from '../lib/theme';
import { useDisplayMode, useFont, useFontSize, useTheme } from '../lib/theme-context';
import { AppLogo } from '../components/app-logo';

const createStyles = (colors: Colors, font: FontTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 16, paddingBottom: 48 },
    section: {
      fontSize: font.tiny,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.textMuted,
      marginTop: 14,
      marginBottom: 8,
      marginLeft: 4,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
      padding: 16,
      ...shadow.card,
    },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    lblRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
    label: { fontSize: font.body, color: colors.textBody },
    value: { fontSize: font.body, fontWeight: '600', color: colors.textPrimary, flexShrink: 1, marginLeft: 12, maxWidth: '60%' },
    divider: { height: 1, backgroundColor: colors.borderSubtle, marginVertical: 12 },
    note: { fontSize: font.caption, color: colors.textMuted, marginTop: 10, lineHeight: 18 },
    dangerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dangerText: { fontSize: font.body, color: colors.errorText, fontWeight: '600' },
    fontOpts: { flexDirection: 'row', gap: 8, flexShrink: 0 },
    fontPill: {
      paddingVertical: 6,
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.bg,
    },
    fontPillActive: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
    fontPillText: { fontSize: font.caption, fontWeight: '600', color: colors.textSecondary },
    fontPillTextActive: { color: colors.card },
    modeRow: { flexDirection: 'row', gap: 10 },
    modeItem: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: radius.small,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.bg,
    },
    modeItemActive: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
    modeLabel: { fontSize: font.caption, fontWeight: '600', color: colors.textSecondary },
    modeLabelActive: { color: colors.card },
    aboutLogo: { alignItems: 'flex-start', marginBottom: 12 },
  });

export default function SettingsScreen() {
  const colors = useTheme();
  const font = useFont();
  const styles = useMemo(() => createStyles(colors, font), [colors, font]);
  const { displayMode, setDisplayMode } = useDisplayMode();
  const { fontSize, setFontSize } = useFontSize();
  const router = useRouter();
  const [config, setConfig] = useState<ConnConfig | null>(null);
  const [connStatus, setConnStatus] = useState<Status>(connection.getStatus());
  const [defaultModel, setDefaultModel] = useState<string | null>(null);

  const load = useCallback(async () => {
    const cfg = await getConfig();
    setConfig(cfg);
    if (cfg) {
      try {
        const m = await api.models(cfg);
        setDefaultModel(m.defaultModel);
      } catch {}
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 订阅全局连接状态：subscribe 注册时立即回放当前状态，挂载即拿到真实状态
  useEffect(() => connection.subscribe(setConnStatus), []);

  const testConn = useCallback(() => {
    if (!config) return;
    if (connStatus !== 'open') connection.ensureStarted(config); // 未连接时立即连接/重连
  }, [config, connStatus]);

  const disconnect = useCallback(() => {
    Alert.alert('断开连接', '将清除已保存的连接信息，需要重新连接。', [
      { text: '取消', style: 'cancel' },
      {
        text: '断开',
        style: 'destructive',
        onPress: async () => {
          await clearConfig();
          connection.disconnect();
          router.replace('/connect');
        },
      },
    ]);
  }, [router]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* 连接 */}
      <Text style={styles.section}>连接</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.lblRow}>
            <Ionicons name="globe-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.label}>电脑地址</Text>
          </View>
          <Text style={styles.value} numberOfLines={1}>
            {config ? config.baseUrl.replace(/^http:\/\//, '') : '未配置'}
          </Text>
        </View>
        {config?.lanBaseUrl ? (
          <>
            <View style={styles.divider} />
            <View style={styles.rowBetween}>
              <View style={styles.lblRow}>
                <Ionicons name="globe-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.label}>内网地址</Text>
              </View>
              <Text style={styles.value} numberOfLines={1}>
                {config.lanBaseUrl.replace(/^http:\/\//, '')}
              </Text>
            </View>
          </>
        ) : null}
        <View style={styles.divider} />
        <View style={styles.rowBetween}>
          <View style={styles.lblRow}>
            <Ionicons name="pulse-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.label}>状态</Text>
          </View>
          <Pressable onPress={testConn} hitSlop={8}>
            {connStatus === 'open' ? (
              <Text numberOfLines={1} style={[styles.value, { color: colors.successText }]}>已连接 ✓</Text>
            ) : connStatus === 'connecting' ? (
              <Text numberOfLines={1} style={styles.value}>连接中…</Text>
            ) : (
              <Text numberOfLines={1} style={[styles.value, { color: colors.errorText }]}>未连接 ✗</Text>
            )}
          </Pressable>
        </View>
        <View style={styles.divider} />
        <Pressable style={styles.dangerRow} onPress={disconnect}>
          <Ionicons name="log-out-outline" size={17} color={colors.errorText} />
          <Text style={styles.dangerText}>断开并清除连接信息</Text>
        </Pressable>
      </View>

      {/* 模型 */}
      <Text style={styles.section}>模型</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.lblRow}>
            <Ionicons name="hardware-chip-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.label}>默认模型</Text>
          </View>
          <Text style={styles.value} numberOfLines={1}>
            {defaultModel ? defaultModel.split('/').pop() : '—'}
          </Text>
        </View>
        <Text style={styles.note}>在对话页右上角可随时切换模型，选择会记住。</Text>
      </View>

      {/* 显示：字体大小在上、白天黑夜模式在下 */}
      <Text style={styles.section}>显示</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.lblRow}>
            <Ionicons name="text-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.label}>字体大小</Text>
          </View>
          <View style={styles.fontOpts}>
            {(['standard', 'large'] as FontSize[]).map((k) => (
              <Pressable
                key={k}
                style={[styles.fontPill, fontSize === k && styles.fontPillActive]}
                onPress={() => setFontSize(k)}
                accessibilityLabel={k === 'standard' ? '标准' : '更大'}
              >
                <Text style={[styles.fontPillText, fontSize === k && styles.fontPillTextActive]}>
                  {k === 'standard' ? '标准' : '更大'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Text style={styles.note}>「更大」会把界面文字整体适度放大一档，方便阅读；选择后立即生效。</Text>
        <View style={styles.divider} />
        <View style={styles.modeRow}>
          {(
            [
              { key: 'auto' as const, icon: 'contrast-outline', label: '跟随系统' },
              { key: 'light' as const, icon: 'sunny-outline', label: '白天' },
              { key: 'dark' as const, icon: 'moon-outline', label: '黑夜' },
            ]
          ).map((m) => {
            const active = displayMode === m.key;
            return (
              <Pressable
                key={m.key}
                style={[styles.modeItem, active && styles.modeItemActive]}
                onPress={() => setDisplayMode(m.key)}
                accessibilityLabel={m.label}
              >
                <Ionicons
                  name={m.icon as keyof typeof Ionicons.glyphMap}
                  size={22}
                  color={active ? colors.card : colors.textSecondary}
                />
                <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.note}>选择后立即生效；"跟随系统"会随手机系统深浅自动切换。</Text>
      </View>

      {/* 关于（无图标） */}
      <Text style={styles.section}>关于</Text>
      <View style={styles.card}>
        <View style={styles.aboutLogo}>
          <AppLogo width={150} />
        </View>
        <View style={styles.rowBetween}>
          <Text style={[styles.label, { fontWeight: '700', color: colors.textPrimary }]}>KAKU Hermes</Text>
          <Text style={styles.value}>v{Constants.expoConfig?.version ?? ''}</Text>
        </View>
        <Text style={styles.note}>
          手机端访问你电脑上的 Hermes。对话与电脑端实时同步，支持模型切换与语音输入。
        </Text>
      </View>
    </ScrollView>
  );
}
