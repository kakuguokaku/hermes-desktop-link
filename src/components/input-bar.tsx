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
import * as Speech from 'expo-speech-recognition';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import type { Attachment } from '../lib/api';
import { radius, shadow, type Colors, type FontTokens } from '../lib/theme';
import { useFont, useTheme } from '../lib/theme-context';

const SpeechModule = Speech.ExpoSpeechRecognitionModule;

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
    // 待发附件区
    attachList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
    attachChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 6,
      paddingHorizontal: 8,
      maxWidth: 200,
    },
    attachThumb: { width: 26, height: 26, borderRadius: 6 },
    attachName: { fontSize: font.tiny, color: colors.textPrimary, maxWidth: 120 },
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
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  online: boolean;
  attachments?: Attachment[];
  onAttachmentsChange?: (a: Attachment[]) => void;
  onPreviewAttachment?: (a: Attachment) => void;
}) {
  const colors = useTheme();
  const font = useFont();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, font), [colors, font]);
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const [localAtts, setLocalAtts] = useState<Attachment[]>(attachments ?? []);
  const [menuOpen, setMenuOpen] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setLocalAtts(attachments ?? []), [attachments]);
  useEffect(() => onAttachmentsChange?.(localAtts), [localAtts, onAttachmentsChange]);

  const showHint = useCallback((msg: string) => {
    setVoiceHint(msg);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setVoiceHint(null), 2500);
  }, []);

  // 识别结果写入输入框
  Speech.useSpeechRecognitionEvent('result', (ev) => {
    const t = ev?.results?.[0]?.transcript;
    if (t) setText(t);
  });
  // 识别结束/出错复位
  Speech.useSpeechRecognitionEvent('end', () => setListening(false));
  Speech.useSpeechRecognitionEvent('error', (ev) => {
    setListening(false);
    showHint(`语音不可用：${ev?.message || ev?.error || '识别失败'}`);
  });

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

  const send = useCallback(() => {
    const t = text.trim();
    if ((!t && localAtts.length === 0) || disabled) return;
    onSend(t);
    setText('');
    setLocalAtts([]); // 发送后清空待发附件
  }, [text, localAtts, disabled, onSend]);

  const canSend = text.trim().length > 0 || localAtts.length > 0;

  const toggleMic = useCallback(async () => {
    try {
      if (listening) {
        SpeechModule.stop();
        setListening(false);
        return;
      }
      if (!SpeechModule.isRecognitionAvailable()) {
        showHint('当前环境暂不支持语音输入');
        return;
      }
      const perm = await SpeechModule.requestPermissionsAsync();
      if (!perm.granted) {
        showHint('需要麦克风权限');
        return;
      }
      setListening(true);
      SpeechModule.start({ lang: 'zh-CN', interimResults: true, continuous: false });
    } catch (e: any) {
      setListening(false);
      showHint(`语音不可用：${String(e?.message || e)}`);
    }
  }, [listening, showHint]);

  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
      try {
        SpeechModule.stop();
      } catch {}
    };
  }, []);

  return (
    <View style={styles.wrap}>
      {voiceHint ? <Text style={styles.hint}>{voiceHint}</Text> : null}
      {localAtts.length > 0 ? (
        <View style={styles.attachList}>
          {localAtts.map((a, i) => (
            <View key={i} style={styles.attachChip}>
              {a.kind === 'image' && a.uri ? (
                <Pressable onPress={() => onPreviewAttachment?.(a)} accessibilityLabel="预览附件">
                  <Image source={{ uri: a.uri }} style={styles.attachThumb} />
                </Pressable>
              ) : (
                <Ionicons name="document-outline" size={14} color={colors.accent} />
              )}
              <Text style={styles.attachName} numberOfLines={1}>
                {a.name}
              </Text>
              <Pressable onPress={() => removeAtt(i)} hitSlop={8} accessibilityLabel="移除附件">
                <Ionicons name="close" size={14} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.bar}>
        <Pressable
          style={[styles.attachBtn, menuOpen && styles.attachBtnActive]}
          onPress={openAttachMenu}
          accessibilityLabel="插入附件"
        >
          <Ionicons name="add" size={24} color={menuOpen ? colors.card : colors.accent} />
        </Pressable>
        <TouchableOpacity
          onPress={toggleMic}
          style={[styles.iconBtn, listening && styles.micActive]}
          accessibilityLabel="语音输入"
        >
          <Ionicons
            name={listening ? 'mic' : 'mic-outline'}
            size={22}
            color={listening ? colors.card : colors.textSecondary}
          />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={online ? '输入消息...' : '电脑未连接'}
          placeholderTextColor={colors.textMuted}
          multiline
          editable={online}
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
