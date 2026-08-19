import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  withStableMessageKeys,
  mergeServerWithLocal,
  localUserMessageId,
  localAssistantMessageId,
  replaceLocalAssistantMessage,
  removeLocalRequestMessages,
} from './message-keys.ts';

const userMsg = (content: string, createdAt: string | null = null) => ({ id: null as string | null, role: 'user' as const, content, createdAt });
const asstMsg = (id: string | null, content: string) => ({ id, role: 'assistant' as const, content, createdAt: '2026-01-01' });

test('withStableMessageKeys 为无 id 历史消息补齐稳定 id', () => {
  const msgs = [userMsg('hi')];
  const a = withStableMessageKeys(msgs);
  const b = withStableMessageKeys(msgs);
  assert.ok(a[0].id && a[0].id.startsWith('hist-'));
  assert.equal(a[0].id, b[0].id, '同一内容两次补齐应得到相同 id');
});

test('mergeServerWithLocal 服务端已确认的本地消息不重复', () => {
  const prev = [
    { id: 'local-user-r1', role: 'user' as const, content: '你好', createdAt: null },
    { id: 'local-assistant-r1', role: 'assistant' as const, content: '', createdAt: null },
  ];
  const server = [userMsg('你好', '2026-01-01'), asstMsg('m2', '回复')];
  const merged = mergeServerWithLocal(server, prev);
  assert.equal(merged.length, 2, '本地乐观消息已被服务端快照替换');
  assert.ok(merged[0].id && merged[0].id.startsWith('hist-'), '无 id 历史消息被补齐为稳定 id');
});

test('mergeServerWithLocal 未确认的本地消息保留在尾部', () => {
  const prev = [
    { id: 'local-user-r9', role: 'user' as const, content: '待确认', createdAt: null, attachments: [{ kind: 'file' as const, name: 'a.pdf', size: 10 }] },
    { id: 'local-assistant-r9', role: 'assistant' as const, content: '', createdAt: null },
  ];
  const merged = mergeServerWithLocal([], prev);
  assert.equal(merged.length, 1, '空助手占位被丢弃');
  assert.equal(merged[0].id, 'local-user-r9');
});

test('本地消息 id 规则', () => {
  assert.equal(localUserMessageId('r1'), 'local-user-r1');
  assert.equal(localAssistantMessageId('r1'), 'local-assistant-r1');
});

test('失败时替换本地助手占位而不新增重复 key', () => {
  const initial = [
    { id: localUserMessageId('r1'), role: 'user' as const, content: '你好', createdAt: null },
    { id: localAssistantMessageId('r1'), role: 'assistant' as const, content: '', createdAt: null },
  ];
  const result = replaceLocalAssistantMessage(initial, 'r1', '⚠️ 出错了：断开连接');
  assert.equal(result.length, 2);
  assert.equal(result[1].id, localAssistantMessageId('r1'));
  assert.equal(result[1].content, '⚠️ 出错了：断开连接');
  assert.equal(new Set(result.map((m) => m.id)).size, result.length);
});

test('socket 未发送时删除同一请求的本地消息', () => {
  const initial = [
    { id: localUserMessageId('r1'), role: 'user' as const, content: '你好', createdAt: null },
    { id: localAssistantMessageId('r1'), role: 'assistant' as const, content: '', createdAt: null },
    { id: localUserMessageId('r2'), role: 'user' as const, content: '保留', createdAt: null },
  ];
  assert.deepEqual(removeLocalRequestMessages(initial, 'r1').map((m) => m.id), [localUserMessageId('r2')]);
});
