// src/lib/cache-utils.ts —— 可独立测试的本机缓存处理规则
export type CacheEntry = { delete: () => void };
export type CacheDirectory = { exists: boolean; list: () => CacheEntry[] };

export function clearDirectoryEntries(dir: CacheDirectory): void {
  if (!dir.exists) return;
  for (const entry of dir.list()) entry.delete();
}

export function formatCacheSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
