// src/app/settings.tsx —— 设置页（极简，明暗自适应）
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
import { clearConfig, getConfig, type ConnConfig } from '../lib/storage';
import { font, radius, shadow, type Colors } from '../lib/theme';
import { useDisplayMode, useTheme } from '../lib/theme-context';
import { AppLogo } from '../components/app-logo';

const createStyles = (colors: Colors) =>
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
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    label: { fontSize: font.body, color: colors.textBody },
    value: { fontSize: font.body, fontWeight: '600', color: colors.textPrimary, flexShrink: 1, marginLeft: 12 },
    divider: { height: 1, backgroundColor: colors.borderSubtle, marginVertical: 12 },
    note: { fontSize: font.caption, color: colors.textMuted, marginTop: 10, lineHeight: 18 },
    dangerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dangerText: { fontSize: font.body, color: colors.errorText, fontWeight: '600' },
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
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { displayMode, setDisplayMode } = useDisplayMode();
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
      <Text style={styles.section}>连接</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>电脑地址</Text>
          <Text style={styles.value} numberOfLines={1}>
            {config ? config.baseUrl.replace(/^http:\/\//, '') : '未配置'}
          </Text>
        </View>
        {config?.lanBaseUrl ? (
          <>
            <View style={styles.divider} />
            <View style={styles.rowBetween}>
              <Text style={styles.label}>内网地址</Text>
              <Text style={styles.value} numberOfLines={1}>
                {config.lanBaseUrl.replace(/^http:\/\//, '')}
              </Text>
            </View>
          </>
        ) : null}
        <View style={styles.divider} />
        <View style={styles.rowBetween}>
          <Text style={styles.label}>状态</Text>
          <Pressable onPress={testConn} hitSlop={8}>
            {connStatus === 'open' ? (
              <Text style={[styles.value, { color: colors.successText }]}>已连接 ✓</Text>
            ) : connStatus === 'connecting' ? (
              <Text style={styles.value}>连接中…</Text>
            ) : (
              <Text style={[styles.value, { color: colors.errorText }]}>未连接 ✗</Text>
            )}
          </Pressable>
        </View>
        <View style={styles.divider} />
        <Pressable style={styles.dangerRow} onPress={disconnect}>
          <Ionicons name="log-out-outline" size={17} color={colors.errorText} />
          <Text style={styles.dangerText}>断开并清除连接信息</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>显示模式</Text>
      <View style={styles.card}>
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

      <Text style={styles.section}>模型</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>默认模型</Text>
          <Text style={styles.value} numberOfLines={1}>
            {defaultModel ? defaultModel.split('/').pop() : '—'}
          </Text>
        </View>
        <Text style={styles.note}>在对话页右上角可随时切换模型，选择会记住。</Text>
      </View>

      <Text style={styles.section}>关于</Text>
      <View style={styles.card}>
        <View style={styles.aboutLogo}>
          <AppLogo width={150} />
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>KAKU Hermes</Text>
          <Text style={styles.value}>v{Constants.expoConfig?.version ?? ''}</Text>
        </View>
        <Text style={styles.note}>
          手机端访问你电脑上的 Hermes。对话与电脑端实时同步，支持模型切换与语音输入。
        </Text>
      </View>
    </ScrollView>
  );
}
