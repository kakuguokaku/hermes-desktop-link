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

function headers(c: ConnConfig) {
  return { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' };
}

async function jfetch<T>(c: ConnConfig, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${c.baseUrl}${path}`, {
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
};

export type StreamHandle = {
  stop: () => void;
  send: (payload: { content: string; model?: string; sessionId?: string }) => boolean;
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
    try {
      const wsUrl = c.baseUrl.replace(/^http/, 'ws');
      ws = new WebSocket(`${wsUrl}/ws?token=${encodeURIComponent(c.token)}`);
    } catch {
      schedule();
      return;
    }
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
  };
}
