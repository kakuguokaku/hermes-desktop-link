// src/lib/api.ts —— 桥接服务客户端（REST + WebSocket 流式）
// 注意：SDK57 expo-file-system 根导出的 readAsStringAsync 是抛错 shim，须走 /legacy 真实实现
import * as FileSystem from 'expo-file-system/legacy';
import { File, Paths } from 'expo-file-system';
import type { ConnConfig } from './storage';
import { assertUploadSize, UploadTooLargeError } from './upload-limits';

export type Model = { id: string; name: string; provider: string };
export type SessionSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
  preview: string;
  messageCount: number;
  model: string | null;
};
export type Attachment = {
  kind: 'image' | 'file';
  name: string;      // 文件名（含扩展名）
  uri?: string;      // 本地文件 uri（已发送/本机存在时）
  size?: number;     // 字节数
};
export type Uploaded = { fileId: string; name: string; kind: 'image' | 'file'; size: number };
export type Message = { id: string | null; role: 'user' | 'assistant'; content: string; createdAt: string | null; attachments?: Attachment[] };
export type SessionDetail = { session: SessionSummary; messages: Message[] };
export type CronTask = {
  id: string;
  name: string;
  active: boolean;
  scheduleText: string;
  nextRunText: string;
  lastRunText: string;
};

// ---------- 智能地址：自动连接时先探内网（2s 超时），不可用则走外网 ----------
let activeCache: { key: string; baseUrl: string; at: number } | null = null;

/** 探测某地址是否可达（可选带 token 校验）。2.5s 超时。 */
export function probeHealth(baseUrl: string, token?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    fetch(`${baseUrl}/api/health`, {
      signal: ctrl.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((r) => resolve(r.ok))
      .catch(() => resolve(false))
      .finally(() => clearTimeout(t));
  });
}

/** 探测需鉴权的端点，验证 token 是否有效。2.5s 超时。 */
export function probeAuth(baseUrl: string, token: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    fetch(`${baseUrl}/api/models`, {
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => resolve(r.ok))
      .catch(() => resolve(false))
      .finally(() => clearTimeout(t));
  });
}

/** 解析当前应使用的 baseUrl：配置了内网且可达则用内网，否则用外网。缓存 30s。 */
export async function resolveActiveBaseUrl(c: ConnConfig): Promise<string> {
  const key = `${c.baseUrl}|${c.lanBaseUrl || ''}`;
  if (activeCache && activeCache.key === key && Date.now() - activeCache.at < 30000) {
    return activeCache.baseUrl;
  }
  let active = c.baseUrl;
  if (c.lanBaseUrl && c.lanBaseUrl !== c.baseUrl) {
    if (await probeHealth(c.lanBaseUrl, c.token)) active = c.lanBaseUrl;
  }
  activeCache = { key, baseUrl: active, at: Date.now() };
  return active;
}

function headers(c: ConnConfig) {
  return { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' };
}

async function jfetch<T>(c: ConnConfig, path: string, init?: RequestInit): Promise<T> {
  const baseUrl = await resolveActiveBaseUrl(c);
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...headers(c), ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  health: (c: ConnConfig) => jfetch<{ ok: boolean }>(c, '/api/health'),
  models: (c: ConnConfig) => jfetch<{ models: Model[]; defaultModel: string | null }>(c, '/api/models'),
  sessions: (c: ConnConfig) => jfetch<{ sessions: SessionSummary[] }>(c, '/api/sessions'),
  session: (c: ConnConfig, id: string, fresh = false) =>
    jfetch<SessionDetail>(c, `/api/sessions/${encodeURIComponent(id)}${fresh ? '?fresh=1' : ''}`),
  cron: (c: ConnConfig) => jfetch<{ tasks: CronTask[] }>(c, '/api/cron'),
  upload: async (c: ConnConfig, fileUri: string, name: string, kind: 'image' | 'file'): Promise<Uploaded> => {
    // 上传前先取真实大小：超限不读 Base64、不发网络请求（避免大文件内存暴涨）
    const info = await FileSystem.getInfoAsync(fileUri);
    assertUploadSize(info.exists ? (info.size ?? 0) : 0, kind);
    const baseUrl = await resolveActiveBaseUrl(c);
    const res = await FileSystem.uploadAsync(`${baseUrl}/api/upload`, fileUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${c.token}`,
        'Content-Type': 'application/octet-stream',
        'X-Upload-Name': encodeURIComponent(name),
        'X-Upload-Kind': kind,
      },
    });
    if (res.status < 200 || res.status >= 300) throw new Error(`upload failed: ${res.status}`);
    return JSON.parse(res.body) as Uploaded;
  },
  // 拉取已上传附件（历史图片/文件）到缓存文件，返回 file:// 路径（带 token，不在 URL 暴露；
  // 不用 data URL/FileReader——大图 base64 会导致 RN 崩溃）
  uploadFileUrl: async (c: ConnConfig, fileId: string): Promise<string> => {
    const baseUrl = await resolveActiveBaseUrl(c);
    const dest = new File(Paths.cache, `hist_${Date.now()}_${fileId.split(/[\\/]/).pop() || 'file'}`);
    const f = await File.downloadFileAsync(`${baseUrl}/api/uploads/${encodeURIComponent(fileId)}`, dest, {
      headers: { Authorization: `Bearer ${c.token}` },
    });
    return f.uri;
  },
  deleteUpload: (c: ConnConfig, fileId: string) =>
    jfetch<{ ok: boolean }>(c, `/api/uploads/${encodeURIComponent(fileId)}`, { method: 'DELETE' }),
  removeSession: (c: ConnConfig, id: string) =>
    jfetch<{ ok: boolean }>(c, `/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  archiveSession: (c: ConnConfig, id: string) =>
    jfetch<{ ok: boolean }>(c, `/api/sessions/${encodeURIComponent(id)}/archive`, { method: 'POST' }),
  unarchiveSession: (c: ConnConfig, id: string) =>
    jfetch<{ ok: boolean }>(c, `/api/sessions/${encodeURIComponent(id)}/unarchive`, { method: 'POST' }),
};

// ---------- WebSocket 流式 ----------
export type StreamEvents = {
  onDelta: (sessionId: string, delta: string, reqId?: string) => void;
  onComplete: (sessionId: string, reqId?: string) => void;
  onError: (sessionId: string, error: string, reqId?: string) => void;
  onStatus?: (status: 'connecting' | 'open' | 'closed') => void;
  onRawMessage?: (msg: any) => void;
};

export type StreamHandle = {
  stop: () => void;
  send: (payload: { content: string; model?: string; sessionId?: string; reqId?: string; attachments?: { kind: 'image' | 'file'; fileId: string }[] }) => boolean;
  sendRaw: (data: object) => boolean;
};

export function openStream(c: ConnConfig, events: StreamEvents): StreamHandle {
  let ws: WebSocket | null = null;
  let stopped = false;
  let retry = 0;

  const schedule = () => {
    if (stopped) return;
    retry += 1;
    setTimeout(connect, Math.min(1000 * retry, 8000));
  };

  const connect = () => {
    if (stopped) return;
    events.onStatus?.('connecting');
    resolveActiveBaseUrl(c)
      .then((baseUrl) => {
        if (stopped) return;
        const wsUrl = baseUrl.replace(/^http/, 'ws');
        ws = new WebSocket(`${wsUrl}/ws?token=${encodeURIComponent(c.token)}`);
        ws.onopen = () => {
          retry = 0;
          events.onStatus?.('open');
        };
        ws.onmessage = (e) => {
          let ev: any;
          try {
            ev = JSON.parse(typeof e.data === 'string' ? e.data : '');
          } catch {
            return;
          }
          if (ev.type === 'message.delta') events.onDelta(ev.sessionId, ev.delta, ev.reqId);
          else if (ev.type === 'message.complete') events.onComplete(ev.sessionId, ev.reqId);
          else if (ev.type === 'message.error') events.onError(ev.sessionId, ev.error, ev.reqId);
          else events.onRawMessage?.(ev);
        };
        ws.onclose = () => {
          events.onStatus?.('closed');
          if (!stopped) schedule();
        };
        ws.onerror = () => {
          try {
            ws?.close();
          } catch {}
        };
      })
      .catch(() => schedule());
  };

  connect();
  return {
    stop: () => {
      stopped = true;
      try {
        ws?.close();
      } catch {}
    },
    send: (payload) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      ws.send(JSON.stringify({ type: 'send', ...payload }));
      return true;
    },
    sendRaw: (data) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      ws.send(JSON.stringify(data));
      return true;
    },
  };
}

/** 清空智能地址缓存（网络切换后调用，让 LAN/外网重新探测） */
export function resetBaseUrlCache(): void {
  activeCache = null;
}
