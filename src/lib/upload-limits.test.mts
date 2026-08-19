import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertUploadSize, UploadTooLargeError, formatBytes, UPLOAD_LIMITS_BYTES } from './upload-limits.ts';

test('assertUploadSize 超限抛 UploadTooLargeError', () => {
  assert.throws(() => assertUploadSize(UPLOAD_LIMITS_BYTES.image + 1, 'image'), UploadTooLargeError);
  assert.doesNotThrow(() => assertUploadSize(UPLOAD_LIMITS_BYTES.image, 'image'));
  assert.throws(() => assertUploadSize(UPLOAD_LIMITS_BYTES.file + 1, 'file'), UploadTooLargeError);
});

test('UploadTooLargeError 带大小上限提示', () => {
  try {
    assertUploadSize(UPLOAD_LIMITS_BYTES.file + 1, 'file');
    assert.fail('应抛错');
  } catch (e: any) {
    assert.equal(e.name, 'UploadTooLargeError');
    assert.match(e.message, /MB 上限/);
  }
});

test('formatBytes 格式化', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(3 * 1024 * 1024), '3.0 MB');
  assert.equal(formatBytes(null), '');
});