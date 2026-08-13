// src/app/index.tsx —— 对话列表（主界面，全屏，明暗自适应）
// 顶部标题随展开切换：展开「最近会话」→「会话」；展开「定时任务」→「任务」
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ConversationList, type ConversationListHandle } from '../components/conversation-list';
import { TaskPanel } from '../components/task-panel';
import { connection } from '../lib/connection';
import { getConfig, type ConnConfig } from '../lib/storage';
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
  const [viewMode, setViewMode] = useState<'sessions' | 'tasks'>('sessions');
  const [query, setQuery] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const listRef = useRef<ConversationListHandle>(null);

  const collapseTasks = useCallback(() => setViewMode('sessions'), []);

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
          setRefreshTick((t) => t + 1);
        }
      })();
      return () => {
        alive = false;
      };
    }, [router])
  );

  // 收到 session.updated（发完消息等）→ 刷新列表
  useEffect(() => connection.subscribeSessionUpdated(() => setRefreshTick((t) => t + 1)), []);

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: viewMode === 'tasks' ? '任务' : '会话',
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
        <View style={styles.flex}>
          <ConversationList
            ref={listRef}
            config={config}
            showActions={false}
            showSectionHeader
            query={query}
            reloadTick={refreshTick}
            onUserScroll={viewMode === 'tasks' ? collapseTasks : undefined}
            onSelect={(id) => router.push({ pathname: '/chat/[id]', params: { id } })}
          />
          {/* 定时任务面板 + 搜索栏：键盘弹起时整体升到键盘上方 */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
          >
            <TaskPanel
              config={config}
              expanded={viewMode === 'tasks'}
              onToggle={() => setViewMode((m) => (m === 'tasks' ? 'sessions' : 'tasks'))}
              onCollapse={collapseTasks}
            />
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
        </View>
      ) : null}
    </View>
  );
}
