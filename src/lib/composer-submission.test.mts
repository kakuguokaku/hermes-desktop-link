import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beginComposerSubmission, finishComposerSubmission } from './composer-submission.ts';

test('附件提交开始时保留输入区附件，避免与消息插入同批卸载', () => {
  const initial = { attachments: [{ kind: 'file' as const, name: '报告.pdf' }], resetEpoch: 0 };
  assert.deepEqual(beginComposerSubmission(initial), { ...initial, submitting: true });
});

test('请求结束后才清空附件并递增重置标记', () => {
  const inFlight = { attachments: [{ kind: 'image' as const, name: '照片.jpg' }], resetEpoch: 4, submitting: true };
  assert.deepEqual(finishComposerSubmission(inFlight), { attachments: [], resetEpoch: 5, submitting: false });
});
