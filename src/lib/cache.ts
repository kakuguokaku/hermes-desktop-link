// src/lib/cache.ts —— 手机端可安全清理的临时缓存（不碰 AsyncStorage / 对话数据）
import { Directory, Paths } from 'expo-file-system';
import { clearDirectoryEntries } from './cache-utils';

function cacheDirectory(): Directory {
  return new Directory(Paths.cache);
}

export function getLocalCacheSize(): number {
  const dir = cacheDirectory();
  return dir.exists ? (dir.size ?? 0) : 0;
}

export function clearLocalCache(): void {
  clearDirectoryEntries(cacheDirectory());
}
