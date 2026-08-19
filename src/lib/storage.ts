// src/lib/storage.ts —— 连接配置持久化
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type ConnConfig = { baseUrl: string; token: string; lanBaseUrl?: string };
export type DisplayMode = 'auto' | 'light' | 'dark';
export type FontSize = 'standard' | 'large';
export type AppPrefs = { defaultModel?: string | null; displayMode?: DisplayMode; fontSize?: FontSize };

const CONN_KEY = 'hdl.conn';
const PREFS_KEY = 'hdl.prefs';

export async function getConfig(): Promise<ConnConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(CONN_KEY);
    if (raw) return JSON.parse(raw) as ConnConfig;
  } catch {
    // ignore
  }
  // 浏览器本地模式：自动连本机桥接服务（本机回环免密）
  if (Platform.OS === 'web') {
    return { baseUrl: 'http://127.0.0.1:8787', token: '' };
  }
  return null;
}

export async function saveConfig(c: ConnConfig) {
  await AsyncStorage.setItem(CONN_KEY, JSON.stringify(c));
}

export async function clearConfig() {
  await AsyncStorage.removeItem(CONN_KEY);
}

export async function getPrefs(): Promise<AppPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as AppPrefs) : {};
  } catch {
    return {};
  }
}

export async function savePrefs(p: Partial<AppPrefs>) {
  const existing = await getPrefs();
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ ...existing, ...p }));
}
