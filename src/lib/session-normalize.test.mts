import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSessionDetail } from './session-normalize.ts';

test('normalizeSessionDetail converts malformed historical message payloads to safe renderable values', () => {
  const result = normalizeSessionDetail({
    session: { id: 's1', title: '旧会话' },
    messages: [
      { id: 1, role: 'user', content: { text: 'hello' } },
      { id: null, role: 'assistant', content: ['ok'] },
      { id: 'bad', role: 'system', content: 'ignore' },
    ],
  });
  assert.deepEqual(result.messages, [
    { id: '1', role: 'user', content: '[object Object]', createdAt: null },
    { id: null, role: 'assistant', content: 'ok', createdAt: null },
  ]);
});

