// src/app/connect.tsx —— 首次连接设置（内外网双地址 + 自动检测，明暗自适应）
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, probeAuth, probeHealth } from '../lib/api';
import { saveConfig } from '../lib/storage';
import { font, radius, shadow, type Colors } from '../lib/theme';
import { useTheme } from '../lib/theme-context';
import { AppLogo } from '../components/app-logo';

type Step = { text: string; state: 'pending' | 'checking' | 'ok' | 'fail' };

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 24, paddingTop: 48 },
    logo: {
      alignSelf: 'center',
      marginBottom: 20,
    },
    title: { fontSize: font.h1, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
    subtitle: { fontSize: font.caption, color: colors.textMuted, textAlign: 'center', marginTop: 6, marginBottom: 24 },
    card: { backgroundColor: colors.card, borderRadius: radius.card, padding: 20, ...shadow.card, marginBottom: 16 },
    label: { fontSize: font.caption, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 8 },
    input: {
      backgroundColor: colors.bg,
      borderRadius: radius.small,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: font.body,
      color: colors.textPrimary,
      marginBottom: 10,
    },
    error: { color: colors.errorText, fontSize: font.caption, marginTop: 4, marginBottom: 8 },
    btn: {
      backgroundColor: colors.accentFill,
      borderRadius: radius.small,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },
    btnText: { color: colors.card, fontSize: font.body, fontWeight: '600' },
    statusCard: { backgroundColor: colors.accentSoft, borderRadius: radius.card, padding: 16, marginBottom: 16 },
    statusTitle: { fontSize: font.caption, fontWeight: '700', color: colors.accent, marginBottom: 10 },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
    statusText: { flex: 1, fontSize: font.caption, color: colors.textBody, lineHeight: 18 },
    hintCard: { backgroundColor: colors.accentSoft, borderRadius: radius.card, padding: 16 },
    hintTitle: { fontSize: font.caption, fontWeight: '700', color: colors.accent, marginBottom: 10 },
    hintRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
    hintText: { flex: 1, fontSize: font.caption, color: colors.textBody, lineHeight: 18 },
  });

function StatusIcon({ state }: { state: Step['state'] }) {
  const colors = useTheme();
  if (state === 'checking') return <ActivityIndicator size="small" color={colors.accent} />;
  if (state === 'ok') return <Ionicons name="checkmark-circle" size={18} color={colors.successText} />;
  if (state === 'fail') return <Ionicons name="close-circle" size={18} color={colors.errorText} />;
  return <Ionicons name="ellipse-outline" size={18} color={colors.textFaint} />;
}

export default function ConnectScreen() {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [baseUrl, setBaseUrl] = useState('');
  const [lanUrl, setLanUrl] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([
    { text: '检测内网地址', state: 'pending' },
    { text: '检测外网地址', state: 'pending' },
  ]);

  const setStep = (i: number, state: Step['state']) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, state } : s)));

  const connect = async () => {
    const url = baseUrl.trim().replace(/\/+$/, '');
    const lan = lanUrl.trim().replace(/\/+$/, '');
    const tk = token.trim();
    if (!url || !tk) {
      setError('请填写外网地址和连接口令');
      return;
    }
    setBusy(true);
    setError(null);
    setSteps([
      { text: lan ? '检测内网地址' : '未填内网地址，直接走外网', state: lan ? 'pending' : 'fail' },
      { text: '检测外网地址', state: 'pending' },
    ]);

    // 1. 先测内网（2 秒超时），通 → 用内网
    if (lan) {
      setStep(0, 'checking');
      const lanOk = await probeHealth(lan);
      if (lanOk) {
        setStep(0, 'ok');
        // 用内网验证 token（/api/health 免认证验证不了，用需鉴权的 /api/models）
        if (await probeAuth(lan, tk)) {
          setStep(1, 'pending');
          setStep(1, 'ok');
          await saveConfig({ baseUrl: url, token: tk, lanBaseUrl: lan });
          router.replace('/');
          return;
        }
        setStep(1, 'checking');
        setError('内网可达但口令校验失败，继续检测外网…');
      } else {
        setStep(0, 'fail');
      }
    }

    // 2. 内网不可用 → 走外网
    setStep(1, 'checking');
    try {
      await api.health({ baseUrl: url, token: tk });
      setStep(1, 'ok');
      await saveConfig({ baseUrl: url, token: tk, lanBaseUrl: lan || undefined });
      router.replace('/');
    } catch {
      setStep(1, 'fail');
      setError('连接失败：内网与外网均无法连接，请检查地址、口令或桥接服务');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <AppLogo width={200} />
        </View>
        <Text style={styles.title}>连接你的电脑</Text>
        <Text style={styles.subtitle}>KAKU Hermes 通过你的电脑访问 Hermes</Text>

        <View style={styles.card}>
          <Text style={styles.label}>外网地址（公网）</Text>
          <TextInput
            style={styles.input}
            value={baseUrl}
            onChangeText={setBaseUrl}
            placeholder="http://www.你的域名.com:8787"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={styles.label}>内网地址（可选，同一 WiFi 时自动优先）</Text>
          <TextInput
            style={styles.input}
            value={lanUrl}
            onChangeText={setLanUrl}
            placeholder="http://192.168.x.x:8787"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={styles.label}>连接口令（Token，内外网共用）</Text>
          <TextInput
            style={styles.input}
            value={token}
            onChangeText={setToken}
            placeholder="粘贴桥接服务的 Token"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }, busy && { opacity: 0.6 }]}
            onPress={connect}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={styles.btnText}>连接</Text>
            )}
          </Pressable>
        </View>

        {busy ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>连接检测</Text>
            {steps.map((s, i) => (
              <View key={i} style={styles.statusRow}>
                <StatusIcon state={s.state} />
                <Text style={styles.statusText}>{s.text}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.hintCard}>
          <Text style={styles.hintTitle}>怎么填这些信息？</Text>
          <View style={styles.hintRow}>
            <Ionicons name="desktop-outline" size={16} color={colors.accent} />
            <Text style={styles.hintText}>外网地址：你域名的地址（如 http://www.你的域名.com:8787），任何网络都能用</Text>
          </View>
          <View style={styles.hintRow}>
            <Ionicons name="wifi-outline" size={16} color={colors.accent} />
            <Text style={styles.hintText}>内网地址：和电脑/NAS 同一 WiFi 时的地址（如 http://192.168.x.x:8787）。App 会先试内网，连不上自动切外网，避开公网回环问题</Text>
          </View>
          <View style={styles.hintRow}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.accent} />
            <Text style={styles.hintText}>口令：桥接服务启动时显示的 Token（内外网共用同一个）</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
