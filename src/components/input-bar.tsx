// src/components/input-bar.tsx —— 文字输入 + 语音 + 发送（明暗自适应）
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech-recognition';
import { radius, shadow, type Colors, type FontTokens } from '../lib/theme';
import { useFont, useTheme } from '../lib/theme-context';

const SpeechModule = Speech.ExpoSpeechRecognitionModule;

const createStyles = (colors: Colors, font: FontTokens) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.bg },
    hint: {
      color: colors.warningText,
      fontSize: font.tiny,
      marginBottom: 6,
      paddingHorizontal: 4,
    },
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
  });

export function InputBar({
  onSend,
  disabled,
  online,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  online: boolean;
}) {
  const colors = useTheme();
  const font = useFont();
  const styles = useMemo(() => createStyles(colors, font), [colors, font]);
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const send = useCallback(() => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
  }, [text, disabled, onSend]);

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
      <View style={styles.bar}>
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
          disabled={!text.trim() || !online}
          style={[styles.sendBtn, (!text.trim() || !online) && styles.sendDisabled]}
          accessibilityLabel="发送"
        >
          <Ionicons name="arrow-up" size={20} color={colors.card} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
