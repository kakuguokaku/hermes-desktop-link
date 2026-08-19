// src/lib/connection.ts —— 全局连接管理器（单例）
// 服务对话页与设置页：统一持有 WS 生命周期 + 状态订阅 +
// 前台心跳保活（ping/pong + 假死检测）+ AppState 前台秒连 + 网络切换自动重连。
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { openStream, resetBaseUrlCache, type StreamHandle } from './api';
import type { ConnConfig } from './storage';

export type Status = 'connecting' | 'open' | 'closed';
export type StreamHandlers = {
  onDelta: (sessionId: string, delta: string, reqId?: string) => void;
  onComplete: (sessionId: string, reqId?: string) => void;
  onError: (sessionId: string, error: string, reqId?: string) => void;
};

const HEARTBEAT_INTERVAL = 25000; // 每 25s 发一次 ping 保活
const PONG_TIMEOUT = 10000; // 发出 ping 后 10s 无 pong → 判定假死
const RESUME_VERIFY = 3000; // 回前台时对"伪在线"做 3s 验证

let cfg: ConnConfig | null = null;
let cfgKeyStr: string | null = null;
let status: Status = 'closed';
let stream: StreamHandle | null = null;
let handlers: StreamHandlers | null = null;
const listeners = new Set<(s: Status) => void>();
const sessionUpdatedListeners = new Set<(sid: string) => void>();
const requestResultListeners = new Set<(result: { reqId: string; type: 'complete' | 'error'; error?: string }) => void>();
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let pongTimer: ReturnType<typeof setTimeout> | null = null;
let pongSeen = false; // 关键防坑：只有收到过 pong 才启用假死检测
let epoch = 0; // 代数守卫：stopStream 递增，使旧流的迟到事件失效

/** 连接配置的内容 key（不依赖对象身份，下游重新接线时不会误判为"相同"） */
function cfgKey(c: ConnConfig) { return `${c.baseUrl}|${c.token}|${c.lanBaseUrl || ''}`; }

function setStatus(s: Status) {
  if (s === status) return;
  status = s;
  listeners.forEach((cb) => cb(s));
}

function clearTimers() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  if (pongTimer) { clearTimeout(pongTimer); pongTimer = null; }
}

function stopStream() {
  epoch += 1; // 使旧流的迟到事件失效
  clearTimers();
  try { stream?.stop(); } catch {}
  stream = null;
}

function reconnectNow() {
  if (!cfg) return;
  stopStream();
  pongSeen = false;
  startStream();
}

function startHeartbeat() {
  clearTimers();
  heartbeatTimer = setInterval(() => {
    if (status !== 'open' || !stream) return;
    const sent = stream.sendRaw({ type: 'ping' });
    if (!sent) {
      // socket 已死（伪在线）→ 立即重连
      reconnectNow();
      return;
    }
    if (pongSeen) {
      const hbEpoch = epoch; // 旧代回调失效守卫
      if (pongTimer) clearTimeout(pongTimer);
      pongTimer = setTimeout(() => {
        if (hbEpoch !== epoch) return;
        if (status === 'open') {
          setStatus('closed');
          reconnectNow();
        }
      }, PONG_TIMEOUT);
    }
  }, HEARTBEAT_INTERVAL);
}

function onPong() {
  pongSeen = true;
  if (pongTimer) { clearTimeout(pongTimer); pongTimer = null; }
}

function startStream() {
  if (!cfg) return;
  const myEpoch = epoch;
  setStatus('connecting');
  stream = openStream(cfg, {
    onStatus: (s) => {
      if (myEpoch !== epoch) return; // 旧流迟到事件忽略
      if (s === 'open') {
        setStatus('open');
        startHeartbeat();
      } else {
        clearTimers();
        setStatus(s);
      }
    },
    onDelta: (sid, delta, reqId) => { if (myEpoch === epoch) handlers?.onDelta(sid, delta, reqId); },
    onComplete: (sid, reqId) => {
      if (myEpoch !== epoch) return;
      handlers?.onComplete(sid, reqId);
      if (reqId) requestResultListeners.forEach((cb) => cb({ reqId, type: 'complete' }));
    },
    onError: (sid, err, reqId) => {
      if (myEpoch !== epoch) return;
      handlers?.onError(sid, err, reqId);
      if (reqId) requestResultListeners.forEach((cb) => cb({ reqId, type: 'error', error: err }));
    },
    onRawMessage: (msg) => {
      if (myEpoch !== epoch) return;
      if (msg?.type === 'pong') onPong();
      if (msg?.type === 'session.updated' && msg.sessionId) {
        sessionUpdatedListeners.forEach((cb) => cb(msg.sessionId));
      }
    },
  });
}

export const connection = {
  ensureStarted(c: ConnConfig) {
    const k = cfgKey(c);
    if (cfgKeyStr === k && (status === 'open' || status === 'connecting')) return;
    if (stream) stopStream();
    cfg = c;
    cfgKeyStr = k;
    pongSeen = false;
    startStream();
  },
  setStreamHandlers(h: StreamHandlers | null) {
    handlers = h;
  },
  subscribe(cb: (s: Status) => void): () => void {
    listeners.add(cb);
    cb(status); // 立即回放当前状态：避免消费者挂载时错过已建立的连接
    return () => listeners.delete(cb);
  },
  subscribeSessionUpdated(cb: (sid: string) => void): () => void {
    sessionUpdatedListeners.add(cb);
    return () => sessionUpdatedListeners.delete(cb);
  },
  subscribeRequestResult(cb: (result: { reqId: string; type: 'complete' | 'error'; error?: string }) => void): () => void {
    requestResultListeners.add(cb);
    return () => requestResultListeners.delete(cb);
  },
  getStatus(): Status {
    return status;
  },
  reconnectNow() {
    reconnectNow();
  },
  disconnect() {
    stopStream();
    cfg = null;
    cfgKeyStr = null;
    handlers = null;
    pongSeen = false;
    setStatus('closed');
  },
  send(payload: { content: string; model?: string; sessionId?: string; reqId?: string; attachments?: { kind: 'image' | 'file'; fileId: string }[] }): boolean {
    if (status !== 'open' || !stream) return false;
    return stream.send(payload);
  },
  resetBaseUrlCache() {
    resetBaseUrlCache();
  },
};

// ---- AppState：回到前台秒连 / 伪在线验证 ----
AppState.addEventListener('change', (next: AppStateStatus) => {
  if (next !== 'active' || !cfg) return;
  if (status === 'closed') {
    // 已断开 → 立即重连（connecting 是中间态，不打断）
    reconnectNow();
  } else if (status === 'open' && pongSeen) {
    // 伪在线验证：发 ping，3s 内无 pong 则重连
    const sent = stream?.sendRaw({ type: 'ping' });
    if (!sent) {
      // socket 实际已死（readyState 非 OPEN）→ 立刻重连，不等 3s
      reconnectNow();
      return;
    }
    const vEpoch = epoch; // 旧代回调失效守卫
    if (pongTimer) clearTimeout(pongTimer);
    pongTimer = setTimeout(() => {
      if (vEpoch !== epoch) return;
      if (status === 'open') reconnectNow();
    }, RESUME_VERIFY);
  }
});

// ---- NetInfo：网络恢复 / WiFi↔蜂窝切换 → 防抖重连 ----
let prev = { connected: false, type: 'unknown' };
let seenFirst = false;
let netDebounce: ReturnType<typeof setTimeout> | null = null;
NetInfo.addEventListener((state) => {
  if (!cfg) return;
  const now = { connected: !!state.isConnected, type: state.type ?? 'unknown' };
  if (!seenFirst) { seenFirst = true; prev = now; return; }
  const changed =
    (now.connected && !prev.connected) ||
    (now.connected && prev.connected && now.type !== prev.type);
  prev = now;
  if (!changed || !now.connected) return;
  if (netDebounce) clearTimeout(netDebounce);
  netDebounce = setTimeout(() => {
    if (!cfg) return;
    resetBaseUrlCache();
    reconnectNow();
  }, 2000);
});
