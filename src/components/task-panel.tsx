// src/components/task-panel.tsx —— 定时任务面板（锚定搜索栏上方；展开 2 条，点/搓上方列表自动收回）
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, type CronTask } from '../lib/api';
import type { ConnConfig } from '../lib/storage';
import { font, radius, type Colors } from '../lib/theme';
import { useTheme } from '../lib/theme-context';

export function TaskPanel({
  config,
  expanded,
  onToggle,
  onCollapse,
}: {
  config: ConnConfig;
  expanded: boolean;
  onToggle: () => void;
  onCollapse: () => void;
}) {
  const colors = useTheme();
  const styles = useMemoStyles(colors);
  const [tasks, setTasks] = useState<CronTask[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.cron(config);
      setTasks(r.tasks.slice(0, 2));
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    if (expanded && tasks.length === 0 && !loading) load();
  }, [expanded, tasks.length, loading, load]);

  return (
    <View style={styles.panel}>
      <Pressable style={[styles.toggle, expanded && styles.toggleOpen]} onPress={onToggle} accessibilityLabel="定时任务">
        <Ionicons name="time-outline" size={17} color={colors.accent} />
        <Text style={styles.name}>定时任务</Text>
        <Text style={styles.count}>{expanded ? '2 条' : '2'}</Text>
        <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={14} color={colors.textMuted} />
      </Pressable>
      {expanded ? (
        loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : (
          tasks.map((t) => (
            <Pressable key={t.id} style={styles.task} onPress={onCollapse} accessibilityLabel={t.name}>
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
            </Pressable>
          ))
        )
      ) : null}
    </View>
  );
}

function useMemoStyles(colors: Colors) {
  return StyleSheet.create({
    panel: { padding: 8, paddingHorizontal: 12, paddingBottom: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSubtle, backgroundColor: colors.bg },
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 11,
      backgroundColor: colors.card,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    toggleOpen: { borderColor: colors.accent },
    name: { fontSize: font.body, fontWeight: '700', color: colors.textPrimary, flex: 1 },
    count: { fontSize: font.tiny, color: colors.textMuted, fontWeight: '600' },
    task: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 11,
      backgroundColor: colors.card,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
      marginTop: 8,
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
