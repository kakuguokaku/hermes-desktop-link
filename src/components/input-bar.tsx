// src/components/input-bar.tsx —— 文字输入 + 语音 + 发送（明暗自适应）
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, shadow, type Colors } from '../lib/theme';
import { useTheme } from '../lib/theme-context';

// 语音识别（expo-speech-recognition）；不可用时静默降级
let speechLib: any = null;
try {
  speechLib = require('expo-speech-recognition');
} catch {
  speechLib = null;
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.bg },
    hint: {
      color: colors.warningText,
      fontSize: 11,
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
      fontSize: 15,
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
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const speechRef = useRef<any>(null);

  const send = useCallback(() => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
  }, [text, disabled, onSend]);

  const toggleMic = useCallback(async () => {
    if (!speechLib) {
      setVoiceHint('当前环境暂不支持语音输入');
      setTimeout(() => setVoiceHint(null), 2000);
      return;
    }
    try {
      if (listening) {
        await speechLib.stopSpeechRecognition();
        setListening(false);
        return;
      }
      const perm = await speechLib.requestPermissionsAsync();
      if (!perm.granted) {
        setVoiceHint('需要麦克风权限');
        setTimeout(() => setVoiceHint(null), 2000);
        return;
      }
      setListening(true);
      const r = await speechLib.startSpeechRecognition({
        lang: 'zh-CN',
        interimResults: true,
        onResult: (ev: any) => {
          if (ev?.results && ev.results[0] && ev.results[0].transcript) {
            setText(ev.results[0].transcript);
          }
        },
      });
      speechRef.current = r;
      setListening(false);
    } catch (e: any) {
      setListening(false);
      setVoiceHint(`语音不可用：${String(e?.message || e)}`);
      setTimeout(() => setVoiceHint(null), 2500);
    }
  }, [listening]);

  useEffect(() => {
    return () => {
      if (speechRef.current && typeof speechLib?.stopSpeechRecognition === 'function') {
        speechLib.stopSpeechRecognition().catch(() => {});
      }
    };
  }, []);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
    </KeyboardAvoidingView>
  );
}
