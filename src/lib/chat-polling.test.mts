import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldHandleStreamEvent, shouldPollSession } from './chat-polling.ts';

test('新建页面在取得真实会话 id 后开始轮询回复', () => {
  assert.equal(
    shouldPollSession({ focused: true, appActive: true, online: true, hasConfig: true, sessionId: '20260819_123456_abcd' }),
    true
  );
});

test('未创建会话或页面不活跃时不轮询', () => {
  assert.equal(shouldPollSession({ focused: true, appActive: true, online: true, hasConfig: true, sessionId: null }), false);
  assert.equal(
    shouldPollSession({ focused: false, appActive: true, online: true, hasConfig: true, sessionId: '20260819_123456_abcd' }),
    false
  );
});

test('流式请求刚启动时匹配的首个增量可被处理', () => {
  assert.equal(shouldHandleStreamEvent(true, 'req-1', 'req-1'), true);
  assert.equal(shouldHandleStreamEvent(true, 'req-1', 'req-2'), false);
  assert.equal(shouldHandleStreamEvent(false, 'req-1', 'req-1'), false);
});
