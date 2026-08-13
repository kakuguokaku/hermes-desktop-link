// src/lib/api.ts —— 桥接服务客户端（REST + WebSocket 流式）
import type { ConnConfig } from './storage';

export type Model = { id: string; name: string; provider: string };
export type SessionSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
  preview: string;
  messageCount: number;
  model: string | null;
};
export type Message = { id: string | null; role: 'user' | 'assistant'; content: string; createdAt: string | null };
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
  session: (c: ConnConfig, id: string) => jfetch<SessionDetail>(c, `/api/sessions/${encodeURIComponent(id)}`),
  cron: (c: ConnConfig) => jfetch<{ tasks: CronTask[] }>(c, '/api/cron'),
  removeSession: (c: ConnConfig, id: string) =>
    jfetch<{ ok: boolean }>(c, `/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  archiveSession: (c: ConnConfig, id: string) =>
    jfetch<{ ok: boolean }>(c, `/api/sessions/${encodeURIComponent(id)}/archive`, { method: 'POST' }),
  unarchiveSession: (c: ConnConfig, id: string) =>
    jfetch<{ ok: boolean }>(c, `/api/sessions/${encodeURIComponent(id)}/unarchive`, { method: 'POST' }),
};

// ---------- WebSocket 流式 ----------
export type StreamEvents = {
  onDelta: (sessionId: string, delta: string) => void;
  onComplete: (sessionId: string) => void;
  onError: (sessionId: string, error: string) => void;
  onStatus?: (status: 'connecting' | 'open' | 'closed') => void;
  onRawMessage?: (msg: any) => void;
};

export type StreamHandle = {
  stop: () => void;
  send: (payload: { content: string; model?: string; sessionId?: string }) => boolean;
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
          if (ev.type === 'message.delta') events.onDelta(ev.sessionId, ev.delta);
          else if (ev.type === 'message.complete') events.onComplete(ev.sessionId);
          else if (ev.type === 'message.error') events.onError(ev.sessionId, ev.error);
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
