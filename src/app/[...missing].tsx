// src/app/[...missing].tsx —— 兜底路由：吞掉匹配不到页面的深链，避免「Unmatched Route」黑屏
// 场景：从 ES 等 App「分享/打开方式」文件时，系统以 hermesdl://private/var/mobile/.../Inbox/xxx.MP4
// 这类 URL 打开 App，path 没有对应页面。这里把「分享类深链」重定向到 /share，其余正常显示未找到。
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { Text, View } from 'react-native';
import { getIncomingShare } from '../lib/share-intent';
import { useTheme } from '../lib/theme-context';

// 分享深链特征：路径里含「拷贝到」落盘的 Inbox / tmp ...-Inbox，或带常见文件扩展名
function looksLikeSharedFile(path: string): boolean {
  return (
    /[./]Inbox\//i.test(path) ||
    /\/tmp\/.+-Inbox\//i.test(path) ||
    /\.(mp4|mov|m4v|png|jpe?g|gif|webp|heic|pdf|txt|md|json|csv|docx?|xlsx?|pptx?|zip|mp3|m4a|wav)$/i.test(path)
  );
}

export default function MissingScreen() {
  const colors = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ missing?: string | string[] }>();

  const redirect = useCallback(() => {
    // 分享单例里已有内容（冷启动 Inbox 扫描先一步找到文件）→ 直接进分享页
    if (getIncomingShare()) {
      router.replace('/share');
      return;
    }
    const segs = Array.isArray(params.missing)
      ? params.missing
      : params.missing
        ? [params.missing]
        : [];
    if (looksLikeSharedFile('/' + segs.join('/'))) {
      router.replace('/share');
    }
  }, [params.missing, router]);

  useEffect(() => {
    redirect();
  }, [redirect]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 32,
        backgroundColor: colors.bg,
      }}
    >
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>页面不存在</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
        没有找到对应的页面
      </Text>
    </View>
  );
}
