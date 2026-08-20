import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isEmptyAssistantMessage } from './message-render-state.ts';

test('empty assistant messages remain represented by a stable list row after streaming ends', () => {
  assert.equal(isEmptyAssistantMessage({ role: 'assistant', content: '', isStreaming: false }), true);
  assert.equal(isEmptyAssistantMessage({ role: 'assistant', content: '', isStreaming: true }), false);
  assert.equal(isEmptyAssistantMessage({ role: 'assistant', content: 'reply', isStreaming: false }), false);
  assert.equal(isEmptyAssistantMessage({ role: 'user', content: '', isStreaming: false }), false);
});

