import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeLegacyUploadPayload } from './upload-format.ts';

test('makeLegacyUploadPayload creates the Base64 request accepted by older Bridge versions', () => {
  assert.deepEqual(makeLegacyUploadPayload('a b.pdf', 'file', 'aGVsbG8='), {
    name: 'a b.pdf', kind: 'file', dataBase64: 'aGVsbG8=',
  });
});

