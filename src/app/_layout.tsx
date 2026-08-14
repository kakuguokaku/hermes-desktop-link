// src/app/_layout.tsx —— 根布局（跟随系统明暗）
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { ThemeProvider, useTheme } from '../lib/theme-context';
import { useShareIntentBridge } from '../lib/share-intent';

function RootNavigator() {
  const colors = useTheme();
  const scheme = useColorScheme();
  useShareIntentBridge(); // 分享扩展：把收到的分享数据同步到单例
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
        <Stack.Screen name="share" options={{ title: '发送到会话', headerBackVisible: false }} />
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
