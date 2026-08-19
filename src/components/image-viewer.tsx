// src/components/image-viewer.tsx —— 全屏图片查看器（iOS 原生捏合缩放 + 保存相册）
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, type Colors } from '../lib/theme';
import { useTheme } from '../lib/theme-context';

export function ImageViewer({
  visible,
  uri,
  onClose,
}: {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
}) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const [saving, setSaving] = useState(false);

  const saveToPhotos = async () => {
    if (!uri || saving) return;
    setSaving(true);
    try {
      let perm = await MediaLibrary.requestPermissionsAsync(true); // 仅需添加权限
      if (!perm.granted) {
        perm = await MediaLibrary.requestPermissionsAsync(false);
        if (!perm.granted) {
          Alert.alert('无法保存', '请在系统设置中允许「照片」权限后重试');
          return;
        }
      }
      let localUri = uri;
      if (uri.startsWith('http') || uri.startsWith('data:')) {
        // 远程/内联图先下载到缓存；本地 file:// 直接存相册
        const f = await File.downloadFileAsync(uri, new Directory(Paths.cache), { idempotent: true });
        localUri = f.uri;
      }
      await MediaLibrary.Asset.create(localUri);
      Alert.alert('已保存到相册');
    } catch {
      Alert.alert('保存失败', '请检查网络后重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.barBtn} accessibilityLabel="关闭">
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <Pressable onPress={saveToPhotos} hitSlop={12} style={styles.barBtn} accessibilityLabel="保存到相册">
            {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="download-outline" size={24} color="#fff" />}
          </Pressable>
        </View>
        <Pressable style={styles.pressArea} onPress={onClose}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            maximumZoomScale={4}
            minimumZoomScale={1}
            bouncesZoom
            centerContent
          >
            {uri ? (
              <Pressable onPress={onClose} onLongPress={saveToPhotos} delayLongPress={400}>
                <Image source={{ uri }} style={styles.img} contentFit="contain" />
              </Pressable>
            ) : null}
          </ScrollView>
        </Pressable>
        <Text style={[styles.hint, { paddingBottom: insets.bottom + 8 }]}>双指缩放 · 长按图片保存</Text>
      </View>
    </Modal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 8,
    },
    barBtn: { padding: 8 },
    pressArea: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { flexGrow: 1, justifyContent: 'center' },
    img: { width: '100%', height: '100%' },
    hint: {
      textAlign: 'center',
      color: 'rgba(255,255,255,0.6)',
      fontSize: font.tiny,
      paddingVertical: 10,
    },
  });
