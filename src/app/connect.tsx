// src/app/connect.tsx —— 首次连接设置（明暗自适应）
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
import { api } from '../lib/api';
import { saveConfig } from '../lib/storage';
import { font, radius, shadow, type Colors } from '../lib/theme';
import { useTheme } from '../lib/theme-context';
import { AppLogo } from '../components/app-logo';

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
    hintCard: { backgroundColor: colors.accentSoft, borderRadius: radius.card, padding: 16 },
    hintTitle: { fontSize: font.caption, fontWeight: '700', color: colors.accent, marginBottom: 10 },
    hintRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
    hintText: { flex: 1, fontSize: font.caption, color: colors.textBody, lineHeight: 18 },
  });

export default function ConnectScreen() {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    const url = baseUrl.trim().replace(/\/+$/, '');
    const tk = token.trim();
    if (!url || !tk) {
      setError('请填写电脑地址和连接口令');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.health({ baseUrl: url, token: tk });
      await saveConfig({ baseUrl: url, token: tk });
      router.replace('/');
    } catch {
      setError('连接失败：请确认地址、口令正确，且电脑上桥接服务已启动');
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
          <Text style={styles.label}>电脑地址</Text>
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
          <Text style={styles.label}>连接口令（Token）</Text>
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

        <View style={styles.hintCard}>
          <Text style={styles.hintTitle}>怎么填这些信息？</Text>
          <View style={styles.hintRow}>
            <Ionicons name="desktop-outline" size={16} color={colors.accent} />
            <Text style={styles.hintText}>电脑地址 = 你域名的地址（如 http://www.你的域名.com:8787），任何网络都能用</Text>
          </View>
          <View style={styles.hintRow}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.accent} />
            <Text style={styles.hintText}>口令：桥接服务启动时显示的 Token（bridge/config.json 里也有）</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
