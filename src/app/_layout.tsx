// src/app/_layout.tsx —— 根布局（跟随系统明暗）
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect } from 'react';
import { Pressable, Text, useColorScheme } from 'react-native';
import { ThemeProvider, useTheme } from '../lib/theme-context';
import {
  getIncomingShare,
  resetIncomingShare,
  subscribeIncoming,
  useShareIntentBridge,
} from '../lib/share-intent';

function CancelShareButton() {
  const colors = useTheme();
  const router = useRouter();
  const cancel = useCallback(() => {
    resetIncomingShare();
    router.replace('/');
  }, [router]);
  return (
    <Pressable onPress={cancel} hitSlop={8} accessibilityLabel="取消分享">
      <Text style={{ fontSize: 15, color: colors.accent }}>取消</Text>
    </Pressable>
  );
}

function RootNavigator() {
  const colors = useTheme();
  const scheme = useColorScheme();
  const router = useRouter();
  useShareIntentBridge(); // 分享扩展/文件深链：把收到的分享数据同步到单例

  // 收到分享内容 → 自动进入「发送到会话」页
  useEffect(() => {
    const unsub = subscribeIncoming(() => {
      if (getIncomingShare()) router.replace('/share');
    });
    return unsub;
  }, [router]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen name="index" options={{ title: '对话' }} />
        <Stack.Screen name="connect" options={{ title: '连接电脑', headerBackVisible: false }} />
        <Stack.Screen name="settings" options={{ title: '设置' }} />
        <Stack.Screen
          name="share"
          options={{
            title: '发送到会话',
            headerBackVisible: false,
            headerRight: () => <CancelShareButton />,
          }}
        />
        <Stack.Screen name="chat/[id]" options={{ title: '' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}
