// src/components/conversation-list.tsx —— 可复用会话列表（归档/删除 + 自动搜索，明暗自适应）
import { Ionicons } from '@expo/vector-icons';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, type SessionSummary } from '../lib/api';
import type { ConnConfig } from '../lib/storage';
import { font, radius, shadow, type Colors } from '../lib/theme';
import { useTheme } from '../lib/theme-context';

export type ConversationListHandle = {
  beginArchive: () => void;
  beginDelete: () => void;
};

function fmtTime(raw: string | null): string {
  if (!raw) return '';
  const s = String(raw);
  const m = s.match(/(\d+)([hd]) ago/);
  if (m) return m[1] + (m[2] === 'h' ? ' 小时前' : ' 天前');
  if (s.includes('just now')) return '刚刚';
  if (s.includes('yesterday')) return '昨天';
  return s;
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
    errText: { color: colors.textSecondary, fontSize: font.body, textAlign: 'center' },
    emptyText: { color: colors.textMuted, fontSize: font.body },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.bg,
    },
    toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    toolbarTitle: { fontSize: font.h2, fontWeight: '700', color: colors.textPrimary },
    actions: { flexDirection: 'row', gap: 10 },
    actionIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectBar: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cancelText: { fontSize: font.body, color: colors.textSecondary },
    selectCount: { fontSize: font.body, fontWeight: '600', color: colors.textPrimary },
    confirmText: { fontSize: font.body, fontWeight: '700', color: colors.accent },
    confirmDelete: { color: colors.errorText },
    list: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12 },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
      padding: 13,
      marginBottom: 10,
      ...shadow.card,
    },
    itemSelected: { borderColor: colors.accent, borderWidth: 1.5 },
    checkIcon: { marginRight: 8 },
    itemIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    itemBody: { flex: 1 },
    itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    itemTitle: { fontSize: font.body, fontWeight: '600', color: colors.textPrimary, flex: 1, marginRight: 8 },
    itemTime: { fontSize: font.tiny, color: colors.textMuted },
    itemMeta: { fontSize: font.tiny, color: colors.textMuted, marginTop: 3 },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginHorizontal: 12,
      marginBottom: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchInput: { flex: 1, fontSize: font.body, color: colors.textPrimary, padding: 0 },
  });

export const ConversationList = forwardRef<
  ConversationListHandle,
  {
    config: ConnConfig;
    onSelect: (id: string) => void;
    onClose?: () => void;
    showActions?: boolean;
  }
>(function ConversationList({ config, onSelect, onClose, showActions = true }, ref) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [action, setAction] = useState<'archive' | 'delete' | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const r = await api.sessions(config);
      setSessions(r.sessions);
      setError(null);
    } catch {
      setError('无法连接电脑，请检查桥接服务与网络');
    }
  }, [config]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => (s.title || '未命名对话').toLowerCase().includes(q));
  }, [sessions, query]);

  const enterSelect = useCallback((a: 'archive' | 'delete') => {
    setAction(a);
    setSelectMode(true);
    setSelected(new Set());
  }, []);
  const cancelSelect = useCallback(() => {
    setSelectMode(false);
    setAction(null);
    setSelected(new Set());
  }, []);
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  useImperativeHandle(ref, () => ({
    beginArchive: () => enterSelect('archive'),
    beginDelete: () => enterSelect('delete'),
  }));

  const confirmAction = useCallback(async () => {
    if (!action) return;
    const ids = [...selected];
    for (const id of ids) {
      try {
        if (action === 'archive') await api.archiveSession(config, id);
        else await api.removeSession(config, id);
      } catch {
        // 单个失败不阻塞
      }
    }
    cancelSelect();
    await load();
  }, [action, selected, config, load, cancelSelect]);

  const showToolbar = Boolean(onClose || showActions || selectMode);

  return (
    <View style={styles.root}>
      {showToolbar && (
        <View style={styles.toolbar}>
          {onClose && !selectMode ? (
            <View style={styles.toolbarLeft}>
              <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="关闭">
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
              <Text style={styles.toolbarTitle}>对话</Text>
            </View>
          ) : null}

          {selectMode ? (
            <View style={styles.selectBar}>
              <Pressable onPress={cancelSelect} hitSlop={8}>
                <Text style={styles.cancelText}>取消</Text>
              </Pressable>
              <Text style={styles.selectCount}>已选 {selected.size} 项</Text>
              <Pressable onPress={confirmAction} hitSlop={8}>
                <Text style={[styles.confirmText, action === 'delete' ? styles.confirmDelete : null]}>
                  确认{action === 'archive' ? '归档' : '删除'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.actions}>
              {showActions ? (
                <>
                  <Pressable
                    style={({ pressed }) => [styles.actionIconBtn, pressed && { opacity: 0.6 }]}
                    onPress={() => enterSelect('archive')}
                    accessibilityLabel="归档"
                  >
                    <Ionicons name="archive-outline" size={20} color={colors.accent} />
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.actionIconBtn, pressed && { opacity: 0.6 }]}
                    onPress={() => enterSelect('delete')}
                    accessibilityLabel="删除"
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.errorText} />
                  </Pressable>
                </>
              ) : null}
            </View>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={32} color={colors.textMuted} />
          <Text style={styles.errText}>{error}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={32} color={colors.textMuted} />
          <Text style={styles.emptyText}>{query ? '没有匹配的对话' : '还没有对话'}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.item,
                selectMode && selected.has(item.id) && styles.itemSelected,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => (selectMode ? toggle(item.id) : onSelect(item.id))}
            >
              {selectMode && (
                <Ionicons
                  name={selected.has(item.id) ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={selected.has(item.id) ? colors.accent : colors.textFaint}
                  style={styles.checkIcon}
                />
              )}
              <View style={styles.itemIcon}>
                <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.accent} />
              </View>
              <View style={styles.itemBody}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.title || '未命名对话'}
                  </Text>
                  <Text style={styles.itemTime}>{fmtTime(item.updatedAt)}</Text>
                </View>
                <Text style={styles.itemMeta} numberOfLines={1}>
                  {item.model ? `模型 ${item.model}` : '·'}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* 底部搜索框（自动搜索，无需按钮） */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="搜索会话标题"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="清空搜索">
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );
});
