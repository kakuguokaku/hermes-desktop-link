// src/app/index.tsx —— 对话列表（主界面，全屏，明暗自适应）
// 顶部标题随展开切换：展开「最近会话」→「会话」；展开「定时任务」→「任务」
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ConversationList, type ConversationListHandle } from '../components/conversation-list';
import { connection } from '../lib/connection';
import { getConfig, type ConnConfig } from '../lib/storage';
import { unread } from '../lib/unread';
import { font, radius, type Colors } from '../lib/theme';
import { useTheme } from '../lib/theme-context';

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    headerBtns: { flexDirection: 'row', alignItems: 'center' },
    headerGap: { marginLeft: 15 },
    searchWrap: { padding: 8, paddingHorizontal: 12, paddingBottom: 12 },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: radius.card - 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchInput: { flex: 1, fontSize: font.body, color: colors.textPrimary, padding: 0 },
  });

export default function ConversationsScreen() {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [config, setConfig] = useState<ConnConfig | null>(null);
  const [chatOpen, setChatOpen] = useState(true); // 最近会话：默认展开
  const [query, setQuery] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const [kavEpoch, setKavEpoch] = useState(0); // 回前台时强制 KeyboardAvoidingView 重新计算布局
  const [updatedIds, setUpdatedIds] = useState<Set<string>>(() => unread.snapshot()); // 会话栏"有更新"标记
  const [connStatus, setConnStatus] = useState<string>('closed'); // 顶栏连接状态指示灯
  const listRef = useRef<ConversationListHandle>(null);

  // 搜索栏开着键盘切后台再回来：iOS 会收起键盘但 KAV 残留高度 → 白屏。后台 dismiss + 回前台强制重算。
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      const prev = appStateRef.current;
      appStateRef.current = s;
      if (s === 'background') {
        Keyboard.dismiss();
      } else if (s === 'active' && prev === 'background') {
        setKavEpoch((e) => e + 1);
      }
    });
    return () => sub.remove();
  }, []);

  // 连接状态指示灯：订阅变化 + 前台每 20s 刷新 + 回前台立即刷一次
  useEffect(() => {
    const unsub = connection.subscribe(setConnStatus);
    const refresh = () => {
      if (AppState.currentState === 'active') setConnStatus(connection.getStatus());
    };
    const id = setInterval(refresh, 20000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => {
      unsub();
      clearInterval(id);
      sub.remove();
    };
  }, []);

  // 回到前台：读配置（缺则跳连接页）并静默刷新列表（命中 bridge 缓存则瞬时）
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const cfg = await getConfig();
        if (!cfg) {
          router.replace('/connect');
          return;
        }
        if (alive) {
          setConfig(cfg);
          connection.ensureStarted(cfg); // 首页也启动 WS 连接，指示灯才能显示已连接
          setConnStatus(connection.getStatus()); // 回首页立即刷新连接指示灯
          setRefreshTick((t) => t + 1);
        }
      })();
      return () => {
        alive = false;
      };
    }, [router])
  );

  // 未读更新标记：后台/其它会话更新时点亮；点进去清除
  useEffect(() => unread.subscribe(() => setUpdatedIds(unread.snapshot())), []);

  // 收到 session.updated（发完消息等）→ 点亮更新标记 + 刷新列表
  useEffect(
    () =>
      connection.subscribeSessionUpdated((sid) => {
        unread.mark(sid);
        setRefreshTick((t) => t + 1);
      }),
    []
  );

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: '会话',
          headerRight: () => (
            <View style={styles.headerBtns}>
              <Pressable
                onPress={() => listRef.current?.beginArchive()}
                hitSlop={8}
                style={({ pressed }) => pressed && { opacity: 0.6 }}
                accessibilityLabel="归档"
              >
                <Ionicons name="archive-outline" size={23} color={colors.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => listRef.current?.beginDelete()}
                hitSlop={8}
                style={({ pressed }) => [pressed && { opacity: 0.6 }, styles.headerGap]}
                accessibilityLabel="删除"
              >
                <Ionicons name="trash-outline" size={22} color={colors.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => router.push('/chat/new')}
                hitSlop={8}
                style={({ pressed }) => [pressed && { opacity: 0.6 }, styles.headerGap]}
                accessibilityLabel="新对话"
              >
                <Ionicons name="add-circle-outline" size={25} color={colors.accent} />
              </Pressable>
              <Pressable
                hitSlop={8}
                style={({ pressed }) => [pressed && { opacity: 0.6 }, styles.headerGap]}
                accessibilityLabel={connStatus === 'open' ? '已连接' : '未连接'}
              >
                <Ionicons
                  name="link-outline"
                  size={22}
                  color={connStatus === 'open' ? colors.accent : colors.textSecondary}
                />
              </Pressable>
              <Pressable
                onPress={() => router.push('/settings')}
                hitSlop={8}
                style={({ pressed }) => [pressed && { opacity: 0.6 }, styles.headerGap]}
                accessibilityLabel="设置"
              >
                <Ionicons name="settings-outline" size={23} color={colors.textSecondary} />
              </Pressable>
            </View>
          ),
        }}
      />
      {config ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 92 + (kavEpoch % 2) : 0}
        >
          <ConversationList
            ref={listRef}
            config={config}
            showActions={false}
            showSectionHeader
            expanded={chatOpen}
            onToggleExpanded={() => setChatOpen((o) => !o)}
            query={query}
            reloadTick={refreshTick}
            updatedIds={updatedIds}
            onSelect={(id) => {
              unread.clear(id);
              unread.setCurrent(id);
              router.push({ pathname: '/chat/[id]', params: { id } });
            }}
          />
          {/* 搜索栏：和列表同在一个 KAV，键盘弹起时整体上移，搜索栏不被键盘盖住 */}
          <View style={styles.searchWrap}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={15} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="搜索会话标题"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="清空搜索">
                  <Ionicons name="close-circle" size={15} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </View>
  );
}
