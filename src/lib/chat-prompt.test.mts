import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAttachmentPrompt, contentForSend } from './chat-prompt.ts';

test('buildAttachmentPrompt 附件默认提示词', () => {
  assert.equal(buildAttachmentPrompt(true, false), '照片里是什么');
  assert.equal(buildAttachmentPrompt(false, true), '请读取这个文件并告诉我这是什么');
  assert.equal(buildAttachmentPrompt(true, true), '请读取并分析这些附件');
  assert.equal(buildAttachmentPrompt(false, false), '');
});

test('contentForSend 有文字优先用文字，无文字补默认提示', () => {
  assert.equal(contentForSend('  总结  ', false, true), '总结');
  assert.equal(contentForSend('', true, false), '照片里是什么');
  assert.equal(contentForSend('', true, true), '请读取并分析这些附件');
});