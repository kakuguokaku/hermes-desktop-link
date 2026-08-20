import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beginComposerSubmission, acceptComposerSubmission, finishComposerSubmission } from './composer-submission.ts';

test('附件提交开始时保留输入区附件，避免与消息插入同批卸载', () => {
  const initial = { attachments: [{ kind: 'file' as const, name: '报告.pdf' }], resetEpoch: 0 };
  assert.deepEqual(beginComposerSubmission(initial), { ...initial, submitting: true });
});

test('Bridge 接收请求后立即清空可见附件，但维持提交锁', () => {
  const inFlight = { attachments: [{ kind: 'image' as const, name: '照片.jpg' }], resetEpoch: 4, submitting: true };
  assert.deepEqual(acceptComposerSubmission(inFlight), { attachments: [], resetEpoch: 5, submitting: true });
});

test('请求结束后才解除提交锁', () => {
  const accepted = { attachments: [], resetEpoch: 5, submitting: true };
  assert.deepEqual(finishComposerSubmission(accepted), { attachments: [], resetEpoch: 5, submitting: false });
});
