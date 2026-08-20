import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultShareTarget, shouldLeaveShareAfterBridgeAccepts } from './share-target.ts';

test('外部分享默认创建新的应用会话', () => {
  assert.match(createDefaultShareTarget(123), /^app-share-123-/);
});

test('桥接已接受分享后立即离开分享页', () => {
  assert.equal(shouldLeaveShareAfterBridgeAccepts(), true);
});
