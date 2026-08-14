// src/lib/share-intent.ts —— iOS 分享扩展 + 系统「打开/拷贝到」桥接
// expo-share-intent 要求 useShareIntent 在根布局调用；结果写入模块级单例，share 页读取。
// 另外监听系统 file:// 深链（"拷贝到 KAKU Hermes" → 文件落 Documents/Inbox，免 App Group），
// 一并转入分享流程，作为分享扩展在免费签名下不工作的兜底。
import { useEffect } from 'react';
import { addEventListener as linkingAddListener, getInitialURL } from 'expo-linking';
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

/** 把系统 file:// 深链（Documents/Inbox 里被拷入的文件）转成分享数据 */
export function shareFromFileUrl(url: string): IncomingShare | null {
  if (!url.startsWith('file://')) return null;
  const uri = decodeURIComponent(url); // file:// 完整 URI：预览 Image 与上传 readAsStringAsync 都需要
  const fileName = uri.replace(/^file:\/\//, '').split('/').pop() || '附件';
  return { files: [{ path: uri, fileName, mimeType: mimeFromName(fileName) }] };
}

/** 根布局调用：把 expo-share-intent 结果 + 系统 file:// 深链同步到单例 */
export function useShareIntentBridge() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  useEffect(() => {
    if (hasShareIntent && shareIntent) {
      const si = shareIntent as unknown as IncomingShare;
      setIncomingShare({ text: si.text, webUrl: si.webUrl, files: si.files });
    }
  }, [hasShareIntent, shareIntent]);

  useEffect(() => {
    const handleUrl = (raw: string | null) => {
      const s = raw ? shareFromFileUrl(raw) : null;
      if (s) setIncomingShare(s);
    };
    const sub = linkingAddListener('url', (e) => handleUrl(e.url));
    getInitialURL().then(handleUrl);
    return () => sub.remove();
  }, []);

  return { resetShareIntent };
}
