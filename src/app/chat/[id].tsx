// src/app/chat/[id].tsx —— 对话页（流式 + 模型切换 + 语音 + 80% 历史面板，明暗自适应）
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ConversationList } from '../../components/conversation-list';
import { ImageViewer } from '../../components/image-viewer';
import { InputBar } from '../../components/input-bar';
import { MessageBubble } from '../../components/message-bubble';
import { ModelPicker } from '../../components/model-picker';
import {
  api,
  openStream,
  type Message,
  type Model,
  type SessionDetail,
  type StreamHandle,
} from '../../lib/api';
import { getConfig, getPrefs, savePrefs, type ConnConfig } from '../../lib/storage';
import { font, radius, type Colors } from '../../lib/theme';
import { useTheme } from '../../lib/theme-context';

const SESSION_RE = /^\d{8}_\d{6}_[A-Za-z0-9]+$/;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    errText: { color: colors.textSecondary, fontSize: font.body },
    offline: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.warningBg,
      paddingVertical: 6,
    },
    offlineText: { color: colors.warningText, fontSize: font.tiny },
    list: { padding: 14, paddingBottom: 8, flexGrow: 1 },
    empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
    emptyText: { color: colors.textMuted, fontSize: font.body },
    modelChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.accentSoft,
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.accentGlow,
      maxWidth: 170,
    },
    modelChipText: { color: colors.accent, fontSize: font.tiny, fontWeight: '600' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 2, marginRight: 8 },
    panelBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      flexDirection: 'row',
    },
    panel: {
      width: '80%',
      height: '100%',
      backgroundColor: colors.card,
    },
  });

export default function ChatScreen() {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';

  const [config, setConfig] = useState<ConnConfig | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(isNew ? null : (id ?? null));
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [models, setModels] = useState<Model[]>([]);
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [online, setOnline] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const [viewer, setViewer] = useState<{ visible: boolean; uri: string | null }>({
    visible: false,
    uri: null,
  });

  const listRef = useRef<FlatList<Message>>(null);
  const streamRef = useRef<StreamHandle | null>(null);
  const sessionIdRef = useRef<string | null>(sessionId);
  sessionIdRef.current = sessionId;
  const streamingRef = useRef(streaming);
  streamingRef.current = streaming;
  const stickToBottom = useRef(true); // 贴底跟随：用户上翻历史时不强制拉回

  // 初始化：配置、模型、会话内容、WS
  useEffect(() => {
    let alive = true;
    (async () => {
      const cfg = await getConfig();
      if (!cfg) {
        router.replace('/connect');
        return;
      }
      setConfig(cfg);
      const prefs = await getPrefs();
      try {
        const m = await api.models(cfg);
        if (!alive) return;
        setModels(m.models);
        setDefaultModel(m.defaultModel);
        setCurrentModel(prefs.defaultModel || m.defaultModel);
      } catch {
        // 模型列表失败不阻塞聊天
      }
      if (!isNew && id) {
        try {
          const d = await api.session(cfg, id);
          if (!alive) return;
          setMessages(d.messages);
          setSessionId(d.session.id);
          setLoadError(null);
        } catch {
          setLoadError('无法读取该会话');
        }
      }
      if (!alive) return;
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [id, isNew, router]);

  const refreshSession = useCallback(
    (cfg: ConnConfig, realId: string) => {
      api
        .session(cfg, realId)
        .then((d: SessionDetail) => setMessages(d.messages))
        .catch(() => {});
    },
    []
  );

  // 单条全局 WS：状态 + 流式事件 + 发送
  useEffect(() => {
    if (!config) return;
    const handle = openStream(config, {
      onStatus: (s) => setOnline(s === 'open'),
      onDelta: (_sid, delta) => {
        if (!streamingRef.current) return;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, content: last.content + delta };
          }
          return next;
        });
      },
      onComplete: (realId) => {
        setStreaming(false);
        if (SESSION_RE.test(realId || '')) {
          if (!sessionIdRef.current || sessionIdRef.current !== realId) setSessionId(realId);
          refreshSession(config, realId);
        }
      },
      onError: (_sid, error) => {
        setStreaming(false);
        setMessages((prev) => [
          ...prev,
          { id: null, role: 'assistant', content: `⚠️ 出错了：${error}`, createdAt: null },
        ]);
      },
    });
    streamRef.current = handle;
    return () => {
      handle.stop();
      streamRef.current = null;
    };
  }, [config, refreshSession]);

  const send = useCallback(
    (text: string) => {
      if (!config || streamingRef.current) return;
      const ph = sessionIdRef.current || `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setMessages((prev) => [
        ...prev,
        { id: null, role: 'user', content: text, createdAt: null },
        { id: null, role: 'assistant', content: '', createdAt: null },
      ]);
      setStreaming(true);
      const ok = streamRef.current?.send({
        content: text,
        model: currentModel ?? undefined,
        sessionId: ph,
      });
      if (!ok) {
        setStreaming(false);
        setMessages((prev) => [
          ...prev,
          { id: null, role: 'assistant', content: '⚠️ 连接已断开，请稍后重试', createdAt: null },
        ]);
      }
    },
    [config, currentModel]
  );

  const selectModel = useCallback((m: Model) => {
    setCurrentModel(m.id);
    setPickerVisible(false);
    savePrefs({ defaultModel: m.id });
  }, []);

  const openImageViewer = useCallback((u: string) => setViewer({ visible: true, uri: u }), []);

  const shortModel = (s: string | null) => {
    if (!s) return '选择模型';
    const p = s.split('/').pop() || s;
    return p.length > 22 ? p.slice(0, 22) + '…' : p;
  };

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: isNew ? '新对话' : '对话',
          headerLeft: () => (
            <View style={styles.headerLeft}>
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                hitSlop={8}
                accessibilityLabel="返回"
              >
                <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
              </Pressable>
              <Pressable
                onPress={() => setPanelVisible(true)}
                hitSlop={8}
                accessibilityLabel="历史对话"
                style={({ pressed }) => pressed && { opacity: 0.6 }}
              >
                <Ionicons name="reorder-three-outline" size={26} color={colors.textPrimary} />
              </Pressable>
            </View>
          ),
          headerRight: () => (
            <Pressable
              onPress={() => setPickerVisible(true)}
              style={({ pressed }) => [styles.modelChip, pressed && { opacity: 0.7 }]}
              accessibilityLabel="选择模型"
            >
              <Ionicons name="swap-horizontal" size={13} color={colors.accent} />
              <Text style={styles.modelChipText} numberOfLines={1}>
                {shortModel(currentModel)}
              </Text>
            </Pressable>
          ),
        }}
      />

      {!online ? (
        <View style={styles.offline}>
          <Ionicons name="cloud-offline-outline" size={14} color={colors.warningText} />
          <Text style={styles.offlineText}>未连接电脑</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : loadError ? (
        <View style={styles.center}>
          <Text style={styles.errText}>{loadError}</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item, i) => item.id ?? `${item.role}-${i}`}
            initialScrollIndex={messages.length > 0 ? messages.length - 1 : 0}
            onScrollToIndexFailed={() => listRef.current?.scrollToEnd({ animated: false })}
            contentContainerStyle={styles.list}
            onScroll={({ nativeEvent }) => {
              const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
              stickToBottom.current =
                contentSize.height - contentOffset.y - layoutMeasurement.height < 60;
            }}
            scrollEventThrottle={100}
            onContentSizeChange={() => {
              if (stickToBottom.current) listRef.current?.scrollToEnd({ animated: false });
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubble-ellipses-outline" size={36} color={colors.textFaint} />
                <Text style={styles.emptyText}>和 Hermes 聊聊吧</Text>
              </View>
            }
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isStreaming={streaming && item.role === 'assistant' && item.content === ''}
                onImagePress={openImageViewer}
              />
            )}
          />
          <InputBar onSend={send} disabled={streaming || !online} online={online} />
        </KeyboardAvoidingView>
      )}

      <ModelPicker
        visible={pickerVisible}
        models={models}
        current={currentModel}
        defaultModel={defaultModel}
        onClose={() => setPickerVisible(false)}
        onSelect={selectModel}
      />

      <ImageViewer
        visible={viewer.visible}
        uri={viewer.uri}
        onClose={() => setViewer({ visible: false, uri: null })}
      />

      {/* 历史对话面板：80% 宽度，剩余 20% 显示当前对话（阴影） */}
      <Modal visible={panelVisible} transparent animationType="fade" onRequestClose={() => setPanelVisible(false)}>
        <Pressable style={styles.panelBackdrop} onPress={() => setPanelVisible(false)}>
          <SafeAreaView style={styles.panel} onTouchStart={(e) => e.stopPropagation()}>
            {config ? (
              <ConversationList
                config={config}
                onClose={() => setPanelVisible(false)}
                onSelect={(sid) => {
                  setPanelVisible(false);
                  router.push({ pathname: '/chat/[id]', params: { id: sid } });
                }}
              />
            ) : null}
          </SafeAreaView>
        </Pressable>
      </Modal>
    </View>
  );
}
