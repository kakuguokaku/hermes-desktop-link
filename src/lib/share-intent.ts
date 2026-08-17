// src/lib/share-intent.ts —— iOS 分享扩展 + 系统「拷贝到」兜底桥接
// expo-share-intent 要求 useShareIntent 在根布局调用；结果写入模块级单例，share 页读取。
// 兜底：系统「拷贝到 KAKU Hermes」把文件落 Documents/Inbox（免 App Group，免费签名可用），
// 启动 + 每次回前台扫 Inbox，取最新文件移出后进分享流程。
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
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

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
  mp3: 'audio/mpeg',
  m4a: 'audio/x-m4a',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
};

function mimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

/** 扫描 Documents/Inbox（系统「拷贝到 KAKU Hermes」落文件处），取最新文件并移到缓存避免重复触发 */
async function takeInboxFile(): Promise<IncomingShare | null> {
  try {
    const inbox = new Directory(Paths.document, 'Inbox');
    if (!inbox.exists) return null;
    const files = inbox.list().filter((e): e is File => e instanceof File);
    if (files.length === 0) return null;
    files.sort((a, b) => (b.modificationTime ?? 0) - (a.modificationTime ?? 0));
    const newest = files[0];
    let path = newest.uri;
    try {
      const dest = new File(Paths.cache, `inbox_${Date.now()}_${newest.name}`);
      newest.move(dest);
      path = dest.uri;
    } catch {}
    return { files: [{ path, fileName: newest.name, mimeType: mimeFromName(newest.name) }] };
  } catch {
    return null;
  }
}

/** 根布局调用：把 expo-share-intent 结果 + Inbox 兜底同步到单例 */
export function useShareIntentBridge() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  useEffect(() => {
    if (hasShareIntent && shareIntent) {
      const si = shareIntent as unknown as IncomingShare;
      setIncomingShare({ text: si.text, webUrl: si.webUrl, files: si.files });
    }
  }, [hasShareIntent, shareIntent]);

  // 「拷贝到 KAKU Hermes」兜底：扫 Inbox（免 App Group），冷启动 + 每次回前台
  useEffect(() => {
    let alive = true;
    const check = () =>
      takeInboxFile().then((s) => {
        if (alive && s) setIncomingShare(s);
      });
    check();
    // 文件可能稍晚写入 Inbox：1s/3s 后再查一次，确保捕获
    const t1 = setTimeout(() => alive && check(), 1000);
    const t2 = setTimeout(() => alive && check(), 3000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      alive = false;
      clearTimeout(t1);
      clearTimeout(t2);
      sub.remove();
    };
  }, []);

  return { resetShareIntent };
}
