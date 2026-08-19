// src/components/conversation-list.tsx —— 可复用会话列表（归档/删除 + 自动搜索 + session.updated 刷新，明暗自适应）
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
  View,
} from 'react-native';
import { api, type SessionSummary } from '../lib/api';
import { connection } from '../lib/connection';
import type { ConnConfig } from '../lib/storage';
import { radius, shadow, type Colors, type FontTokens } from '../lib/theme';
import { useFont, useTheme } from '../lib/theme-context';
import { GroupToggle } from './group-toggle';

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

const createStyles = (colors: Colors, font: FontTokens, expanded: boolean) =>
  StyleSheet.create({
    root: { flex: expanded ? 1 : 0, backgroundColor: colors.bg }, // 收起时收缩到内容高度，让下方任务面板可上升
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
    // 紧凑单行会话条目：图标与标题上下居中，标题左对齐，时间右对齐
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: radius.card - 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
      paddingVertical: 9,
      paddingHorizontal: 12,
      marginBottom: 8,
      ...shadow.card,
    },
    itemSelected: { borderColor: colors.accent, borderWidth: 1.5 },
    checkIcon: { marginRight: 8 },
    itemIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },
    itemTitle: { flex: 1, fontSize: font.body, fontWeight: '600', color: colors.textPrimary, textAlign: 'left' },
    itemTime: { fontSize: font.tiny, color: colors.textMuted, marginLeft: 8 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginLeft: 8 },
  });

export const ConversationList = forwardRef<
  ConversationListHandle,
  {
    config: ConnConfig;
    onSelect: (id: string) => void;
    onClose?: () => void;
    showActions?: boolean;
    query?: string;
    showSectionHeader?: boolean;
    expanded?: boolean;
    onToggleExpanded?: () => void;
    reloadTick?: number;
    updatedIds?: Set<string>;
    onUserScroll?: () => void;
    selectedId?: string;
  }
>(function ConversationList(
  { config, onSelect, onClose, showActions = true, query: queryProp, showSectionHeader = false, expanded = true, onToggleExpanded, reloadTick, updatedIds, onUserScroll, selectedId },
  ref
) {
  const colors = useTheme();
  const font = useFont();
  const styles = useMemo(() => createStyles(colors, font, expanded), [colors, font, expanded]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [action, setAction] = useState<'archive' | 'delete' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const query = queryProp ?? '';

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

  // 会话更新（发完消息等）→ 自动重载列表
  useEffect(() => connection.subscribeSessionUpdated(() => load()), [load]);

  // 外部触发刷新（回到前台 / 列表重挂）：静默重载，不重置 loading 态
  useEffect(() => {
    if (reloadTick !== undefined && reloadTick > 0) load();
  }, [reloadTick, load]);

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
    if (!action || processing) return;
    setProcessing(true);
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
    setProcessing(false);
  }, [action, selected, config, load, cancelSelect, processing]);

  const showToolbar = Boolean(onClose || selectMode);

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
              <Pressable onPress={cancelSelect} hitSlop={8} disabled={processing}>
                <Text style={styles.cancelText}>{processing ? '处理中…' : '取消'}</Text>
              </Pressable>
              <Text style={styles.selectCount}>已选 {selected.size} 项</Text>
              <Pressable onPress={confirmAction} hitSlop={8} disabled={processing}>
                <Text style={[styles.confirmText, action === 'delete' ? styles.confirmDelete : null]}>
                  {processing ? '处理中…' : `确认${action === 'archive' ? '归档' : '删除'}`}
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

      {showSectionHeader ? (
        <GroupToggle title="最近会话" count={sessions.length} expanded={expanded} onPress={onToggleExpanded ?? (() => {})} />
      ) : null}

      {expanded && loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : expanded && error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={32} color={colors.textMuted} />
          <Text style={styles.errText}>{error}</Text>
        </View>
      ) : expanded && filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={32} color={colors.textMuted} />
          <Text style={styles.emptyText}>{query ? '没有匹配的对话' : '还没有对话'}</Text>
        </View>
      ) : expanded ? (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          onScrollBeginDrag={() => onUserScroll?.()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.item,
                selectMode && selected.has(item.id) && styles.itemSelected,
                !selectMode && selectedId === item.id && styles.itemSelected,
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
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.title || '未命名对话'}
              </Text>
              {updatedIds?.has(item.id) ? <View style={styles.unreadDot} /> : null}
              <Text style={styles.itemTime}>{fmtTime(item.updatedAt)}</Text>
            </Pressable>
          )}
        />
      ) : null}
    </View>
  );
});
