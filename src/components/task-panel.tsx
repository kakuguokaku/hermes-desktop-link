// src/components/task-panel.tsx —— 定时任务面板（与「最近会话」同级的折叠菜单；展开显示全部任务、面板内可滑动）
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
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
}: {
  config: ConnConfig;
  expanded: boolean;
  onToggle: () => void;
  /** 最近会话收起时置 true：面板上升占满空区，任务列表不再限高 */
  fill?: boolean;
}) {
  const colors = useTheme();
  const font = useFont();
  const styles = useMemoStyles(colors, font);
  const [tasks, setTasks] = useState<CronTask[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.cron(config);
      setTasks(r.tasks);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [config]);

  // 挂载即加载一次（数量角标需要真实条数；bridge 端有 30s 缓存，代价低）
  useEffect(() => {
    if (tasks.length === 0 && !loading) load();
  }, [tasks.length, loading, load]);

  return (
    <View style={styles.panel}>
      <GroupToggle title="定时任务" count={tasks.length} expanded={expanded} onPress={onToggle} />
      {expanded ? (
        loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color={colors.accent} />
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
                      {t.name}
                    </Text>
                    {t.active ? <Text style={styles.state}>运行中</Text> : null}
                  </View>
                  <Text style={styles.taskMeta} numberOfLines={1}>
                    {[t.scheduleText, t.nextRunText ? `下次 ${t.nextRunText}` : ''].filter(Boolean).join(' · ')}
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

function useMemoStyles(colors: Colors, font: FontTokens) {
  return StyleSheet.create({
    panel: { padding: 8, paddingHorizontal: 12, paddingBottom: 2, backgroundColor: colors.bg },
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
    taskTitle: { fontSize: font.body, fontWeight: '600', color: colors.textPrimary, flex: 1 },
    state: { fontSize: font.tiny, fontWeight: '700', color: colors.successText, backgroundColor: colors.accentSoft, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
    taskMeta: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
    center: { padding: 16, alignItems: 'center' },
  });
}
