// src/components/message-bubble.tsx —— 消息气泡（明暗自适应）
// v1.0.13：支持历史消息附件渲染（@image/@file 标记 → 缩略图/文件芯片）+ 隐藏 Hermes 图片长描述
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Attachment, Message } from '../lib/api';
import { radius, shadow, type Colors, type FontTokens } from '../lib/theme';
import { useFont, useTheme } from '../lib/theme-context';
import { MarkdownText } from './markdown';
import { hasMarkdown } from '../lib/markdown-detect';

// 解析历史用户消息：提取 @image:<路径> / @file:<路径> 的 fileId（basename），返回清理后正文
function parseContentAttachments(content: string) {
  const images: string[] = [];
  const files: string[] = [];
  const text = String(content || '')
    .replace(/@image:(\S+)/g, (_m, p) => {
      images.push(p.split(/[\\/]/).pop() || '');
      return '';
    })
    .replace(/@file:(\S+)/g, (_m, p) => {
      files.push(p.split(/[\\/]/).pop() || '');
      return '';
    })
    .replace(/\s+/g, ' ')
    .trim();
  return { images, files, text };
}

const createStyles = (colors: Colors, font: FontTokens) =>
  StyleSheet.create({
    row: { flexDirection: 'row', marginBottom: 12 },
    rowUser: { justifyContent: 'flex-end', alignItems: 'flex-end' },
    rowAssistant: { justifyContent: 'flex-start', alignItems: 'flex-start' },
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
    // 附件区（用户气泡内）
    attRows: { gap: 6, marginBottom: 6 },
    attThumb: { width: 160, height: 100, borderRadius: 10 },
    attFile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      padding: 8,
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderRadius: 10,
    },
    attFileText: { color: colors.card, fontSize: font.tiny, flex: 1 },
  });

export function MessageBubble({
  message,
  isStreaming,
  onImagePress,
  onAttachmentPress,
  onFetchUpload,
  onOpenHistoryFile,
}: {
  message: Message;
  isStreaming?: boolean;
  onImagePress?: (uri: string) => void;
  onAttachmentPress?: (a: Attachment) => void;
  /** 拉取历史附件为 base64 data URL（图片缩略图用） */
  onFetchUpload?: (fileId: string) => Promise<string>;
  /** 打开历史文件（下载到缓存后分享） */
  onOpenHistoryFile?: (fileId: string, name: string) => void;
}) {
  const colors = useTheme();
  const font = useFont();
  const styles = useMemo(() => createStyles(colors, font), [colors, font]);
  const isUser = message.role === 'user';
  // 空的 assistant 消息（非流式中）不渲染：避免残留 "（空回复）"/空白气泡（如工具调用产生的空消息）
  if (!isUser && !message.content && !isStreaming) return null;
  const fallback = message.content || '';
  const plain = !hasMarkdown(fallback);

  // 历史图片缩略图：异步拉取 data URL（用 ref 持有 onFetchUpload，effect 只依赖内容，杜绝无限循环）
  const fetchUploadRef = useRef(onFetchUpload);
  fetchUploadRef.current = onFetchUpload;
  const [histImages, setHistImages] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!isUser) return;
    const { images } = parseContentAttachments(message.content || '');
    if (!images.length || !fetchUploadRef.current) return;
    let alive = true;
    images.forEach((fid) => {
      fetchUploadRef.current!(fid)
        .then((u) => {
          if (alive) setHistImages((prev) => ({ ...prev, [fid]: u }));
        })
        .catch(() => {});
    });
    return () => {
      alive = false;
    };
  }, [message.content, isUser]);

  const { images: histImageIds, files: histFiles, text } = useMemo(
    () => (isUser ? parseContentAttachments(message.content || '') : { images: [] as string[], files: [] as string[], text: fallback }),
    [isUser, message.content, fallback]
  );
  // Hermes 处理图片时把用户消息替换成 "[The user attached an image...]" 长描述 → 隐藏
  const isImgDump = isUser && /\[The user attached an image/i.test(message.content || '');
  const displayText = isImgDump ? '' : text;

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
        {/* 历史图片缩略图（点击全屏） */}
        {histImageIds.map(
          (fid) =>
            histImages[fid] ? (
              <Pressable key={fid} onPress={() => onImagePress?.(histImages[fid])} accessibilityLabel="图片">
                <Image source={{ uri: histImages[fid] }} style={styles.attThumb} />
              </Pressable>
            ) : null
        )}
        {/* 历史文件芯片（点击打开/分享） */}
        {histFiles.map((fid) => {
          const clean = fid.replace(/^\d+_/, '') || '附件';
          return (
            <Pressable key={fid} style={styles.attFile} onPress={() => onOpenHistoryFile?.(fid, clean)} accessibilityLabel={clean}>
              <Ionicons name="document-outline" size={14} color={colors.card} />
              <Text style={styles.attFileText} numberOfLines={1}>
                {clean}
              </Text>
            </Pressable>
          );
        })}
        {/* 历史图片消息无缩略图（dump 或旧标记丢失）→ 占位 */}
        {isUser && histImageIds.length === 0 && isImgDump ? (
          <View style={styles.attFile}>
            <Ionicons name="image-outline" size={14} color={colors.card} />
            <Text style={styles.attFileText}>🖼 图片</Text>
          </View>
        ) : null}
        {/* 乐观附件（刚发送/本机已有） */}
        {isUser && message.attachments?.length ? (
          <View style={styles.attRows}>
            {message.attachments.map((a, i) => (
              <Pressable key={i} onPress={() => onAttachmentPress?.(a)} accessibilityLabel={a.name}>
                {a.kind === 'image' && a.uri ? (
                  <Image source={{ uri: a.uri }} style={styles.attThumb} />
                ) : (
                  <View style={styles.attFile}>
                    <Ionicons name="document-outline" size={14} color={colors.card} />
                    <Text style={styles.attFileText} numberOfLines={1}>
                      {a.name}
                    </Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        ) : null}
        {isUser ? (
          displayText ? (
            <Text selectable style={styles.userText}>
              {displayText}
            </Text>
          ) : null
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
