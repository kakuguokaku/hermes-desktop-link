// src/components/model-picker.tsx —— 底部弹层模型选择（明暗自适应）
import React, { useMemo } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Model } from '../lib/api';
import { font, radius, type Colors } from '../lib/theme';
import { useTheme } from '../lib/theme-context';

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 10,
      paddingHorizontal: 16,
      paddingBottom: 28,
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.textFaint,
      marginBottom: 12,
    },
    title: { fontSize: font.h2, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: radius.small,
      marginBottom: 2,
    },
    itemActive: { backgroundColor: colors.accentSoft },
    itemMain: { flex: 1, marginRight: 10 },
    itemId: { fontSize: font.body, fontWeight: '600', color: colors.textPrimary },
    itemIdActive: { color: colors.accent },
    itemProvider: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
  });

export function ModelPicker({
  visible,
  models,
  current,
  defaultModel,
  onClose,
  onSelect,
}: {
  visible: boolean;
  models: Model[];
  current: string | null;
  defaultModel: string | null;
  onClose: () => void;
  onSelect: (m: Model) => void;
}) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>选择模型</Text>
          <FlatList
            data={models}
            keyExtractor={(m) => m.id}
            style={{ maxHeight: 420 }}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => {
              const isCurrent = item.id === current;
              const isDefault = item.id === defaultModel;
              return (
                <TouchableOpacity
                  style={[styles.item, isCurrent && styles.itemActive]}
                  onPress={() => onSelect(item)}
                >
                  <View style={styles.itemMain}>
                    <Text style={[styles.itemId, isCurrent && styles.itemIdActive]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemProvider} numberOfLines={1}>
                      {item.provider}
                      {isDefault ? '  ·  默认' : ''}
                    </Text>
                  </View>
                  {isCurrent && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
                </TouchableOpacity>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
