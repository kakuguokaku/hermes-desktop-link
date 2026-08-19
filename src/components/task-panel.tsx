// src/components/task-panel.tsx —— 定时任务面板（与「最近会话」同级的折叠菜单；展开显示全部任务、面板内可滑动）
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, type CronTask } from '../lib/api';
import type { ConnConfig } from '../lib/storage';
import { font, radius, type Colors, type FontTokens } from '../lib/theme';
import { useFont, useTheme } from '../lib/theme-context';
import { GroupToggle } from './group-toggle';

export function TaskPanel({
  config,
  expanded,
  onToggle,
  fill = false,
  reloadTick = 0,
}: {
  config: ConnConfig;
  expanded: boolean;
  onToggle: () => void;
  /** 最近会话收起时置 true：面板上升占满空区，任务列表不再限高 */
  fill?: boolean;
  /** 回到首页时自增，触发一次刷新 */
  reloadTick?: number;
}) {
  const colors = useTheme();
  const font = useFont();
  const styles = useMemo(() => createStyles(colors, font), [colors, font]);
  const [tasks, setTasks] = useState<CronTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false); // 独立于 tasks.length：空列表/失败都不会反复请求
  const [error, setError] = useState<string | null>(null);
  const firstTick = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.cron(config);
      setTasks(r.tasks);
    } catch {
      setError('无法读取任务');
      setTasks([]);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [config]);

  // 挂载即加载一次（数量角标需要真实条数；bridge 端有 30s 缓存，代价低）
  useEffect(() => {
    if (!loaded && !loading) load();
  }, [loaded, loading, load]);

  // 回到首页（reloadTick 变化）时刷新一次；首次挂载不重复加载
  useEffect(() => {
    if (firstTick.current) {
      firstTick.current = false;
      return;
    }
    load();
  }, [reloadTick, load]);

  return (
    <View style={styles.panel}>
      <GroupToggle title="定时任务" count={tasks.length} expanded={expanded} onPress={onToggle} />
      {expanded ? (
        loading && tasks.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={26} color={colors.textMuted} />
            <Text style={styles.metaText}>无法读取任务</Text>
            <Pressable style={styles.retryBtn} onPress={load} accessibilityLabel="重试">
              <Text style={styles.retryText}>点击重试</Text>
            </Pressable>
          </View>
        ) : tasks.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="time-outline" size={26} color={colors.textMuted} />
            <Text style={styles.metaText}>暂无定时任务</Text>
          </View>
        ) : (
          <ScrollView
            style={fill ? styles.taskScrollFill : styles.taskScroll}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {tasks.map((t) => (
              <View key={t.id} style={styles.task}>
                <View style={styles.taskIcon}>
                  <Ionicons name="time-outline" size={17} color={colors.accent} />
                </View>
                <View style={styles.taskBody}>
                  <View style={styles.taskTop}>
                    <Text style={styles.taskTitle} numberOfLines={1}>
                      {t.name || '未命名任务'}
                    </Text>
                    {t.active ? <Text style={styles.state}>运行中</Text> : null}
                  </View>
                  <Text style={styles.taskMeta} numberOfLines={1}>
                    {[t.scheduleText, t.nextRunText ? '下次 ' + t.nextRunText : ''].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )
      ) : null}
    </View>
  );
}

function createStyles(colors: Colors, font: FontTokens) {
  return StyleSheet.create({
    panel: { padding: 8, paddingHorizontal: 12, paddingBottom: 2, backgroundColor: colors.bg },
    center: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 22 },
    metaText: { color: colors.textMuted, fontSize: font.tiny },
    retryBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.accentSoft,
    },
    retryText: { color: colors.accent, fontSize: font.tiny, fontWeight: '600' },
    taskScroll: { maxHeight: 150, paddingBottom: 4 }, // 只露出约 2 条，上滑查看全部
    taskScrollFill: { flex: 1, paddingBottom: 4 }, // 最近会话收起时占满剩余空间
    task: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 11,
      backgroundColor: colors.card,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
      marginBottom: 8,
    },
    taskIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
    taskBody: { flex: 1 },
    taskTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    taskTitle: { fontSize: font.body, fontWeight: '600', color: colors.textPrimary, flex: 1, marginRight: 8 },
    state: { fontSize: font.tiny, color: colors.accent },
    taskMeta: { fontSize: font.tiny, color: colors.textMuted, marginTop: 3 },
  });
}