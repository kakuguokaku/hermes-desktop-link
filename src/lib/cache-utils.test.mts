import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearDirectoryEntries, formatCacheSize } from './cache-utils.ts';

test('clearDirectoryEntries 保留目录本身，只删除目录内的每一项', () => {
  const deleted: string[] = [];
  clearDirectoryEntries({
    exists: true,
    list: () => [
      { delete: () => deleted.push('image.jpg') },
      { delete: () => deleted.push('shared.pdf') },
    ],
  });
  assert.deepEqual(deleted, ['image.jpg', 'shared.pdf']);
});

test('clearDirectoryEntries 在缓存目录不存在时不抛错', () => {
  assert.doesNotThrow(() => clearDirectoryEntries({ exists: false, list: () => [] }));
});

test('formatCacheSize 使用可读的本机缓存容量文案', () => {
  assert.equal(formatCacheSize(0), '0 B');
  assert.equal(formatCacheSize(512), '512 B');
  assert.equal(formatCacheSize(2048), '2.0 KB');
  assert.equal(formatCacheSize(3 * 1024 * 1024), '3.0 MB');
});
