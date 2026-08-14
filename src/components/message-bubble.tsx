// src/components/message-bubble.tsx —— 消息气泡（明暗自适应）
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Message } from '../lib/api';
import { radius, shadow, type Colors, type FontTokens } from '../lib/theme';
import { useFont, useTheme } from '../lib/theme-context';
import { MarkdownText } from './markdown';
import { hasMarkdown } from '../lib/markdown-detect';

const createStyles = (colors: Colors, font: FontTokens) =>
  StyleSheet.create({
    row: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
    rowUser: { justifyContent: 'flex-end' },
    rowAssistant: { justifyContent: 'flex-start' },
    avatar: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.accentFill,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
      marginBottom: 2,
    },
    bubble: {
      maxWidth: '82%',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    bubbleUser: {
      backgroundColor: colors.accentFill,
      borderRadius: radius.bubble,
      borderBottomRightRadius: 6,
    },
    bubbleAssistant: {
      backgroundColor: colors.card,
      borderRadius: radius.bubble,
      borderBottomLeftRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
    },
    userText: { color: colors.card, fontSize: font.body, lineHeight: 22 },
    assistantPlainText: { color: colors.textBody, fontSize: font.body, lineHeight: 22 },
    typing: { flexDirection: 'row', paddingVertical: 6 },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.textMuted,
      marginRight: 4,
    },
  });

export function MessageBubble({
  message,
  isStreaming,
  onImagePress,
}: {
  message: Message;
  isStreaming?: boolean;
  onImagePress?: (uri: string) => void;
}) {
  const colors = useTheme();
  const font = useFont();
  const styles = useMemo(() => createStyles(colors, font), [colors, font]);
  const isUser = message.role === 'user';
  // 空的 assistant 消息（非流式中）不渲染：避免残留 "（空回复）"/空白气泡（如工具调用产生的空消息）
  if (!isUser && !message.content && !isStreaming) return null;
  const fallback = message.content || '';
  const plain = !hasMarkdown(fallback);
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={14} color={colors.card} />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          isUser ? null : shadow.card,
        ]}
      >
        {isUser ? (
          <Text selectable style={styles.userText}>
            {message.content}
          </Text>
        ) : fallback.length > 0 ? (
          plain ? (
            <Text selectable style={styles.assistantPlainText}>
              {fallback}
            </Text>
          ) : (
            <MarkdownText onImagePress={onImagePress}>{fallback}</MarkdownText>
          )
        ) : null}
        {isStreaming && message.content.length === 0 && (
          <View style={styles.typing}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.dot, { opacity: 0.4 + i * 0.3 }]} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
