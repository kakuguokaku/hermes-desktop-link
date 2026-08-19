// src/app/chat/[id].tsx —— 对话页（流式 + 模型切换 + 语音 + 80% 历史面板，明暗自适应）
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Keyboard,
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
  resolveActiveBaseUrl,
  type Attachment,
  type Message,
  type Model,
  type SessionDetail,
  type Uploaded,
} from '../../lib/api';
import { contentForSend } from '../../lib/chat-prompt';
import { shouldHandleStreamEvent, shouldPollSession } from '../../lib/chat-polling';
import { PHONE_DEFAULT_MODEL, filterPhoneModels, resolvePhoneModel } from '../../lib/phone-models';
import {
  localAssistantMessageId,
  localUserMessageId,
  mergeServerWithLocal,
  removeLocalRequestMessages,
  replaceLocalAssistantMessage,
  withStableMessageKeys,
} from '../../lib/message-keys';
import { UploadTooLargeError } from '../../lib/upload-limits';
import { connection } from '../../lib/connection';
import type { Status } from '../../lib/connection';
import { getConfig, getPrefs, savePrefs, type ConnConfig } from '../../lib/storage';
import { unread } from '../../lib/unread';
import { radius, type Colors, type FontTokens } from '../../lib/theme';
import { useFont, useTheme } from '../../lib/theme-context';

const SESSION_RE = /^\d{8}_\d{6}_[A-Za-z0-9]+$/;

const createStyles = (colors: Colors, font: FontTokens) =>
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
    list: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 14, flexGrow: 1 },
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
  const font = useFont();
  const styles = useMemo(() => createStyles(colors, font), [colors, font]);
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
  const [kavEpoch, setKavEpoch] = useState(0); // 回前台时强制 KeyboardAvoidingView 重新计算布局
  const [pendingAtts, setPendingAtts] = useState<Attachment[]>([]); // 待发附件（发送前显示在输入栏上方）
  const [sending, setSending] = useState(false); // 附件上传/发送中：禁用重复发送
  const [focused, setFocused] = useState(true); // 页面聚焦（离开页面停止轮询）
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const sendingRef = useRef(false);
  const pollLock = useRef(false); // 轮询互斥：上一轮未结束不发起下一轮
  const pollFails = useRef(0); // 连续失败静默退避，不弹窗

  const listRef = useRef<FlatList<Message>>(null);
  const sessionIdRef = useRef<string | null>(sessionId);
  sessionIdRef.current = sessionId;
  const streamingRef = useRef(streaming);
  streamingRef.current = streaming;
  const stickToBottom = useRef(true); // 贴底跟随：用户上翻历史时不强制拉回
  const lastActivityRef = useRef(0); // 流式看门狗：最近一次 delta 活动时间
  const activeReqRef = useRef<string | null>(null); // 当前流式请求 id（placeholder）：只处理本会话的事件
  // 反向渲染（微信式）：最新一条固定在 index 0（屏幕底端），打开即在最新、键盘弹起不遮挡
  const invertedMessages = useMemo(() => [...messages].reverse(), [messages]);

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
      connection.ensureStarted(cfg);
      const prefs = await getPrefs();
      if (!alive) return;
      // 手机端的模型选择固定为产品规定的五项，不依赖桌面端完整模型目录。
      setModels(filterPhoneModels([]));
      setDefaultModel(PHONE_DEFAULT_MODEL);
      setCurrentModel(resolvePhoneModel(prefs.defaultModel));
      if (!isNew && id) {
        try {
          const d = await api.session(cfg, id);
          if (!alive) return;
          setMessages(withStableMessageKeys(d.messages));
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

  // 刷新会话：合并服务端快照与本地乐观消息，避免覆盖「正在发送/正在输出」的气泡
  const refreshSession = useCallback((cfg: ConnConfig, realId: string) => {
    api
      .session(cfg, realId)
      .then((d: SessionDetail) => setMessages((prev) => mergeServerWithLocal(d.messages, prev)))
      .catch(() => {});
  }, []);

  // 连接状态订阅：online 标识 + 重连成功后刷新会话（把断连期间消息拉回）；断连/重连时复位卡死的流式
  const prevConn = useRef<Status | null>(null);
  useEffect(() => {
    return connection.subscribe((s) => {
      setOnline(s === 'open');
      if (s !== 'open' && streamingRef.current) setStreaming(false);
      if (s === 'open' && prevConn.current && prevConn.current !== 'open') {
        if (streamingRef.current) setStreaming(false);
        if (config && sessionIdRef.current) refreshSession(config, sessionIdRef.current);
      }
      prevConn.current = s;
    });
  }, [config, refreshSession]);

  // 收到 session.updated：对应当前会话则刷新（bridge 已完成一次回复）
  useEffect(() => {
    return connection.subscribeSessionUpdated((sid) => {
      if (config && sessionIdRef.current && sid === sessionIdRef.current) {
        refreshSession(config, sid);
      }
    });
  }, [config, refreshSession]);

  // P1-2：当前对话聚焦 + App 前台时每 2s 刷新一次（流式输出/上一轮未结束则跳过），离开页面立即停止
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );
  useEffect(() => {
    const pollConfig = config;
    if (!shouldPollSession({ focused, appActive, online, hasConfig: !!pollConfig, sessionId }) || !pollConfig) return;
    const timer = setInterval(() => {
      if (streamingRef.current) return; // 流式期间不刷新，避免旧快照覆盖正在显示的内容
      if (pollLock.current) return; // 上一轮未结束不再发起
      if (pollFails.current >= 10) return; // 连续失败静默退避：暂停请求，恢复后自动对齐
      const sid = sessionIdRef.current;
      if (!sid) return;
      pollLock.current = true;
      api
        .session(pollConfig, sid, true) // fresh=1 绕过 bridge 10s 缓存
        .then((d: SessionDetail) => {
          pollFails.current = 0;
          setMessages((prev) => mergeServerWithLocal(d.messages, prev));
        })
        .catch(() => {
          pollFails.current += 1; // 连续失败静默退避，不弹窗
        })
        .finally(() => {
          pollLock.current = false;
        });
    }, 2000);
    return () => clearInterval(timer);
  }, [focused, appActive, online, config, sessionId]);

  // 标记"正在查看的会话"：自身更新不点亮未读标记；离开时清除
  useEffect(() => {
    unread.setCurrent(sessionId);
    return () => unread.setCurrent(null);
  }, [sessionId]);

  // 键盘开着切后台再回来：iOS 会收起键盘但 KAV 残留键盘高度 → 白屏只剩输入框。
  // 后台时主动 dismiss（触发 hide 事件清 padding），回前台再强制 KAV 重算布局。
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      const prev = appStateRef.current;
      appStateRef.current = s;
      setAppActive(s === 'active');
      if (s === 'background') {
        Keyboard.dismiss();
      } else if (s === 'active' && prev === 'background') {
        setKavEpoch((e) => e + 1);
      }
    });
    return () => sub.remove();
  }, []);

  // 流式事件注册（卸载时注销，连接本身保留）
  useEffect(() => {
    if (!config) return;
    connection.setStreamHandlers({
      onDelta: (_sid, delta, reqId) => {
        if (!shouldHandleStreamEvent(streamingRef.current, activeReqRef.current, reqId)) return;
        lastActivityRef.current = Date.now();
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, content: last.content + delta };
          }
          return next;
        });
      },
      onComplete: (realId, reqId) => {
        if (reqId !== undefined && reqId !== activeReqRef.current) return; // 忽略其它会话（后台并发）的完成，避免自动跳转
        activeReqRef.current = null;
        setStreaming(false);
        if (SESSION_RE.test(realId || '')) {
          if (!sessionIdRef.current || sessionIdRef.current !== realId) setSessionId(realId);
          refreshSession(config, realId);
        }
      },
      onError: (_sid, error, reqId) => {
        if (reqId !== undefined && reqId !== activeReqRef.current) return;
        activeReqRef.current = null;
        setStreaming(false);
        setMessages((prev) =>
          reqId
            ? replaceLocalAssistantMessage(prev, reqId, `⚠️ 出错了：${error}`)
            : [...prev, { id: `local-error-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role: 'assistant', content: `⚠️ 出错了：${error}`, createdAt: null }]
        );
      },
    });
    return () => connection.setStreamHandlers(null);
  }, [config, refreshSession]);

  // 流式看门狗：45s 无活动（message.complete 丢失 / WS 中途断开）→ 复位 streaming 并拉回最新
  useEffect(() => {
    if (!streaming) return;
    const t = setInterval(() => {
      if (streamingRef.current && Date.now() - lastActivityRef.current > 45000) {
        setStreaming(false);
        if (sessionIdRef.current && config) refreshSession(config, sessionIdRef.current);
      }
    }, 10000);
    return () => clearInterval(t);
  }, [streaming, config, refreshSession]);

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      if (!config || streamingRef.current || sendingRef.current) return false;
      sendingRef.current = true;
      setSending(true);
      try {
        const ph = sessionIdRef.current || `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        // 无文字时按附件类型补默认提示（与 bridge 一致，乐观气泡也能看到）
        const hasImage = pendingAtts.some((a) => a.kind === 'image');
        const hasFile = pendingAtts.some((a) => a.kind === 'file');
        const content = contentForSend(text, hasImage, hasFile);
        // 先上传附件（逐个），任一失败则中止发送并保留草稿（文字与附件不丢，可重试）
        const uploaded: { kind: 'image' | 'file'; fileId: string }[] = [];
        for (const a of pendingAtts) {
          if (!a.uri) continue;
          try {
            const u = await api.upload(config, a.uri, a.name, a.kind);
            uploaded.push({ kind: u.kind, fileId: u.fileId });
          } catch (e: any) {
            Alert.alert('附件上传失败', e instanceof UploadTooLargeError ? e.message : a.name);
            return false;
          }
        }
        activeReqRef.current = ph;
        streamingRef.current = true;
        setMessages((prev) => [
          ...prev,
          { id: localUserMessageId(ph), role: 'user', content, createdAt: null, attachments: pendingAtts },
          { id: localAssistantMessageId(ph), role: 'assistant', content: '', createdAt: null },
        ]);
        setStreaming(true);
        const ok = connection.send({
          reqId: ph,
          content,
          model: currentModel ?? undefined,
          sessionId: ph,
          attachments: uploaded,
        });
        if (!ok) {
          activeReqRef.current = null;
          streamingRef.current = false;
          setStreaming(false);
          setMessages((prev) => removeLocalRequestMessages(prev, ph));
          await Promise.all(uploaded.map((a) => api.deleteUpload(config, a.fileId).catch(() => {})));
          return false;
        }
        setPendingAtts([]);
        return true;
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [config, currentModel, pendingAtts]
  );

  // 历史附件拉取（下载到缓存文件；useCallback 保持稳定引用，避免 MessageBubble useEffect 无限循环闪退）
  const fetchUpload = useCallback(
    (fileId: string) => (config ? api.uploadFileUrl(config, fileId) : Promise.reject(new Error('no config'))),
    [config]
  );

  const selectModel = useCallback((m: Model) => {
    setCurrentModel(m.id);    setPickerVisible(false);
    savePrefs({ defaultModel: m.id });
  }, []);

  const openImageViewer = useCallback((u: string) => setViewer({ visible: true, uri: u }), []);

  const openAttachment = useCallback(
    async (a: Attachment) => {
      if (a.kind === 'image' && a.uri) {
        openImageViewer(a.uri);
        return;
      }
      if (a.uri) {
        await Sharing.shareAsync(a.uri).catch(() => {});
        return;
      }
      Alert.alert('文件', '附件暂不可用');
    },
    [openImageViewer]
  );

  // 历史文件：带 token 下载到缓存后系统分享/打开
  const openHistoryFile = useCallback(
    async (fileId: string, name: string) => {
      if (!config) return;
      try {
        const baseUrl = await resolveActiveBaseUrl(config);
        const dest = new File(Paths.cache, `dl_${Date.now()}_${name}`);
        const f = await File.downloadFileAsync(`${baseUrl}/api/uploads/${encodeURIComponent(fileId)}`, dest, {
          headers: { Authorization: `Bearer ${config.token}` },
        });
        await Sharing.shareAsync(f.uri);
      } catch {
        Alert.alert('文件', '附件下载失败，可能已过期');
      }
    },
    [config]
  );

  // 语音直传：内部提示 Hermes 转写后把语音内容当命令执行；界面仅显示语音已发送。
  const sendVoice = useCallback(
    async (uri: string, name: string) => {
      if (!config || streamingRef.current || sendingRef.current) return;
      sendingRef.current = true;
      setSending(true);
      try {
        const ph = sessionIdRef.current || `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let up: Uploaded;
        try {
          up = await api.upload(config, uri, name, 'file');
        } catch (e: any) {
          Alert.alert('语音上传失败', e instanceof UploadTooLargeError ? e.message : name);
          return;
        }
        activeReqRef.current = ph;
        streamingRef.current = true;
        const att: Attachment = { kind: 'file', name, uri };
        setMessages((prev) => [
          ...prev,
          { id: localUserMessageId(ph), role: 'user', content: '请将此段语音转换为文字，并作为给你的命令执行。', createdAt: null, attachments: [att] },
          { id: localAssistantMessageId(ph), role: 'assistant', content: '', createdAt: null },
        ]);
        setStreaming(true);
        const ok = connection.send({
          reqId: ph,
          content: '请将此段语音转换为文字，并作为给你的命令执行。',
          model: currentModel ?? undefined,
          sessionId: ph,
          attachments: [{ kind: 'file', fileId: up.fileId }],
        });
        if (!ok) {
          activeReqRef.current = null;
          streamingRef.current = false;
          setStreaming(false);
          setMessages((prev) => removeLocalRequestMessages(prev, ph));
          await api.deleteUpload(config, up.fileId).catch(() => {});
        }
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [config, currentModel]
  );

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
        <Pressable
          style={styles.offline}
          onPress={() => connection.reconnectNow()}
          accessibilityLabel="重新连接"
        >
          <Ionicons name="cloud-offline-outline" size={14} color={colors.warningText} />
          <Text style={styles.offlineText}>未连接电脑 · 点此重连</Text>
          <Ionicons name="refresh" size={14} color={colors.warningText} />
        </Pressable>
      ) : null}

      {loadError ? (
        <View style={styles.center}>
          <Text style={styles.errText}>{loadError}</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 + (kavEpoch % 2) : 0}
        >
          <FlatList
            ref={listRef}
            data={invertedMessages}
            inverted
            keyExtractor={(item) => item.id!}
            contentContainerStyle={styles.list}
            onScroll={({ nativeEvent }) => {
              const { contentOffset } = nativeEvent;
              // 反向列表：contentOffset 0 即屏幕底端（最新），距底部 <60 视为贴底
              stickToBottom.current = contentOffset.y < 60;
            }}
            scrollEventThrottle={100}
            onContentSizeChange={() => {
              if (stickToBottom.current) listRef.current?.scrollToOffset({ offset: 0, animated: false });
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                {loading ? (
                  <>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={styles.emptyText}>加载中…</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="chatbubble-ellipses-outline" size={36} color={colors.textFaint} />
                    <Text style={styles.emptyText}>和 Hermes 聊聊吧</Text>
                  </>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isStreaming={streaming && item.role === 'assistant' && item.content === ''}
                onImagePress={openImageViewer}
                onAttachmentPress={openAttachment}
                onFetchUpload={fetchUpload}
                onOpenHistoryFile={openHistoryFile}
              />
            )}
          />
          {/* 键盘弹起时输入框与键盘之间留出间距（避免重叠） */}
          <View style={{ paddingBottom: 18 }}>
            <InputBar
              onSend={send}
              disabled={streaming || sending || !online}
              online={online}
              attachments={pendingAtts}
              onAttachmentsChange={setPendingAtts}
              onSendVoice={sendVoice}
              onPreviewAttachment={(a) => {
                if (a.kind === 'image' && a.uri) openImageViewer(a.uri);
              }}
            />
          </View>
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
