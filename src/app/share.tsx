// src/app/share.tsx —— 分享扩展：发送到会话（预览 + 选会话 + 可选文字 + 发送）
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ConversationList } from '../components/conversation-list';
import { api, type Attachment } from '../lib/api';
import { contentForSend } from '../lib/chat-prompt';
import { UploadTooLargeError } from '../lib/upload-limits';
import { connection } from '../lib/connection';
import { getConfig, type ConnConfig } from '../lib/storage';
import { getIncomingShare, resetIncomingShare, subscribeIncoming, type IncomingShare } from '../lib/share-intent';
import { createDefaultShareTarget, shouldLeaveShareAfterBridgeAccepts } from '../lib/share-target';
import { font, radius, type Colors, type FontTokens } from '../lib/theme';
import { useFont, useTheme } from '../lib/theme-context';

const createStyles = (colors: Colors, font: FontTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
    errText: { color: colors.textSecondary, fontSize: font.body, textAlign: 'center' },
    // 预览区
    preview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginHorizontal: 12,
      marginTop: 12,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
    },
    pvThumb: { width: 46, height: 46, borderRadius: 10 },
    pvFile: {
      width: 46,
      height: 46,
      borderRadius: 10,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pvMain: { flex: 1, minWidth: 0 },
    pvName: { fontSize: font.body, fontWeight: '600', color: colors.textPrimary },
    pvMeta: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
    pvText: { fontSize: font.body, color: colors.textBody, lineHeight: 20 },
    // 会话列表
    listTitle: { fontSize: font.tiny, fontWeight: '700', letterSpacing: 1, color: colors.textMuted, marginTop: 14, marginBottom: 6, marginLeft: 16 },
    listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginRight: 16 },
    newChat: { color: colors.accent, fontSize: font.caption, fontWeight: '600' },
    // 底部发送
    bottom: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.bg },
    sendBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    input: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radius.card,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: font.body,
      color: colors.textPrimary,
      maxHeight: 90,
    },
    sendBtn: {
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: radius.card,
      backgroundColor: colors.accentFill,
      alignItems: 'center',
    },
    sendText: { color: colors.card, fontSize: font.body, fontWeight: '700' },
    sendDisabled: { backgroundColor: colors.textFaint },
  });

export default function ShareScreen() {
  const colors = useTheme();
  const font = useFont();
  const styles = useMemo(() => createStyles(colors, font), [colors, font]);
  const router = useRouter();
  const [config, setConfig] = useState<ConnConfig | null>(null);
  const [incoming, setIncoming] = useState<IncomingShare | null>(() => getIncomingShare());
  const [selectedId, setSelectedId] = useState<string>(() => createDefaultShareTarget());
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getConfig().then((cfg) => {
      if (!cfg) {
        router.replace('/connect');
        return;
      }
      setConfig(cfg);
      connection.ensureStarted(cfg);
    });
  }, [router]);

  useEffect(
    () =>
      subscribeIncoming(() => {
        setIncoming(getIncomingShare());
        setSelectedId(createDefaultShareTarget());
      }),
    []
  );

  const firstFile = incoming?.files?.[0];
  const preview = useMemo(() => {
    if (firstFile) {
      return { kind: 'file' as const, name: firstFile.fileName || '附件', size: firstFile.size, path: firstFile.path, mime: firstFile.mimeType || '' };
    }
    const shared = incoming?.webUrl || incoming?.text;
    if (shared) return { kind: 'text' as const, text: shared };
    return null;
  }, [firstFile, incoming]);

  const buildContent = useCallback(() => {
    const typed = note.trim();
    if (firstFile) {
      // 纯文件/纯图片/混合：无备注时补默认提示词（与对话页、bridge 一致，避免空正文被丢弃）
      const files = incoming?.files ?? [];
      const hasImage = files.some((f) => (f.mimeType || '').startsWith('image/'));
      const hasFile = files.some((f) => !(f.mimeType || '').startsWith('image/'));
      return contentForSend(typed, hasImage, hasFile);
    }
    const shared = incoming?.webUrl || incoming?.text || '';
    return [typed, shared].filter(Boolean).join('\n');
  }, [note, firstFile, incoming]);

  const send = useCallback(async () => {
    if (!config || !selectedId || sending) return;
    setSending(true);
    const uploaded: { kind: 'image' | 'file'; fileId: string }[] = [];
    for (const f of incoming?.files ?? []) {
      const kind = (f.mimeType || '').startsWith('image/') ? 'image' : 'file';
      try {
        const u = await api.upload(config, f.path, f.fileName || '附件', kind);
        uploaded.push({ kind: u.kind, fileId: u.fileId });
      } catch (e: any) {
        setSending(false);
        Alert.alert('附件上传失败', e instanceof UploadTooLargeError ? e.message : f.fileName || '文件');
        return; // 留在本页，不清空用户选择
      }
    }
    const content = buildContent();
    const reqId = 'share-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const ok = connection.send({ reqId, content, sessionId: selectedId, attachments: uploaded });
    if (!ok) {
      setSending(false);
      Alert.alert('发送失败', '请检查与电脑的连接');
      return;
    }
    // Bridge 已接受后由后台继续交付；立刻返回首页，避免分享扩展因等待 complete 停在“发送中”。
    if (shouldLeaveShareAfterBridgeAccepts()) {
      resetIncomingShare();
      router.replace('/');
    }
  }, [config, selectedId, sending, incoming, buildContent, router]);

  if (!incoming || !preview) {
    return (
      <View style={styles.center}>
        <Ionicons name="share-outline" size={32} color={colors.textFaint} />
        <Text style={styles.errText}>没有收到分享内容，请从相册/文件/浏览器重新分享</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* 预览 */}
      <View style={styles.preview}>
        {preview.kind === 'file' && preview.mime.startsWith('image/') ? (
          <Image source={{ uri: preview.path }} style={styles.pvThumb} />
        ) : preview.kind === 'file' ? (
          <View style={styles.pvFile}>
            <Ionicons name="document-outline" size={20} color={colors.accent} />
          </View>
        ) : (
          <View style={styles.pvFile}>
            <Ionicons name="link-outline" size={20} color={colors.accent} />
          </View>
        )}
        <View style={styles.pvMain}>
          {preview.kind === 'text' ? (
            <Text style={styles.pvText} numberOfLines={2}>
              {preview.text}
            </Text>
          ) : (
            <>
              <Text style={styles.pvName} numberOfLines={1}>
                {preview.name}
              </Text>
              <Text style={styles.pvMeta} numberOfLines={1}>
                {preview.size ? `${(preview.size / 1024 / 1024).toFixed(1)} MB · ` : ''}来自「分享」
              </Text>
            </>
          )}
        </View>
      </View>

      {/* 会话列表 */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>发送到会话</Text>
        <Pressable onPress={() => setSelectedId(createDefaultShareTarget())} hitSlop={8} accessibilityLabel="新建会话">
          <Text style={styles.newChat}>新建会话</Text>
        </Pressable>
      </View>
      <View style={styles.flex}>
        {config ? (
          <ConversationList
            config={config}
            showActions={false}
            selectedId={selectedId ?? undefined}
            onSelect={(id) => setSelectedId(id)}
          />
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}
      </View>

      {/* 底部：可选文字 + 发送 */}
      <View style={styles.bottom}>
        <View style={styles.sendBar}>
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            placeholder="加一句说明（可选）…"
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <Pressable
            style={[styles.sendBtn, sending && styles.sendDisabled]}
            onPress={send}
            disabled={sending}
            accessibilityLabel="发送"
          >
            <Text style={styles.sendText}>{sending ? '发送中…' : '发送'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
