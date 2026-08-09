// src/app/index.tsx —— 对话列表（主界面，全屏，明暗自适应）
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ConversationList, type ConversationListHandle } from '../components/conversation-list';
import { getConfig, type ConnConfig } from '../lib/storage';
import { type Colors } from '../lib/theme';
import { useTheme } from '../lib/theme-context';

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    headerBtns: { flexDirection: 'row', alignItems: 'center' },
    headerGap: { marginLeft: 15 },
  });

export default function ConversationsScreen() {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [config, setConfig] = useState<ConnConfig | null>(null);
  const listRef = useRef<ConversationListHandle>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const cfg = await getConfig();
        if (!cfg) {
          router.replace('/connect');
          return;
        }
        if (alive) setConfig(cfg);
      })();
      return () => {
        alive = false;
      };
    }, [router])
  );

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: '对话',
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
        <ConversationList
          ref={listRef}
          config={config}
          showActions={false}
          onSelect={(id) => router.push({ pathname: '/chat/[id]', params: { id } })}
        />
      ) : null}
    </View>
  );
}
