// src/lib/message-keys.ts —— 稳定消息 key 与本地消息合并规则
// 倒序 FlatList 若用「角色+索引」当 key，新消息插入会让所有旧项 key 变化 → 整屏重挂 → 发送时闪退。
// 历史消息缺 id 时在数据进入页面时一次性补齐稳定 id，本地临时消息用 local-user/assistant-<请求id>。
import type { Message } from './api';

function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h * 33) ^ s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/** 历史消息若无 id，用「角色+创建时间+内容长度+内容前缀」生成稳定本地 id（跨刷新不变，不依赖索引） */
export function withStableMessageKeys(messages: Message[]): Message[] {
  const counts = new Map<string, number>();
  return messages.map((m) => {
    if (m.id) return m;
    const content = m.content || '';
    const base = m.role + '|' + (m.createdAt ?? '') + '|' + content.length + '|' + content.slice(0, 160);
    const n = counts.get(base) ?? 0;
    counts.set(base, n + 1);
    return { ...m, id: n === 0 ? 'hist-' + hashStr(base) : 'hist-' + hashStr(base) + '-' + n };
  });
}

/** 判断服务端快照是否已包含同一条消息（按角色+内容+附件数，用于去重本地乐观消息） */
function serverHasMessage(server: Message[], m: Message): boolean {
  return server.some(
    (s) =>
      s.role === m.role &&
      s.content === m.content &&
      (s.attachments?.length ?? 0) === (m.attachments?.length ?? 0)
  );
}

/**
 * 合并服务端快照与本地状态：
 * - 本地 optimistic 消息（local-*）在服务端已出现时不再重复追加；
 * - 已结束的空助手占位（流式结束、服务端已返回正式回复）直接丢弃；
 * - 其余本地消息（上传中/未确认）保留在列表尾部。
 */
export function mergeServerWithLocal(server: Message[], prev: Message[]): Message[] {
  const next = withStableMessageKeys(server);
  const locals = prev.filter((m) => {
    const id = m.id || '';
    if (!id.startsWith('local-')) return false;
    if (id.startsWith('local-assistant-') && !m.content) return false;
    if (serverHasMessage(next, m)) return false;
    return true;
  });
  return locals.length ? next.concat(locals) : next;
}

export function localUserMessageId(reqId: string): string {
  return 'local-user-' + reqId;
}

export function localAssistantMessageId(reqId: string): string {
  return 'local-assistant-' + reqId;
}

/** 将某一请求的助手占位原地替换为错误文本，保留唯一且稳定的 key。 */
export function replaceLocalAssistantMessage(messages: Message[], reqId: string, content: string): Message[] {
  const id = localAssistantMessageId(reqId);
  return messages.map((message) => (message.id === id ? { ...message, content } : message));
}

/** WebSocket 尚未接收请求时，撤回该请求的两个乐观气泡，输入草稿由调用方保留。 */
export function removeLocalRequestMessages(messages: Message[], reqId: string): Message[] {
  const userId = localUserMessageId(reqId);
  const assistantId = localAssistantMessageId(reqId);
  return messages.filter((message) => message.id !== userId && message.id !== assistantId);
}
