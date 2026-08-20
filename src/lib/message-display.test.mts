import { test } from 'node:test';
import assert from 'node:assert/strict';
import { userMessageDisplayText } from './message-display.ts';

test('图片原始描述被 Hermes 替换时，仍保留客户端的默认提示词', () => {
  assert.equal(
    userMessageDisplayText('[The user attached an image: detailed pixels]\n照片里是什么'),
    '照片里是什么'
  );
});

test('图片原始描述没有保留正文时，补回图片默认提示词', () => {
  assert.equal(userMessageDisplayText('[The user attached an image: detailed pixels]'), '照片里是什么');
});

test('语音内部命令仅显示为已发送语音', () => {
  assert.equal(userMessageDisplayText('请将此段语音转换为文字，并作为给你的命令执行。'), '发送了一条语音');
});
