// src/lib/share-intent.ts —— iOS 分享扩展桥接
// expo-share-intent 要求 useShareIntent 在根布局调用；结果写入模块级单例，share 页读取。
import { useEffect } from 'react';
import { useShareIntent } from 'expo-share-intent';

export type IncomingShare = {
  text?: string;
  webUrl?: string;
  files?: { path: string; mimeType?: string; fileName?: string; size?: number }[];
};

let latest: IncomingShare | null = null;
const listeners = new Set<() => void>();

export function setIncomingShare(s: IncomingShare | null) {
  latest = s;
  listeners.forEach((cb) => cb());
}
export function getIncomingShare(): IncomingShare | null {
  return latest;
}
export function subscribeIncoming(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export function resetIncomingShare() {
  setIncomingShare(null);
}

/** 根布局调用：把 useShareIntent 的结果同步到单例 */
export function useShareIntentBridge() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  useEffect(() => {
    if (hasShareIntent && shareIntent) {
      const si = shareIntent as unknown as IncomingShare;
      setIncomingShare({ text: si.text, webUrl: si.webUrl, files: si.files });
    }
  }, [hasShareIntent, shareIntent]);
  return { resetShareIntent };
}
