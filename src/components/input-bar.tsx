// src/components/input-bar.tsx —— 文字输入 + 语音 + 附件 + 发送（明暗自适应）
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as LegacyFS from 'expo-file-system/legacy';
import type { Attachment } from '../lib/api';
import { formatBytes } from '../lib/upload-limits';
import { radius, shadow, type Colors, type FontTokens } from '../lib/theme';
import { useFont, useTheme } from '../lib/theme-context';

/** 取文件扩展名（用于文件卡片类型标识） */
function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1) : '';
}

const createStyles = (colors: Colors, font: FontTokens) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.bg },
    // 弹层容器：占满屏、内容靠底，sheet 才在屏幕底部弹出
    sheetWrap: { flex: 1, justifyContent: 'flex-end' },
    hint: {
      color: colors.warningText,
      fontSize: font.tiny,
      marginBottom: 6,
      paddingHorizontal: 4,
    },
    // 待发附件区（独立卡片：图片 72×72 缩略图 / 文件图标 + 名称两行 + 大小 + 移除）
    attachList: { gap: 8, paddingBottom: 8 },
    attachCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 8,
    },
    attachThumb: { width: 72, height: 72, borderRadius: 10 },
    attachFileIcon: {
      width: 72,
      height: 72,
      borderRadius: 10,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attachInfo: { flex: 1, minWidth: 0 },
    attachName: { fontSize: font.body, fontWeight: '600', color: colors.textPrimary, lineHeight: 18 },
    attachMeta: { fontSize: font.tiny, color: colors.textMuted, marginTop: 3 },
    attachRemove: { padding: 4 },
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: colors.card,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 6,
      ...shadow.card,
    },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attachBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    micActive: { backgroundColor: colors.accentFill },
    input: {
      flex: 1,
      fontSize: font.body + 1,
      color: colors.textPrimary,
      maxHeight: 110,
      paddingVertical: 6,
      paddingHorizontal: 6,
    },
    sendBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.accentFill,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 6,
    },
    sendDisabled: { backgroundColor: colors.textFaint },
    // 底部附件菜单（按效果图：拖拽把手 + 标题 + 三图标横向）
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 10,
      ...shadow.card,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 4,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: 14,
    },
    sheetTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 12,
    },
    sheetOps: { flexDirection: 'row', gap: 10 },
    op: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.borderSubtle,
    },
    opIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    opLabel: { fontSize: font.tiny, color: colors.textPrimary },
    attachBtnActive: { backgroundColor: colors.accentFill },
  });

export function InputBar({
  onSend,
  disabled,
  online,
  attachments,
  onAttachmentsChange,
  onPreviewAttachment,
  onSendVoice,
  resetEpoch = 0,
}: {
  /** 返回是否已被父层接管；发送后由 resetEpoch 在请求结束时统一清空草稿。 */
  onSend: (text: string) => boolean | Promise<boolean>;
  disabled?: boolean;
  online: boolean;
  attachments?: Attachment[];
  onAttachmentsChange?: (a: Attachment[]) => void;
  onPreviewAttachment?: (a: Attachment) => void;
  /** 语音直传：录完一段语音立即发送（按住录音/松开发送/上滑取消） */
  onSendVoice?: (uri: string, name: string) => void;
  /** 请求结束后由父层递增，避免发送开始时重置原生输入组件。 */
  resetEpoch?: number;
}) {
  const colors = useTheme();
  const font = useFont();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, font), [colors, font]);
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const [localAtts, setLocalAtts] = useState<Attachment[]>(attachments ?? []);
  const [menuOpen, setMenuOpen] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousResetEpoch = useRef(resetEpoch);

  useEffect(() => setLocalAtts(attachments ?? []), [attachments]);
  useEffect(() => onAttachmentsChange?.(localAtts), [localAtts, onAttachmentsChange]);
  useEffect(() => {
    if (previousResetEpoch.current === resetEpoch) return;
    previousResetEpoch.current = resetEpoch;
    setText('');
    setLocalAtts([]);
  }, [resetEpoch]);

  const showHint = useCallback((msg: string) => {
    setVoiceHint(msg);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setVoiceHint(null), 2500);
  }, []);

  // 语音直传：按住录音、松开发送、上滑取消（Hermes 侧 faster-whisper 转写理解）
  // 录音状态机：idle → preparing → recording → stopping → idle（preparing/stopping 期间忽略重复触发）
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const voicePhase = useRef<'idle' | 'preparing' | 'recording' | 'stopping'>( 'idle' );
  const pressY = useRef(0);
  const cancelledRef = useRef(false);
  const [cancelling, setCancelling] = useState(false);
  const onSendVoiceRef = useRef(onSendVoice);
  onSendVoiceRef.current = onSendVoice;

  const startVoice = useCallback(async () => {
    if (voicePhase.current !== 'idle') return;
    voicePhase.current = 'preparing';
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        voicePhase.current = 'idle';
        showHint('需要麦克风权限');
        return;
      }
      // 必须先切音频会话（静音模式可播放 + 允许录音），再 prepare，否则 iOS 报 Recording not allowed
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      if (voicePhase.current !== 'preparing') {
        // 松手太快：取消本次录音
        try { await recorder.stop(); } catch {}
        voicePhase.current = 'idle';
        return;
      }
      recorder.record();
      voicePhase.current = 'recording';
      setRecording(true);
      cancelledRef.current = false;
      setCancelling(false);
      setVoiceHint('松开发送 · 上滑取消');
    } catch (e: any) {
      voicePhase.current = 'idle';
      setRecording(false);
      showHint('录音启动失败：' + String(e?.message || e));
    }
  }, [recorder, showHint]);

  const stopVoice = useCallback(
    async (cancel: boolean) => {
      if (voicePhase.current === 'preparing') {
        // prepare 未完成就松手：标记取消，等 prepare 返回后由 startVoice 收尾
        voicePhase.current = 'idle';
        setRecording(false);
        setVoiceHint(null);
        setCancelling(false);
        return;
      }
      if (voicePhase.current !== 'recording') return;
      voicePhase.current = 'stopping';
      setRecording(false);
      setVoiceHint(null);
      setCancelling(false);
      try {
        await recorder.stop();
      } catch {}
      voicePhase.current = 'idle';
      if (cancel) {
        showHint('已取消');
        return;
      }
      const uri = recorder.uri;
      if (!uri) {
        showHint('没有录到声音');
        return;
      }
      // 确认文件存在且非空，再交给上传
      try {
        const info = await LegacyFS.getInfoAsync(uri);
        if (!info.exists || !info.size) {
          showHint('没有录到声音');
          return;
        }
      } catch {
        // 读取失败也放行，交给上传流程
      }
      const name = '语音_' + Date.now() + '.m4a';
      onSendVoiceRef.current?.(uri, name);
    },
    [recorder, showHint]
  );

  const endVoice = useCallback(() => {
    const cancel = cancelledRef.current || cancelling;
    cancelledRef.current = false;
    stopVoice(cancel);
  }, [cancelling, stopVoice]);

  const pickCamera = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('需要相机权限');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!r.canceled) {
      const a = r.assets[0];
      setLocalAtts((p) => [...p, { kind: 'image', name: a.fileName || '拍照.jpg', uri: a.uri, size: a.fileSize }]);
    }
  }, []);

  const pickAlbum = useCallback(async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!r.canceled) {
      const a = r.assets[0];
      setLocalAtts((p) => [...p, { kind: 'image', name: a.fileName || '照片.jpg', uri: a.uri, size: a.fileSize }]);
    }
  }, []);

  const pickFile = useCallback(async () => {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (!r.canceled) {
      const a = r.assets[0];
      setLocalAtts((p) => [...p, { kind: 'file', name: a.name || '文件', uri: a.uri, size: a.size }]);
    }
  }, []);

  const openAttachMenu = useCallback(() => setMenuOpen(true), []);
  const closeAttachMenu = useCallback(() => setMenuOpen(false), []);
  // iOS：选完再开系统选择器，等 Modal 完全收起（onDismiss）避免「presentation in progress」
  const pendingPick = useRef<(() => void) | null>(null);
  const pickAfterClose = useCallback((fn: () => void) => {
    if (Platform.OS !== 'ios') {
      fn(); // Android Modal 无 onDismiss，直接开选择器
      return;
    }
    pendingPick.current = fn;
    setMenuOpen(false);
  }, []);
  const onSheetDismiss = useCallback(() => {
    const fn = pendingPick.current;
    pendingPick.current = null;
    if (fn) fn();
  }, []);

  const removeAtt = useCallback((idx: number) => {
    setLocalAtts((p) => p.filter((_, i) => i !== idx));
  }, []);

  // 发送开始时不改动输入区：iOS Fabric 会在同一批更新中新增消息并回收 TextInput，
  // 附件/草稿会在 bridge 完成该请求后由 resetEpoch 统一清理。
  const send = useCallback(async () => {
    const t = text.trim();
    if ((!t && localAtts.length === 0) || disabled) return;
    await onSend(t);
  }, [text, localAtts, disabled, onSend]);

  const canSend = text.trim().length > 0 || localAtts.length > 0;

  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
      voicePhase.current = 'idle';
      try {
        recorder.stop();
      } catch {}
    };
  }, [recorder]);

  return (
    <View style={styles.wrap}>
      {voiceHint ? <Text style={styles.hint}>{voiceHint}</Text> : null}
      <View style={[styles.attachList, localAtts.length === 0 && { paddingBottom: 0 }]}>
          {localAtts.map((a, i) => (
            <View key={i} style={styles.attachCard}>
              <Pressable
                onPress={() => (a.kind === 'image' && a.uri ? onPreviewAttachment?.(a) : undefined)}
                accessibilityLabel="预览附件"
              >
                {a.kind === 'image' && a.uri ? (
                  <Image source={{ uri: a.uri }} style={styles.attachThumb} />
                ) : (
                  <View style={styles.attachFileIcon}>
                    <Ionicons name="document-text-outline" size={26} color={colors.accent} />
                  </View>
                )}
              </Pressable>
              <View style={styles.attachInfo}>
                <Text style={styles.attachName} numberOfLines={2}>
                  {a.name}
                </Text>
                <Text style={styles.attachMeta} numberOfLines={1}>
                  {a.kind === 'image' ? '图片' : (extOf(a.name) || '文件').toUpperCase()}
                  {a.size ? ' · ' + formatBytes(a.size) : ''}
                </Text>
              </View>
              <Pressable onPress={() => removeAtt(i)} hitSlop={8} style={styles.attachRemove} accessibilityLabel="移除附件">
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
      </View>
      <View style={styles.bar}>
        <Pressable
          style={[styles.attachBtn, menuOpen && styles.attachBtnActive]}
          onPress={openAttachMenu}
          accessibilityLabel="插入附件"
        >
          <Ionicons name="add" size={24} color={menuOpen ? colors.card : colors.accent} />
        </Pressable>
        <View
          style={[styles.iconBtn, recording && styles.micActive]}
          accessibilityLabel="按住录音"
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => {
            pressY.current = e.nativeEvent.pageY;
            cancelledRef.current = false;
            startVoice();
          }}
          onResponderMove={(e) => {
            const dy = pressY.current - e.nativeEvent.pageY;
            const now = dy > 60;
            if (now !== cancelling) {
              setCancelling(now);
              if (now) setVoiceHint('松开取消');
            }
          }}
          onResponderRelease={(e) => {
            const dy = pressY.current - e.nativeEvent.pageY;
            cancelledRef.current = dy > 60 || cancelling;
            endVoice();
          }}
          onResponderTerminate={() => {
            cancelledRef.current = true;
            endVoice();
          }}
        >
          <Ionicons
            name={recording ? 'mic' : 'mic-outline'}
            size={22}
            color={recording ? colors.card : colors.textSecondary}
          />
        </View>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={online ? '输入消息...' : '电脑未连接'}
          placeholderTextColor={colors.textMuted}
          multiline
          editable={online && !disabled}
        />
        <TouchableOpacity
          onPress={send}
          disabled={!canSend || !online}
          style={[styles.sendBtn, (!canSend || !online) && styles.sendDisabled]}
          accessibilityLabel="发送"
        >
          <Ionicons name="arrow-up" size={20} color={colors.card} />
        </TouchableOpacity>
      </View>

      {/* 附件底部菜单：拖拽把手 + 标题 + 三图标（拍照/相册/文件），点遮罩关闭 */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="slide"
        onRequestClose={closeAttachMenu}
        onDismiss={onSheetDismiss}
      >
        <View style={styles.sheetWrap}>
          <Pressable style={styles.backdrop} onPress={closeAttachMenu} accessibilityLabel="关闭附件菜单" />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>插入附件</Text>
            <View style={styles.sheetOps}>
              <Pressable
                style={styles.op}
                onPress={() => pickAfterClose(pickCamera)}
                accessibilityLabel="拍照"
              >
                <View style={styles.opIcon}>
                  <Ionicons name="camera-outline" size={16} color={colors.accent} />
                </View>
                <Text style={styles.opLabel}>拍照</Text>
              </Pressable>
              <Pressable
                style={styles.op}
                onPress={() => pickAfterClose(pickAlbum)}
                accessibilityLabel="相册"
              >
                <View style={styles.opIcon}>
                  <Ionicons name="images-outline" size={16} color={colors.accent} />
                </View>
                <Text style={styles.opLabel}>相册</Text>
              </Pressable>
              <Pressable
                style={styles.op}
                onPress={() => pickAfterClose(pickFile)}
                accessibilityLabel="文件"
              >
                <View style={styles.opIcon}>
                  <Ionicons name="document-outline" size={16} color={colors.accent} />
                </View>
                <Text style={styles.opLabel}>文件</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
