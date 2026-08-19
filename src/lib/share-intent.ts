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

/** 取一个 Inbox 目录里最新文件（目录不存在/无文件 → null） */
function newestFileInDir(dir: Directory): File | null {
  try {
    if (!dir.exists) return null;
    const files = dir.list().filter((e): e is File => e instanceof File);
    if (files.length === 0) return null;
    files.sort((a, b) => (b.modificationTime ?? 0) - (a.modificationTime ?? 0));
    return files[0];
  } catch {
    return null;
  }
}

/** iOS app 容器根目录 file:///.../Data/Application/<UUID>/（由 Documents 上溯一级得到） */
function appContainerRoot(): Directory | null {
  try {
    const doc = Paths.document.uri; // file:///.../Documents
    const i = doc.lastIndexOf('/Documents');
    if (i < 0) return null;
    return new Directory(doc.slice(0, i));
  } catch {
    return null;
  }
}

/** 扫 tmp 下的所有 <xxx>-Inbox（系统「打开方式」把文件落这里），返回最新文件 */
function takeTmpInboxFile(): File | null {
  try {
    const root = appContainerRoot();
    if (!root) return null;
    const tmp = new Directory(root.uri, 'tmp');
    if (!tmp.exists) return null;
    let newest: File | null = null;
    for (const e of tmp.list()) {
      if (!(e instanceof Directory) || !e.name.endsWith('-Inbox')) continue;
      const f = newestFileInDir(e);
      if (f && (!newest || (f.modificationTime ?? 0) > (newest.modificationTime ?? 0))) newest = f;
    }
    return newest;
  } catch {
    return null;
  }
}

/** 扫描 Inbox（系统「拷贝到/打开方式 KAKU Hermes」落文件处，含 Documents/Inbox 与 tmp/*-Inbox），取最新文件并移到缓存避免重复触发 */
async function takeInboxFile(): Promise<IncomingShare | null> {
  const docs = newestFileInDir(new Directory(Paths.document, 'Inbox'));
  const tmp = takeTmpInboxFile();
  const newest = [docs, tmp]
    .filter((f): f is File => !!f)
    .sort((a, b) => (b.modificationTime ?? 0) - (a.modificationTime ?? 0))[0];
  if (!newest) return null;
  let path = newest.uri;
  try {
    const dest = new File(Paths.cache, `inbox_${Date.now()}_${newest.name}`);
    newest.move(dest);
    path = dest.uri;
  } catch {}
  return { files: [{ path, fileName: newest.name, mimeType: mimeFromName(newest.name) }] };
}

/** 把分享文件复制到 app cache，避免 iOS 临时文件被系统提前清理 */
async function copyShareFileToCache(f: { path: string; mimeType?: string; fileName?: string; size?: number }) {
  try {
    const dest = new File(Paths.cache, 'share_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '_' + (f.fileName || 'file'));
    new File(f.path).copy(dest);
    return { path: dest.uri, mimeType: f.mimeType, fileName: f.fileName, size: f.size };
  } catch {
    return f; // 复制失败仍用原路径
  }
}

/** 根布局调用：把 expo-share-intent 结果 + Inbox 兜底同步到单例 */
export function useShareIntentBridge() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  useEffect(() => {
    if (!hasShareIntent || !shareIntent) return;
    const si = shareIntent as unknown as IncomingShare;
    const files = si.files ?? [];
    if (!files.length) {
      setIncomingShare({ text: si.text, webUrl: si.webUrl });
      return;
    }
    // 先把文件复制到 cache 再进分享页（异步完成后更新单例）
    let alive = true;
    (async () => {
      const copied = await Promise.all(files.map(copyShareFileToCache));
      if (alive) setIncomingShare({ text: si.text, webUrl: si.webUrl, files: copied });
    })();
    return () => {
      alive = false;
    };
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
